/**
 * @file MicSource.ts
 * @description
 * Transport-layer source: captures microphone audio via an AudioWorklet and
 * emits `InputAudioRawFrame`s downstream. The worklet (see
 * `audio-worklet-processor.js`) resamples to 16kHz mono Int16 PCM — the format
 * ElevenLabs STT expects (`audio_format=pcm_16000`).
 *
 * The worklet is intentionally NOT connected to `audioContext.destination` —
 * we never want to hear the local mic through the speakers.
 */

import { FrameProcessor } from '../FrameProcessor';
import { Frame, FrameDirection, inputAudioRaw } from '../frames';

export interface MicSourceOptions {
  /** Specific input device; omit for default. */
  deviceId?: string;
  /** Target sample rate for the emitted PCM (default 16000). */
  sampleRate?: number;
  echoCancellation?: boolean;
  noiseSuppression?: boolean;
  autoGainControl?: boolean;
}

export class MicSource extends FrameProcessor {
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private options: MicSourceOptions;
  private volume = 0;

  constructor(options: MicSourceOptions = {}) {
    super();
    this.options = {
      sampleRate: 16000,
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      ...options,
    };
  }

  async start(): Promise<void> {
    // 1. Create AudioContext at the device rate (typically 48000); the worklet
    //    resamples down to the target rate.
    this.audioContext = new AudioContext({ sampleRate: 48000 });

    // 2. Load the worklet module. `import.meta.url` lets Vite resolve & bundle
    //    the .js file relative to this source file.
    await this.audioContext.audioWorklet.addModule(
      new URL('./audio-worklet-processor.js', import.meta.url),
    );

    // 3. Get the microphone stream.
    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        deviceId: this.options.deviceId ? { exact: this.options.deviceId } : undefined,
        echoCancellation: this.options.echoCancellation,
        noiseSuppression: this.options.noiseSuppression,
        autoGainControl: this.options.autoGainControl,
        channelCount: 1,
      },
    });

    // 4. Create the worklet node.
    this.workletNode = new AudioWorkletNode(
      this.audioContext,
      'audio-capture-processor',
    );

    // 5. Wire mic → worklet. Do NOT connect worklet → destination.
    this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);
    this.sourceNode.connect(this.workletNode);

    // 6. Listen for resampled PCM chunks from the worklet and push them
    //    downstream as input-audio-raw frames.
    this.workletNode.port.onmessage = (event) => {
      const { audio, sampleRate } = event.data as {
        audio: ArrayBuffer;
        sampleRate: number;
      };
      this.updateVolume(audio);
      void this.pushFrame(
        inputAudioRaw(audio, sampleRate, 1),
        FrameDirection.Downstream,
      );
    };
  }

  async stop(): Promise<void> {
    if (this.workletNode) {
      this.workletNode.port.onmessage = null;
      this.workletNode.disconnect();
      this.workletNode = null;
    }
    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((t) => t.stop());
      this.mediaStream = null;
    }
    if (this.audioContext) {
      await this.audioContext.close();
      this.audioContext = null;
    }
    this.volume = 0;
  }

  /** Current mic level (0–1) for UI visualization. */
  getVolume(): number {
    return this.volume;
  }

  private updateVolume(pcmBuffer: ArrayBuffer): void {
    // RMS of the Int16 PCM, normalised to [-1, 1].
    const view = new Int16Array(pcmBuffer);
    let sum = 0;
    for (let i = 0; i < view.length; i++) {
      const sample = view[i] / 0x8000;
      sum += sample * sample;
    }
    const rms = Math.sqrt(sum / view.length);
    this.volume = Math.min(1, rms * 2); // scale up for visualization
  }

  async processFrame(frame: Frame, direction: FrameDirection): Promise<void> {
    // MicSource is a source — it doesn't receive frames from upstream. Forward
    // anything that arrives (e.g. an EndFrame) so the chain stays consistent.
    // InterruptionFrame needs no special handling: the mic keeps recording.
    await this.pushFrame(frame, direction);
  }

  /** Switch input device on the fly, restarting capture if currently running. */
  async changeDevice(deviceId: string): Promise<void> {
    const wasRunning = this.audioContext !== null;
    if (wasRunning) {
      await this.stop();
      this.options.deviceId = deviceId;
      await this.start();
    } else {
      this.options.deviceId = deviceId;
    }
  }
}
