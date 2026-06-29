/**
 * @file Pipeline.ts
 * @description
 * The linear chain of `FrameProcessor`s with a two-lane priority queue, the
 * core orchestrator of the pipecat-style voice pipeline.
 *
 * Architecture:
 *
 *   [PipelineSource] → [p0] → [p1] → [p2] → ... → [pN] → [PipelineSink]
 *
 * Frames enter via `source.pushFrame()` and leave via `sink.onFrame`.
 * Internally there are two queues:
 *
 *   - `systemQueue`  — high-priority lane. Drained first, always. System
 *                      frames (input audio, VAD events, InterruptionFrame,
 *                      ErrorFrame) must stay low-latency and jump ahead of
 *                      queued media. This is what makes barge-in work: an
 *                      InterruptionFrame reaches TTS before the buffered audio
 *                      finishes playing.
 *   - `orderedQueue` — ordered lane. Data and Control frames. These are the
 *                      actual media/text being transformed; they must arrive in
 *                      order (you don't want TTS audio chunks reordered).
 *
 * `processQueue()` is a single async pump: drain the system queue to empty,
 * then pull one frame from the ordered queue, and repeat. Because
 * `processFrame` is async and awaited, natural backpressure is applied — a
 * slow TTS stage throttles the whole chain.
 *
 * On `interrupt()`: an InterruptionFrame (SystemFrame) is pushed to the front
 * of the system queue, every processor's `interrupt()` hook is called, and the
 * ordered queue is CLEARED (discarding pending TTS audio). The system queue is
 * preserved so in-flight system events still propagate.
 *
 * On any processor throw: an ErrorFrame (SystemFrame) is pushed upstream so the
 * caller can observe and handle failures without the pipeline wedging.
 */

import { FrameProcessor } from './FrameProcessor';
import {
  type Frame,
  FrameDirection,
  isSystemFrame,
  interruption as interruptionFrame,
  start as startFrame,
  end as endFrame,
  error as errorFrame,
} from './frames';

// ---------------------------------------------------------------------------
// PipelineSource — the head of the chain (external frame injection point)
// ---------------------------------------------------------------------------

/**
 * Invisible head processor. External code calls `source.pushFrame(frame)` to
 * inject frames into the pipeline; `processFrame` forwards to `next`.
 *
 * It is *not* responsible for routing to the correct queue — that is the
 * `Pipeline`'s job. The source merely acts as the upstream-most link so that
 * `prev`-walking stages terminate here rather than on `null`.
 */
export class PipelineSource extends FrameProcessor {
  async processFrame(frame: Frame, direction: FrameDirection): Promise<void> {
    // Source only ever forwards downstream (it has no meaningful upstream).
    if (direction === FrameDirection.Downstream) {
      await this.pushFrame(frame, direction);
    }
  }
}

// ---------------------------------------------------------------------------
// PipelineSink — the tail of the chain (frame exit point)
// ---------------------------------------------------------------------------

/**
 * Invisible tail processor. Frames reaching the sink are delivered to the
 * outside world via the `onFrame` callback. Upstream-bound frames (e.g. an
 * ErrorFrame emitted by a failing stage) are forwarded to `prev`.
 */
export class PipelineSink extends FrameProcessor {
  /**
   * Observer callback invoked for every frame that exits the pipeline
   * downstream, or travels upstream past the source edge. Set this to receive
   * output (TTS audio, transcriptions, errors, etc.).
   */
  onFrame?: (frame: Frame, direction: FrameDirection) => void;

  async processFrame(frame: Frame, direction: FrameDirection): Promise<void> {
    if (this.onFrame) {
      this.onFrame(frame, direction);
    }
    // Upstream frames continue propagating toward the source.
    if (direction === FrameDirection.Upstream) {
      await this.pushFrame(frame, direction);
    }
  }
}

// ---------------------------------------------------------------------------
// Queued item
// ---------------------------------------------------------------------------

interface QueuedFrame {
  frame: Frame;
  direction: FrameDirection;
}

// ---------------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------------

/**
 * A linear chain of `FrameProcessor`s driven by a two-lane priority queue.
 *
 * Construct with the ordered list of stages (STT → LLM → TTS → transport, …).
 * The pipeline auto-injects a `PipelineSource` at the head and `PipelineSink`
 * at the tail; callers never see or wire those.
 */
export class Pipeline {
  readonly source: PipelineSource;
  readonly sink: PipelineSink;
  private readonly processors: FrameProcessor[];

  /** High-priority lane — SystemFrames. Drained before the ordered lane. */
  private readonly systemQueue: QueuedFrame[] = [];
  /** Ordered lane — Data and Control frames. */
  private readonly orderedQueue: QueuedFrame[] = [];

  /** True while the async pump loop is running. */
  private running = false;
  /** Resolves when the pump notices it has been told to stop. */
  private idleResolver: (() => void) | null = null;
  /** Guard against re-entrant pump loops. */
  private pumping = false;

  constructor(processors: FrameProcessor[]) {
    this.source = new PipelineSource();
    this.sink = new PipelineSink();
    this.processors = [...processors];

    // Build the chain: source → p0 → p1 → ... → pN → sink
    const chain: FrameProcessor[] = [this.source, ...this.processors, this.sink];
    for (let i = 0; i < chain.length; i++) {
      chain[i].setPrev(i > 0 ? chain[i - 1] : null);
      chain[i].setNext(i < chain.length - 1 ? chain[i + 1] : null);
    }
  }

