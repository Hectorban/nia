/**
 * @file RMSVAD.ts
 * @description
 * A simple RMS-based Voice Activity Detector FrameProcessor. It watches
 * `InputAudioRawFrame`s passing downstream, computes their RMS volume, and
 * emits `UserStartedSpeakingFrame` / `UserStoppedSpeakingFrame` when speech
 * starts and stops.
 *
 * This is intentionally lightweight — no model, no WASM, no worker. It exists
 * to power interruption / barge-in detection when the bot is talking (see
 * `InterruptionController`). Turn endpointing itself is handled by the STT
 * server (ElevenLabs `commit_strategy=vad`) and `ContextAggregatorUser`, so
 * this VAD does not need to be highly accurate — it only needs to reliably
 * notice that the user has started talking.
 */

import { FrameProcessor } from '../FrameProcessor';
import {
  Frame,
  FrameDirection,
  InputAudioRawFrame,
  userStartedSpeaking,
  userStoppedSpeaking,
} from '../frames';

export interface RMSVADOptions {
  /** RMS threshold (0-1) above which a frame is considered "speech" (default 0.02). */
  threshold?: number;
  /** Consecutive above-threshold frames required to confirm speech start (default 3). */
  startFrames?: number;
  /** Consecutive below-threshold frames required to confirm speech stop (default 15, ~300ms at 20ms frames). */
  stopFrames?: number;
}

/**
 * RMS-based Voice Activity Detector.
 *
 * Emits `UserStartedSpeakingFrame` after `startFrames` consecutive above-threshold
 * audio frames, and `UserStoppedSpeakingFrame` after `stopFrames` consecutive
 * below-threshold frames. Audio is assumed to be 16-bit PCM in the
 * `InputAudioRawFrame.audio` `ArrayBuffer`.
 */
export class RMSVAD extends FrameProcessor {
  private readonly options: Required<RMSVADOptions>;
  private isSpeaking = false;
  private aboveThresholdCount = 0;
  private belowThresholdCount = 0;

  constructor(options: RMSVADOptions = {}) {
    super();
    this.options = {
      threshold: 0.02,
      startFrames: 3,
      stopFrames: 15,
      ...options,
    };
  }

  async processFrame(frame: Frame, direction: FrameDirection): Promise<void> {
    // Forward every frame unmodified — this processor only observes.
    await this.pushFrame(frame, direction);

    if (direction === FrameDirection.Downstream && frame.kind === 'input-audio-raw') {
      const rms = this.computeRMS((frame as InputAudioRawFrame).audio);
      this.analyzeRMS(rms);
    }
  }

  /** Compute the RMS of 16-bit PCM samples, normalized to [-1, 1]. */
  private computeRMS(audio: ArrayBuffer): number {
    const view = new Int16Array(audio);
    if (view.length === 0) return 0;
    let sum = 0;
    for (let i = 0; i < view.length; i++) {
      const sample = view[i] / 0x8000; // normalize to [-1, 1]
      sum += sample * sample;
    }
    return Math.sqrt(sum / view.length);
  }

  /** Apply hysteresis counters to the latest RMS reading and emit state-change frames. */
  private analyzeRMS(rms: number): void {
    if (rms >= this.options.threshold) {
      this.aboveThresholdCount++;
      this.belowThresholdCount = 0;
      if (!this.isSpeaking && this.aboveThresholdCount >= this.options.startFrames) {
        this.isSpeaking = true;
        void this.pushFrame(userStartedSpeaking(), FrameDirection.Downstream);
      }
    } else {
      this.belowThresholdCount++;
      this.aboveThresholdCount = 0;
      if (this.isSpeaking && this.belowThresholdCount >= this.options.stopFrames) {
        this.isSpeaking = false;
        void this.pushFrame(userStoppedSpeaking(), FrameDirection.Downstream);
      }
    }
  }

  /** Current speaking state (for introspection / testing). */
  getIsSpeaking(): boolean {
    return this.isSpeaking;
  }

  async interrupt(): Promise<void> {
    this.isSpeaking = false;
    this.aboveThresholdCount = 0;
    this.belowThresholdCount = 0;
  }
}
