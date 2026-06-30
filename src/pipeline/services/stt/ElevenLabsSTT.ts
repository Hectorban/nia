/**
 * @file ElevenLabsSTT.ts
 * @description
 * ElevenLabs Scribe v2 Realtime speech-to-text, implemented as a
 * `FrameProcessor`. Audio arriving as `InputAudioRawFrame` (downstream) is
 * base64-encoded and streamed over a WebSocket to ElevenLabs; transcriptions
 * come back as `TranscriptionFrame`s (partial + final) pushed downstream.
 *
 * Because a browser WebSocket cannot set custom headers, authentication uses a
 * single-use token fetched via REST (`POST /v1/tokens/single-use` with the
 * `xi-api-key` header). The token is short-lived (~15 min) and passed as a
 * query parameter on the WebSocket URL. For a personal desktop app this keeps
 * the API key out of the WebSocket URL itself.
 */

import { FrameProcessor } from '../../FrameProcessor';
import {
  type Frame,
  type InputAudioRawFrame,
  FrameDirection,
  transcription,
  error,
} from '../../frames';

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface ElevenLabsSTTOptions {
  /** ElevenLabs API key (used to mint single-use tokens). */
  apiKey: string;
  /** Scribe model id. Defaults to `scribe_v2_realtime`. */
  modelId?: string;
  /** ISO language code (e.g. `es`, `en`). Omit for auto-detect. */
  languageCode?: string;
  /** Request per-word timestamps in the transcript. */
  includeTimestamps?: boolean;
  /** VAD silence threshold in seconds (0.3–3, default 1.5). */
  vadSilenceThresholdSecs?: number;
  /** VAD speech probability threshold (0.1–0.9, default 0.4). */
  vadThreshold?: number;
  /** Minimum speech duration in ms (50–2000, default 100). */
  minSpeechDurationMs?: number;
  /** Minimum silence duration in ms (50–2000, default 100). */
  minSilenceDurationMs?: number;
  /** Up to 50 biasing terms, max 20 chars each. */
  keyterms?: string[];
  /** Strip filler words from the transcript. */
  noVerbatim?: boolean;
}

// ---------------------------------------------------------------------------
// Wire types (server ↔ client messages)
// ---------------------------------------------------------------------------

interface ServerMessage {
  event: string;
  text?: string;
  language_code?: string;
  error?: { message?: string };
}

// ---------------------------------------------------------------------------
// Processor
// ---------------------------------------------------------------------------

export class ElevenLabsSTT extends FrameProcessor {
  private readonly options: ElevenLabsSTTOptions;
  private ws: WebSocket | null = null;
  private sessionStarted = false;

  constructor(options: ElevenLabsSTTOptions) {
    super();
    this.options = { modelId: 'scribe_v2_realtime', ...options };
  }

  // -- lifecycle ---------------------------------------------------------

