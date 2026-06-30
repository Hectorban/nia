/**
 * @file ElevenLabsTTS.ts
 * @description
 * ElevenLabs streaming text-to-speech via the WebSocket `stream-input` endpoint,
 * reimplemented as a `FrameProcessor`.
 *
 * The protocol mirrors the working implementation in `src/services/elevenlabs.ts`:
 *
 *   1. Open `wss://api.elevenlabs.io/v1/text-to-speech/<voice_id>/stream-input`
 *      with `model_id` and `output_format` query params. The API key is sent in
 *      the initial config message body (`xi_api_key`) — same approach as the
 *      existing service.
 *   2. On open, send the initial config: `{ text: ' ', voice_settings, xi_api_key }`.
 *   3. As `LLMTextFrame`s arrive downstream, send `{ text: <chunk>, try_trigger_generation: true }`.
 *   4. On `LLMFullResponseFrame`, flush with `{ text: '' }` to trigger final generation.
 *   5. Audio arrives as Blob frames → emit `TTSAudioRawFrame` (44100 Hz, mono).
 *      Emit `TTSStartedFrame` on the first audio chunk, `TTSStoppedFrame` when
 *      generation completes (flush acknowledged or connection closed).
 *
 * `interrupt()` closes the WebSocket and resets internal state so a barge-in
 * doesn't continue playing stale audio.
 */

import { FrameProcessor } from '../../FrameProcessor';
import {
  type Frame,
  type LLMTextFrame,
  FrameDirection,
  ttsAudioRaw,
  ttsText,
  ttsStarted,
  ttsStopped,
  error,
} from '../../frames';

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface VoiceSettings {
  stability?: number;
  similarity_boost?: number;
  style?: number;
  use_speaker_boost?: boolean;
}

export interface ElevenLabsTTSOptions {
  /** ElevenLabs API key. */
  apiKey: string;
  /** Target voice id. */
  voiceId: string;
  /** Model id. Defaults to `eleven_flash_v2_5`. */
  modelId?: string;
  /** Output format. Defaults to `pcm_44100` (raw PCM, 44.1 kHz, mono). */
  outputFormat?: string;
  /** Voice settings sent in the initial config. */
  voiceSettings?: VoiceSettings;
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_MODEL_ID = 'eleven_flash_v2_5';
const DEFAULT_OUTPUT_FORMAT = 'pcm_44100';
const DEFAULT_VOICE_SETTINGS: VoiceSettings = {
  stability: 0.5,
  similarity_boost: 0.8,
  style: 0.0,
  use_speaker_boost: true,
};

/** Sample rate for `pcm_44100` output. */
const PCM_SAMPLE_RATE = 44100;
/** Mono output. */
const PCM_NUM_CHANNELS = 1;

// ---------------------------------------------------------------------------
// Processor
// ---------------------------------------------------------------------------

export class ElevenLabsTTS extends FrameProcessor {
  private readonly options: ElevenLabsTTSOptions;
  private ws: WebSocket | null = null;
  private connected = false;
  /** True once we've emitted TTSStartedFrame (on first audio chunk). */
  private ttsStartedEmitted = false;
  /** True after we've sent the flush message; awaiting final audio. */
  private flushing = false;
  /** Accumulated text not yet sent to the WebSocket (sent on sentence/flush). */
  private textBuffer = '';

  constructor(options: ElevenLabsTTSOptions) {
    super();
    this.options = options;
  }

  // -- lifecycle ---------------------------------------------------------

  async start(): Promise<void> {
    await this.openWebSocket();
  }

  async stop(): Promise<void> {
    this.closeWebSocket();
  }

  async interrupt(): Promise<void> {
    // Barge-in: tear down the current connection and reset state so stale
    // queued audio is discarded. A fresh connection will be opened on the
    // next LLMTextFrame (or next start()).
    this.closeWebSocket();
    this.resetState();
  }

  // -- frame handling ----------------------------------------------------

  async processFrame(frame: Frame, direction: FrameDirection): Promise<void> {
    if (direction !== FrameDirection.Downstream) {
      await this.pushFrame(frame, direction);
      return;
    }

    switch (frame.kind) {
      case 'llm-text': {
        const tf = frame as LLMTextFrame;
        // Forward as a TTSTextFrame so downstream stages (e.g. the assistant
        // context aggregator) know what's being spoken.
        await this.pushFrame(ttsText(tf.text), direction);
        await this.handleText(tf.text);
        break;
      }
      case 'llm-full-response': {
        // Flush any buffered text to trigger final TTS generation.
        await this.handleFlush();
        // Forward the full-response frame.
        await this.pushFrame(frame, direction);
        break;
      }
      default: {
        await this.pushFrame(frame, direction);
        break;
      }
    }
  }

  // -- text → WebSocket --------------------------------------------------

