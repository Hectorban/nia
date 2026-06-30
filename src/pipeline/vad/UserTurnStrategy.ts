/**
 * @file UserTurnStrategy.ts
 * @description
 * Pluggable user-turn-end strategy.
 *
 * With ElevenLabs STT using `commit_strategy=vad`, the STT server detects
 * speech boundaries and sends a committed transcript when the user finishes
 * speaking; `ContextAggregatorUser` converts that into a `UserTurnEndedFrame`.
 * In that default setup no extra turn-end logic is needed.
 *
 * `TimeoutTurnStrategy` is a safety-net fallback: if no committed transcript
 * arrives within `timeoutMs` after the last partial transcript, it emits a
 * `UserTurnEndedFrame` itself. This catches edge cases the server-side VAD
 * misses (e.g. very short utterances). It is opt-in via pipeline config.
 */

import { FrameProcessor } from '../FrameProcessor';
import { Frame, FrameDirection, TranscriptionFrame, userTurnEnded } from '../frames';

export interface UserTurnStrategyOptions {
  /** Timeout (ms) after the last partial transcript with no new input (default 1500). */
  timeoutMs?: number;
}

/**
 * Fallback turn-end strategy: emit `UserTurnEndedFrame` if no committed
 * (final) transcript arrives within `timeoutMs` after the last partial.
 */
export class TimeoutTurnStrategy extends FrameProcessor {
  private readonly options: Required<UserTurnStrategyOptions>;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private lastPartialText = '';

  constructor(options: UserTurnStrategyOptions = {}) {
    super();
    this.options = { timeoutMs: 1500, ...options };
  }

  async processFrame(frame: Frame, direction: FrameDirection): Promise<void> {
    if (direction === FrameDirection.Downstream && frame.kind === 'transcription') {
      const tf = frame as TranscriptionFrame;
      if (!tf.isFinal) {
        // Reset the timeout on each partial — we're still mid-utterance.
        this.lastPartialText = tf.text;
        this.resetTimer();
      } else {
        // Final transcript — ContextAggregatorUser emits the turn-end frame.
        this.clearTimer();
      }
    }
    await this.pushFrame(frame, direction);
  }

  private resetTimer(): void {
    this.clearTimer();
    this.timer = setTimeout(() => {
      this.timer = null;
      if (this.lastPartialText.trim().length > 0) {
        void this.pushFrame(userTurnEnded(), FrameDirection.Downstream);
      }
    }, this.options.timeoutMs);
  }

  private clearTimer(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  async stop(): Promise<void> {
    this.clearTimer();
  }

  async interrupt(): Promise<void> {
    this.clearTimer();
    this.lastPartialText = '';
  }
}