  /**
   * Entry point for external frame injection. Routes the frame to the correct
   * lane based on `isSystemFrame()`: SystemFrames jump the queue, everything
   * else is appended in order. Kicks the pump if it's idle.
   */
  pushFrame(frame: Frame, direction: FrameDirection = FrameDirection.Downstream): void {
    const item: QueuedFrame = { frame, direction };
    if (isSystemFrame(frame)) {
      this.systemQueue.push(item);
    } else {
      this.orderedQueue.push(item);
    }
    void this.pump();
  }

  /**
   * Convenience accessor mirroring `source.pushFrame`. Behaves identically to
   * {@link pushFrame} — frames injected here are routed by category.
   */
  sourcePushFrame(frame: Frame, direction: FrameDirection = FrameDirection.Downstream): void {
    this.pushFrame(frame, direction);
  }

  /**
   * Send a `StartFrame` downstream through every processor (triggering
   * `start()` hooks), then begin the queue processing loop.
   */
  async start(): Promise<void> {
    // Walk the chain once synchronously to fire start() lifecycle hooks.
    for (const p of [this.source, ...this.processors, this.sink]) {
      try {
        await p.start();
      } catch (err) {
        this.emitError(err, /* fatal */ true);
      }
    }
    this.running = true;
    // Seed the pipeline with a StartFrame so stages can react to it as a frame.
    this.pushFrame(startFrame(), FrameDirection.Downstream);
    void this.pump();
  }

  /**
   * Send an `EndFrame` downstream, drain remaining frames, then stop the
   * loop. Resolves once the pump has halted.
   */
  async stop(): Promise<void> {
    this.pushFrame(endFrame(), FrameDirection.Downstream);
    // Fire stop() lifecycle hooks.
    for (const p of [this.source, ...this.processors, this.sink]) {
      try {
        await p.stop();
      } catch (err) {
        this.emitError(err, /* fatal */ false);
      }
    }
    this.running = false;
    await this.awaitIdle();
  }

  /**
   * Barge-in. Pushes an `InterruptionFrame` (SystemFrame) so it jumps the
   * queue, calls every processor's `interrupt()` hook, and CLEARS the ordered
   * queue (discarding pending TTS audio / queued text). The system queue is
   * preserved so in-flight system events still propagate.
   */
  async interrupt(): Promise<void> {
    // Clear queued data/control frames — they are now stale.
    this.orderedQueue.length = 0;
    // The InterruptionFrame is a SystemFrame → front of the system queue.
    this.systemQueue.unshift({
      frame: interruptionFrame(),
      direction: FrameDirection.Downstream,
    });
    // Fire interrupt() on every stage so they clear internal buffers.
    for (const p of [this.source, ...this.processors, this.sink]) {
      try {
        await p.interrupt();
      } catch (err) {
        this.emitError(err, /* fatal */ false);
      }
    }
    void this.pump();
  }

  /**
   * The async pump. Drains the system queue to empty, then pulls one frame
   * from the ordered queue, and repeats until both queues are empty. Because
   * `processFrame` is awaited, async stages naturally apply backpressure.
   *
   * Re-entrant calls are coalesced via the `pumping` flag — a second
   * `pushFrame` while one pump is in flight will not start a second loop.
   */
  private async pump(): Promise<void> {
    if (this.pumping) return;
    this.pumping = true;
    try {
      while (this.running || this.hasQueuedFrames()) {
        // Always drain the high-priority system queue first.
        while (this.systemQueue.length > 0) {
          const item = this.systemQueue.shift()!;
          await this.processOne(item);
        }
        // Then pull one ordered-lane frame (if any) and loop back to re-check
        // the system queue — a freshly pushed InterruptionFrame must win.
        if (this.orderedQueue.length > 0) {
          const item = this.orderedQueue.shift()!;
          await this.processOne(item);
        } else if (this.systemQueue.length === 0) {
          // Both queues empty and running — pump is idle until a push wakes it.
          break;
        }
      }
    } finally {
      this.pumping = false;
      this.notifyIdle();
    }
  }

  /** Process a single queued frame through the head processor. */
  private async processOne(item: QueuedFrame): Promise<void> {
    try {
      await this.source.processFrame(item.frame, item.direction);
    } catch (err) {
      this.emitError(err, /* fatal */ false);
    }
  }

  /** True if either lane has pending frames. */
  private hasQueuedFrames(): boolean {
    return this.systemQueue.length > 0 || this.orderedQueue.length > 0;
  }

  /**
   * Emit an `ErrorFrame` upstream (toward the source) so the caller can
   * observe failures. Routed into the system queue for priority handling.
   */
  private emitError(err: unknown, fatal: boolean): void {
    const message =
      err instanceof Error
        ? err.message
        : typeof err === 'string'
          ? err
          : 'Unknown pipeline error';
    this.systemQueue.push({
      frame: errorFrame(message, fatal),
      direction: FrameDirection.Upstream,
    });
    void this.pump();
  }

  /** Resolve any waiter once the pump finishes a pass and is idle. */
  private notifyIdle(): void {
    if (this.idleResolver && !this.hasQueuedFrames() && !this.running) {
      const resolve = this.idleResolver;
      this.idleResolver = null;
      resolve();
    }
  }

  /** Block until the pump has drained and stopped. */
  private awaitIdle(): Promise<void> {
    if (!this.hasQueuedFrames() && !this.running) {
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      this.idleResolver = resolve;
    });
  }
}
