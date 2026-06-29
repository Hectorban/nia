/**
 * @file FrameProcessor.ts
 * @description
 * The base class for every pipeline stage — STT, LLM, TTS, transport,
 * context aggregator, etc. This is the single contract the rest of the
 * pipeline depends on, directly modeled on pipecat's `FrameProcessor`.
 *
 * A `FrameProcessor` sits in a linked list. Each processor holds `prev`/`next`
 * pointers (wired up by `Pipeline`) and implements `processFrame(frame,
 * direction)`. When it wants to pass a frame along the chain it calls the
 * protected `pushFrame` helper, which forwards to `next` (downstream) or
 * `prev` (upstream). Stages that only inspect frames can simply not push.
 *
 * Lifecycle hooks (`start`, `stop`, `interrupt`) are invoked by the `Pipeline`
 * on StartFrame/EndFrame/InterruptionFrame so stages can allocate or release
 * resources and clear buffered state on barge-in. Default implementations are
 * no-ops, so a stage overrides only what it needs.
 */

import { Frame, FrameDirection } from './frames';

/**
 * Abstract base for all pipeline stages.
 *
 * Subclasses implement `processFrame` and, optionally, `start`/`stop`/
 * `interrupt`. They forward frames along the chain via the protected
 * `pushFrame` helper rather than touching `prev`/`next` directly.
 */
export abstract class FrameProcessor {
  /** The processor immediately upstream, or null if this is the head. */
  protected prev: FrameProcessor | null = null;

  /** The processor immediately downstream, or null if this is the tail. */
  protected next: FrameProcessor | null = null;

  /**
   * Link management — called by `Pipeline` while wiring up the chain.
   * Not intended for external callers.
   */
  setPrev(p: FrameProcessor | null): void {
    this.prev = p;
  }

  setNext(n: FrameProcessor | null): void {
    this.next = n;
  }

  /**
   * The main contract every stage implements.
   *
   * @param frame     The incoming frame.
   * @param direction Travel direction. `Downstream` means toward the sink,
   *                  `Upstream` means toward the source.
   */
  abstract processFrame(frame: Frame, direction: FrameDirection): Promise<void>;

  /**
   * Push a frame to the adjacent processor in the given direction.
   *
   * If there is no neighbour in that direction (e.g. this is the head/tail),
   * the frame is silently dropped — the pipeline edges act as terminators.
   */
  protected async pushFrame(
    frame: Frame,
    direction: FrameDirection,
  ): Promise<void> {
    if (direction === FrameDirection.Downstream && this.next) {
      await this.next.processFrame(frame, direction);
    } else if (direction === FrameDirection.Upstream && this.prev) {
      await this.prev.processFrame(frame, direction);
    }
  }

  /**
   * Lifecycle hook — invoked by `Pipeline` when a `StartFrame` propagates.
   * Allocate resources, open sessions, etc. Default is a no-op.
   */
  async start(): Promise<void> {}

  /**
   * Lifecycle hook — invoked by `Pipeline` when an `EndFrame` propagates.
   * Release resources, flush buffers, etc. Default is a no-op.
   */
  async stop(): Promise<void> {}

  /**
   * Interruption hook — invoked by `Pipeline` when an `InterruptionFrame`
   * propagates (barge-in). Stages holding buffered media (e.g. queued TTS
   * audio) should clear it here so the user's new utterance isn't talked over.
   * Default is a no-op.
   */
  async interrupt(): Promise<void> {}
}
