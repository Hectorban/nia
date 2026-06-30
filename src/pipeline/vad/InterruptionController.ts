/**
 * @file InterruptionController.ts
 * @description
 * Watches for user speech (`UserStartedSpeakingFrame`) that occurs while the
 * bot is speaking (between `BotTurnStartedFrame` and `BotTurnEndedFrame`) and
 * triggers an `InterruptionFrame` to stop TTS playback — i.e. barge-in.
 *
 * The bot-speaking window is tracked by observing the downstream control
 * frames. When the user starts speaking inside that window, the controller:
 *   1. emits an `InterruptionFrame` downstream (so downstream stages react),
 *   2. invokes the optional `onInterrupt` callback (typically wired to
 *      `Pipeline.interrupt()` to clear the ordered queue and stop TTS).
 */

import { FrameProcessor } from '../FrameProcessor';
import { Frame, FrameDirection, interruption } from '../frames';

export interface InterruptionControllerOptions {
  /**
   * Called when barge-in is detected — usually `Pipeline.interrupt()`, which
   * clears the ordered queue and flushes queued media.
   */
  onInterrupt?: () => void | Promise<void>;
}

/**
 * Emits `InterruptionFrame` and invokes the interrupt callback when the user
 * starts speaking while the bot is talking.
 */
export class InterruptionController extends FrameProcessor {
  private readonly options: InterruptionControllerOptions;
  private botSpeaking = false;

  constructor(options: InterruptionControllerOptions = {}) {
    super();
    this.options = options;
  }

  async processFrame(frame: Frame, direction: FrameDirection): Promise<void> {
    if (direction === FrameDirection.Downstream) {
      switch (frame.kind) {
        case 'bot-turn-started':
          this.botSpeaking = true;
          break;
        case 'bot-turn-ended':
          this.botSpeaking = false;
          break;
        case 'user-started-speaking':
          if (this.botSpeaking) {
            await this.triggerInterruption();
          }
          break;
        default:
          break;
      }
    }
    // Forward all frames, including the emitted InterruptionFrame, downstream.
    await this.pushFrame(frame, direction);
  }

  private async triggerInterruption(): Promise<void> {
    await this.pushFrame(interruption(), FrameDirection.Downstream);
    if (this.options.onInterrupt) {
      await this.options.onInterrupt();
    }
  }

  async interrupt(): Promise<void> {
    this.botSpeaking = false;
  }
}
