/**
 * @file SpeakerSink.ts
 * @description
 * Transport-layer sink: receives `TTSAudioRawFrame`s and plays them through
 * the speakers via Web Audio. Expects raw PCM Int16 (ElevenLabs streaming TTS
 * with `output_format=pcm_44100`); each chunk is converted to Float32 and
 * scheduled back-to-back for gapless playback.
 *
 * Interrupt-aware: `interrupt()` clears the queued audio and resets the
 * schedule so a barge-in doesn't get talked over. Already-scheduled
 * AudioBufferSourceNodes can't be cheaply cancelled from here, so we also track
 * active sources and stop them immediately on interrupt.
 */

import { FrameProcessor } from '../FrameProcessor';
import { Frame, FrameDirection } from '../frames';

export interface SpeakerSinkOptions {
  /** Specific output device id, if the platform supports routing. */
  deviceId?: string;
  /** Playback sample rate (typically 44100 for ElevenLabs PCM). */
  sampleRate?: number;
}

interface QueuedAudio {
  audio: ArrayBuffer;
  sampleRate: number;
  numChannels: number;
}

export class SpeakerSink extends FrameProcessor {
  private audioContext: AudioContext | null = null;
  private options: SpeakerSinkOptions;
  private audioQueue: QueuedAudio[] = [];
  private isPlaying = false;
  private nextPlayTime = 0;
  private outputDeviceId: string | null = null;
  private gainNode: GainNode | null = null;
  private volume = 1.0;
  /** Active source nodes, tracked so interrupt() can stop them mid-playback. */
  private activeSources: Set<AudioBufferSourceNode> = new Set();

  constructor(options: SpeakerSinkOptions = {}) {
    super();
    this.options = { sampleRate: 44100, ...options };
    this.outputDeviceId = options.deviceId ?? null;
  }

  async start(): Promise<void> {
    this.audioContext = new AudioContext({ sampleRate: this.options.sampleRate });
    this.gainNode = this.audioContext.createGain();
    this.gainNode.gain.value = this.volume;
    this.gainNode.connect(this.audioContext.destination);
    // setSinkId on AudioContext is not widely available in WebView/Tauri;
    // see changeDevice() for the caveat.
    if (this.outputDeviceId) {
      this.setSinkId(this.outputDeviceId);
    }
  }

  async stop(): Promise<void> {
    this.audioQueue = [];
    this.isPlaying = false;
    this.nextPlayTime = 0;
    this.activeSources.forEach((s) => {
      try {
        s.onended = null;
        s.stop();
      } catch {
        /* already stopped */
      }
    });
    this.activeSources.clear();
    if (this.audioContext) {
      await this.audioContext.close();
      this.audioContext = null;
    }
    this.gainNode = null;
  }

  async interrupt(): Promise<void> {
    // Barge-in: drop queued TTS and stop anything currently sounding.
    this.audioQueue = [];
    this.isPlaying = false;
    this.nextPlayTime = 0;
    this.activeSources.forEach((s) => {
      try {
        s.onended = null;
        s.stop();
      } catch {
        /* already stopped */
      }
    });
    this.activeSources.clear();
  }

  async processFrame(frame: Frame, direction: FrameDirection): Promise<void> {
    if (
      direction === FrameDirection.Downstream &&
      frame.kind === 'tts-audio-raw'
    ) {
      const { audio, sampleRate, numChannels } = frame as {
        audio: ArrayBuffer;
        sampleRate: number;
        numChannels: number;
      };
      this.enqueueAudio(audio, sampleRate, numChannels);
    }
    // The sink is transparent: forward every frame both ways.
    await this.pushFrame(frame, direction);
  }

  private enqueueAudio(
    audio: ArrayBuffer,
    sampleRate: number,
    numChannels: number,
  ): void {
    this.audioQueue.push({ audio, sampleRate, numChannels });
    if (!this.isPlaying) {
      void this.playQueue();
    }
  }

  private async playQueue(): Promise<void> {
    if (!this.audioContext || !this.gainNode) return;
    this.isPlaying = true;

    while (this.audioQueue.length > 0) {
      const item = this.audioQueue.shift()!;
      await this.playChunk(item.audio, item.sampleRate, item.numChannels);
    }

    this.isPlaying = false;
    this.nextPlayTime = 0;
  }

  private playChunk(
    audio: ArrayBuffer,
    sampleRate: number,
    numChannels: number,
  ): Promise<void> {
    return new Promise((resolve) => {
      if (!this.audioContext || !this.gainNode) {
        resolve();
        return;
      }

      // Raw Int16 PCM → Float32, downmixing to mono if needed.
      const int16 = new Int16Array(audio);
      const frameCount = Math.floor(int16.length / numChannels);
      const float32 = new Float32Array(frameCount);

      if (numChannels === 1) {
        for (let i = 0; i < frameCount; i++) {
          float32[i] = int16[i] / 0x8000;
        }
      } else {
        for (let i = 0; i < frameCount; i++) {
          let sum = 0;
          for (let ch = 0; ch < numChannels; ch++) {
            sum += int16[i * numChannels + ch] / 0x8000;
          }
          float32[i] = sum / numChannels;
        }
      }

      const audioBuffer = this.audioContext.createBuffer(
        1,
        float32.length,
        sampleRate,
      );
      audioBuffer.copyToChannel(float32, 0);

      const source = this.audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.gainNode);

      // Schedule back-to-back for gapless playback.
      const now = this.audioContext.currentTime;
      const startTime = Math.max(this.nextPlayTime, now);
      source.start(startTime);
      this.nextPlayTime = startTime + audioBuffer.duration;

      this.activeSources.add(source);
      source.onended = () => {
        this.activeSources.delete(source);
        resolve();
      };
    });
  }

  /** Set the master output volume (0–1). */
  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
    if (this.gainNode) {
      this.gainNode.gain.value = this.volume;
    }
  }

  /** Get the current master volume (0–1). */
  getVolume(): number {
    return this.volume;
  }

  async changeDevice(deviceId: string): Promise<void> {
    this.outputDeviceId = deviceId;
    this.setSinkId(deviceId);
  }

  private setSinkId(deviceId: string): void {
    // setSinkId is available on HTMLAudioElement, not on AudioContext, in most
    // browsers/WebView. Routing AudioContext output to a specific device would
    // require an HTMLAudioElement + MediaElementSource fallback. For now we
    // log; device selection for the sink is a known limitation.
    console.warn(
      'SpeakerSink: AudioContext output-device selection not implemented; using default device',
      deviceId,
    );
  }
}