  private async handleText(text: string): Promise<void> {
    if (!text) return;

    // Lazily open a connection if start() wasn't called or was interrupted.
    if (!this.ws || !this.connected) {
      await this.openWebSocket();
    }

    this.textBuffer += text;

    // Send on sentence boundaries or when the buffer is reasonably large;
    // ElevenLabs triggers generation per send_text, so chunking at sentence
    // level keeps latency low while avoiding mid-word cuts.
    const sentenceEnd = /[.!?](\s|$)/;
    while (sentenceEnd.test(this.textBuffer)) {
      const match = this.textBuffer.match(sentenceEnd);
      if (!match || match.index === undefined) break;
      const end = match.index + match[0].length;
      const chunk = this.textBuffer.slice(0, end);
      this.textBuffer = this.textBuffer.slice(end);
      this.sendText(chunk);
    }

    // If the buffer has grown large without a sentence boundary, send it
    // anyway to keep the stream flowing.
    if (this.textBuffer.length >= 200) {
      this.sendText(this.textBuffer);
      this.textBuffer = '';
    }
  }

  private async handleFlush(): Promise<void> {
    if (!this.ws || !this.connected) return;

    // Send any remaining buffered text first.
    if (this.textBuffer.length > 0) {
      this.sendText(this.textBuffer);
      this.textBuffer = '';
    }

    // Send the flush message (empty text) to trigger final generation.
    this.ws.send(JSON.stringify({ text: '' }));
    this.flushing = true;
  }

  private sendText(text: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({ text, try_trigger_generation: true }));
  }

  // -- WebSocket management -----------------------------------------------

  private async openWebSocket(): Promise<void> {
    const modelId = this.options.modelId ?? DEFAULT_MODEL_ID;
    const outputFormat = this.options.outputFormat ?? DEFAULT_OUTPUT_FORMAT;
    const wsUrl =
      `wss://api.elevenlabs.io/v1/text-to-speech/${this.options.voiceId}/stream-input` +
      `?model_id=${encodeURIComponent(modelId)}` +
      `&output_format=${encodeURIComponent(outputFormat)}`;

    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(wsUrl);
      this.ws = ws;

      let settled = false;
      const timeout = setTimeout(() => {
        if (!settled) {
          settled = true;
          reject(new Error('ElevenLabs TTS connection timeout'));
        }
      }, 10_000);

      ws.onopen = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        this.connected = true;
        this.sendInitialConfig();
        resolve();
      };

      ws.onmessage = (event) => this.handleWebSocketMessage(event);

      ws.onerror = () => {
        if (!settled) {
          settled = true;
          clearTimeout(timeout);
          reject(new Error('ElevenLabs TTS WebSocket error'));
        } else {
          this.pushFrame(error('ElevenLabs TTS WebSocket error', false), FrameDirection.Upstream);
        }
      };

      ws.onclose = () => {
        this.connected = false;
        // If we were flushing or had started, signal completion.
        if (this.ttsStartedEmitted) {
          this.emitTTSStopped();
        }
        this.resetState();
      };
    });
  }

  private sendInitialConfig(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const config = {
      text: ' ',
      voice_settings: this.options.voiceSettings ?? DEFAULT_VOICE_SETTINGS,
      xi_api_key: this.options.apiKey,
    };
    this.ws.send(JSON.stringify(config));
  }

  private async handleWebSocketMessage(event: MessageEvent): Promise<void> {
    if (event.data instanceof Blob) {
      // Raw audio chunk.
      const arrayBuffer = await event.data.arrayBuffer();
      this.emitAudioChunk(arrayBuffer);
      return;
    }

    // Non-blob message — parse as JSON (status / error / completion signal).
    let message: Record<string, unknown>;
    try {
      message = JSON.parse(event.data as string) as Record<string, unknown>;
    } catch {
      return;
    }

    // ElevenLabs may send an `isFinal` flag or a completion event. When we're
    // flushing and receive such a signal, emit TTSStoppedFrame.
    if (this.flushing) {
      const isFinal = message.isFinal === true || message.is_final === true;
      if (isFinal || message.event === 'final') {
        this.emitTTSStopped();
        this.flushing = false;
      }
    }

    if (typeof message.error === 'string') {
      this.pushFrame(error(`ElevenLabs TTS: ${message.error}`, false), FrameDirection.Upstream);
    }
  }

  private emitAudioChunk(audio: ArrayBuffer): void {
    if (!this.ttsStartedEmitted) {
      this.ttsStartedEmitted = true;
      this.pushFrame(ttsStarted(), FrameDirection.Downstream);
    }
    this.pushFrame(
      ttsAudioRaw(audio, PCM_SAMPLE_RATE, PCM_NUM_CHANNELS),
      FrameDirection.Downstream,
    );
  }

  private emitTTSStopped(): void {
    if (this.ttsStartedEmitted) {
      this.ttsStartedEmitted = false;
      this.pushFrame(ttsStopped(), FrameDirection.Downstream);
    }
  }

  private closeWebSocket(): void {
    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onerror = null;
      this.ws.onclose = null;
      if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
        this.ws.close();
      }
      this.ws = null;
    }
    this.connected = false;
  }

  private resetState(): void {
    this.textBuffer = '';
    this.ttsStartedEmitted = false;
    this.flushing = false;
  }
}