  async start(): Promise<void> {
    const token = await this.fetchToken();

    const params = new URLSearchParams({
      model_id: this.options.modelId!,
      token,
      commit_strategy: 'vad',
      audio_format: 'pcm_16000',
    });
    if (this.options.languageCode) {
      params.set('language_code', this.options.languageCode);
    }
    if (this.options.includeTimestamps) {
      params.set('include_timestamps', 'true');
    }
    if (this.options.vadSilenceThresholdSecs !== undefined) {
      params.set('vad_silence_threshold_secs', String(this.options.vadSilenceThresholdSecs));
    }
    if (this.options.vadThreshold !== undefined) {
      params.set('vad_threshold', String(this.options.vadThreshold));
    }
    if (this.options.minSpeechDurationMs !== undefined) {
      params.set('min_speech_duration_ms', String(this.options.minSpeechDurationMs));
    }
    if (this.options.minSilenceDurationMs !== undefined) {
      params.set('min_silence_duration_ms', String(this.options.minSilenceDurationMs));
    }
    if (this.options.keyterms?.length) {
      params.set('keyterms', JSON.stringify(this.options.keyterms));
    }
    if (this.options.noVerbatim) {
      params.set('no_verbatim', 'true');
    }

    const wsUrl = `wss://api.elevenlabs.io/v1/speech-to-text/realtime?${params.toString()}`;

    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(wsUrl);
      this.ws = ws;

      let settled = false;
      const timeout = setTimeout(() => {
        if (!settled) {
          settled = true;
          reject(new Error('ElevenLabs STT session start timeout'));
        }
      }, 10_000);

      ws.onmessage = (event) => {
        let data: ServerMessage;
        try {
          data = JSON.parse(event.data as string) as ServerMessage;
        } catch {
          return;
        }
        if (data.event === 'session_started') {
          if (!settled) {
            settled = true;
            clearTimeout(timeout);
            this.sessionStarted = true;
            resolve();
          }
          return;
        }
        this.handleMessage(data);
      };

      ws.onerror = () => {
        if (!settled) {
          settled = true;
          clearTimeout(timeout);
          reject(new Error('ElevenLabs STT WebSocket error'));
        } else {
          this.pushFrame(
            error('ElevenLabs STT WebSocket error', false),
            FrameDirection.Upstream,
          );
        }
      };

      ws.onclose = () => {
        this.sessionStarted = false;
      };
    });
  }

  async stop(): Promise<void> {
    if (this.ws) {
      this.ws.onmessage = null;
      this.ws.onerror = null;
      this.ws.onclose = null;
      if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
        this.ws.close();
      }
      this.ws = null;
    }
    this.sessionStarted = false;
  }

  async interrupt(): Promise<void> {
    // STT keeps listening on barge-in — no-op by design.
  }

  // -- frame handling ----------------------------------------------------

  async processFrame(frame: Frame, direction: FrameDirection): Promise<void> {
    // Forward every frame transparently.
    await this.pushFrame(frame, direction);

    // Consume downstream input audio and relay it to the STT WebSocket.
    if (direction === FrameDirection.Downstream && frame.kind === 'input-audio-raw') {
      const audioFrame = frame as InputAudioRawFrame;
      this.sendAudioChunk(audioFrame.audio);
    }
  }

  // -- internals ---------------------------------------------------------

  private async fetchToken(): Promise<string> {
    const response = await fetch('https://api.elevenlabs.io/v1/tokens/single-use', {
      method: 'POST',
      headers: {
        'xi-api-key': this.options.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ service: 'realtime_scribe' }),
    });
    if (!response.ok) {
      throw new Error(
        `Failed to fetch ElevenLabs STT token: ${response.status} ${response.statusText}`,
      );
    }
    const data = (await response.json()) as { token: string };
    return data.token;
  }

  private handleMessage(data: ServerMessage): void {
    switch (data.event) {
      case 'partial_transcript':
        this.pushFrame(
          transcription(data.text ?? '', false, data.language_code),
          FrameDirection.Downstream,
        );
        break;
      case 'committed_transcript':
        this.pushFrame(
          transcription(data.text ?? '', true, data.language_code),
          FrameDirection.Downstream,
        );
        break;
      case 'scribe_error':
        console.error('ElevenLabs STT error:', data.error);
        this.pushFrame(
          error(`ElevenLabs STT: ${data.error?.message ?? 'unknown error'}`, false),
          FrameDirection.Upstream,
        );
        break;
      default:
        // Unknown events are ignored — the protocol may add new ones.
        break;
    }
  }

  private sendAudioChunk(audio: ArrayBuffer): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !this.sessionStarted) return;
    const base64 = this.arrayBufferToBase64(audio);
    this.ws.send(JSON.stringify({ event: 'input_audio_chunk', audio: base64 }));
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    const chunkSize = 0x8000; // 32 KB — avoid call-stack limits on large buffers.
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const slice = bytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode(...slice);
    }
    return btoa(binary);
  }
}
