/**
 * @file frames.ts
 * @description
 * The Frame type system — the currency of the pipeline. A `Frame` is a
 * discriminated union of everything that can flow between pipeline stages:
 * raw audio, transcriptions, LLM text, TTS audio, and lifecycle/control signals.
 *
 * Frames are split into three categories mirroring pipecat's two-lane queue:
 *
 * 1. SystemFrames  — high-priority lane. Bypass interruption clearing and
 *                    jump ahead of queued media (e.g. InterruptionFrame for
 *                    barge-in, raw input audio that must stay low-latency).
 * 2. DataFrames    — ordered lane. The actual media/text content that the
 *                    pipeline transforms (transcription → LLM text → TTS audio).
 * 3. ControlFrames — ordered lane. Lifecycle signals (StartFrame, turn
 *                    boundaries, TTS start/stop) that ride in-order with data.
 *
 * Every frame carries an auto-generated `id`, a `kind` discriminant, and a
 * `timestamp` so stages and observers can trace, deduplicate, and order events
 * without relying on wall-clock arrival time alone.
 */

// ---------------------------------------------------------------------------
// ID generation
// ---------------------------------------------------------------------------

/**
 * Generate a unique frame identifier.
 * Uses `crypto.randomUUID()` when the Web Crypto API is available (secure
 * context / Node 19+), with a Math.random fallback for older environments.
 */
export function createFrameId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback: 36-char pseudo-UUID v4 shape.
  const hex = '0123456789abcdef';
  let id = '';
  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) {
      id += '-';
    } else if (i === 14) {
      id += '4';
    } else if (i === 19) {
      id += hex[(Math.random() * 4) | (0 + 8)];
    } else {
      id += hex[(Math.random() * 16) | 0];
    }
  }
  return id;
}

// ---------------------------------------------------------------------------
// Shared base
// ---------------------------------------------------------------------------

/** Fields present on every frame regardless of category. */
export interface BaseFrame {
  /** Unique identifier (auto-generated). */
  id: string;
  /** Discriminant string — use this in `switch` statements to narrow a Frame. */
  kind: string;
  /** Wall-clock time the frame was created (ms since epoch). */
  timestamp: number;
}

// ---------------------------------------------------------------------------
// SystemFrames — high-priority lane
// ---------------------------------------------------------------------------

export interface InputAudioRawFrame extends BaseFrame {
  kind: 'input-audio-raw';
  audio: ArrayBuffer;
  sampleRate: number;
  numChannels: number;
}

export interface UserStartedSpeakingFrame extends BaseFrame {
  kind: 'user-started-speaking';
}

export interface UserStoppedSpeakingFrame extends BaseFrame {
  kind: 'user-stopped-speaking';
}

export interface InterruptionFrame extends BaseFrame {
  kind: 'interruption';
}

export interface ErrorFrame extends BaseFrame {
  kind: 'error';
  error: string;
  fatal: boolean;
}

export type SystemFrame =
  | InputAudioRawFrame
  | UserStartedSpeakingFrame
  | UserStoppedSpeakingFrame
  | InterruptionFrame
  | ErrorFrame;

// ---------------------------------------------------------------------------
// DataFrames — ordered lane, media/text content
// ---------------------------------------------------------------------------

export interface TranscriptionFrame extends BaseFrame {
  kind: 'transcription';
  text: string;
  isFinal: boolean;
  language?: string;
}

export interface LLMTextFrame extends BaseFrame {
  kind: 'llm-text';
  /** A streamed LLM token or chunk. */
  text: string;
}

export interface LLMFullResponseFrame extends BaseFrame {
  kind: 'llm-full-response';
  /** The complete LLM response, assembled. */
  text: string;
}

export interface TTSAudioRawFrame extends BaseFrame {
  kind: 'tts-audio-raw';
  audio: ArrayBuffer;
  sampleRate: number;
  numChannels: number;
}

export interface TTSTextFrame extends BaseFrame {
  kind: 'tts-text';
  /** The text that was actually spoken (may differ from LLM output). */
  text: string;
}

export type DataFrame =
  | TranscriptionFrame
  | LLMTextFrame
  | LLMFullResponseFrame
  | TTSAudioRawFrame
  | TTSTextFrame;

// ---------------------------------------------------------------------------
// ControlFrames — ordered lane, lifecycle signals
// ---------------------------------------------------------------------------

export interface StartFrame extends BaseFrame {
  kind: 'start';
}

export interface EndFrame extends BaseFrame {
  kind: 'end';
}

export interface TTSStartedFrame extends BaseFrame {
  kind: 'tts-started';
}

export interface TTSStoppedFrame extends BaseFrame {
  kind: 'tts-stopped';
}

export interface UserTurnStartedFrame extends BaseFrame {
  kind: 'user-turn-started';
}

export interface UserTurnEndedFrame extends BaseFrame {
  kind: 'user-turn-ended';
}

export interface BotTurnStartedFrame extends BaseFrame {
  kind: 'bot-turn-started';
}

export interface BotTurnEndedFrame extends BaseFrame {
  kind: 'bot-turn-ended';
}

export type ControlFrame =
  | StartFrame
  | EndFrame
  | TTSStartedFrame
  | TTSStoppedFrame
  | UserTurnStartedFrame
  | UserTurnEndedFrame
  | BotTurnStartedFrame
  | BotTurnEndedFrame;

// ---------------------------------------------------------------------------
// The union + helpers
// ---------------------------------------------------------------------------

/** Any frame that can flow through the pipeline. */
export type Frame = SystemFrame | DataFrame | ControlFrame;

/** All valid frame `kind` strings. */
export type FrameKind = Frame['kind'];

/** Direction a frame travels through the chain. */
export enum FrameDirection {
  /** Toward the sink (source → STT → LLM → TTS → sink). */
  Downstream,
  /** Toward the source (sink → TTS → LLM → STT → source). */
  Upstream,
}

// ---------------------------------------------------------------------------
// Type guards
// ---------------------------------------------------------------------------

const systemFrameKinds: ReadonlySet<string> = new Set<SystemFrame['kind']>([
  'input-audio-raw',
  'user-started-speaking',
  'user-stopped-speaking',
  'interruption',
  'error',
]);

const dataFrameKinds: ReadonlySet<string> = new Set<DataFrame['kind']>([
  'transcription',
  'llm-text',
  'llm-full-response',
  'tts-audio-raw',
  'tts-text',
]);

const controlFrameKinds: ReadonlySet<string> = new Set<ControlFrame['kind']>([
  'start',
  'end',
  'tts-started',
  'tts-stopped',
  'user-turn-started',
  'user-turn-ended',
  'bot-turn-started',
  'bot-turn-ended',
]);

/** Type guard: true if `frame` is a high-priority SystemFrame. */
export function isSystemFrame(frame: Frame): frame is SystemFrame {
  return systemFrameKinds.has(frame.kind);
}

/** Type guard: true if `frame` is an ordered-lane DataFrame. */
export function isDataFrame(frame: Frame): frame is DataFrame {
  return dataFrameKinds.has(frame.kind);
}

/** Type guard: true if `frame` is an ordered-lane ControlFrame. */
export function isControlFrame(frame: Frame): frame is ControlFrame {
  return controlFrameKinds.has(frame.kind);
}

// ---------------------------------------------------------------------------
// Factory helpers — attach id/timestamp so callers don't repeat boilerplate.
// Each helper builds the frame object directly so TypeScript infers the
// literal `kind` and the result is assignable to the specific frame type.
// ---------------------------------------------------------------------------

/** Create an InputAudioRawFrame. */
export const inputAudioRaw = (
  audio: ArrayBuffer,
  sampleRate: number,
  numChannels: number,
): InputAudioRawFrame => ({
  id: createFrameId(),
  kind: 'input-audio-raw',
  timestamp: Date.now(),
  audio,
  sampleRate,
  numChannels,
});

/** Create a UserStartedSpeakingFrame. */
export const userStartedSpeaking = (): UserStartedSpeakingFrame => ({
  id: createFrameId(),
  kind: 'user-started-speaking',
  timestamp: Date.now(),
});

/** Create a UserStoppedSpeakingFrame. */
export const userStoppedSpeaking = (): UserStoppedSpeakingFrame => ({
  id: createFrameId(),
  kind: 'user-stopped-speaking',
  timestamp: Date.now(),
});

/** Create an InterruptionFrame. */
export const interruption = (): InterruptionFrame => ({
  id: createFrameId(),
  kind: 'interruption',
  timestamp: Date.now(),
});

/** Create an ErrorFrame. */
export const error = (errorMsg: string, fatal = false): ErrorFrame => ({
  id: createFrameId(),
  kind: 'error',
  timestamp: Date.now(),
  error: errorMsg,
  fatal,
});

/** Create a TranscriptionFrame. */
export const transcription = (
  text: string,
  isFinal: boolean,
  language?: string,
): TranscriptionFrame => ({
  id: createFrameId(),
  kind: 'transcription',
  timestamp: Date.now(),
  text,
  isFinal,
  ...(language !== undefined ? { language } : {}),
});

/** Create an LLMTextFrame (streamed token/chunk). */
export const llmText = (text: string): LLMTextFrame => ({
  id: createFrameId(),
  kind: 'llm-text',
  timestamp: Date.now(),
  text,
});

/** Create an LLMFullResponseFrame. */
export const llmFullResponse = (text: string): LLMFullResponseFrame => ({
  id: createFrameId(),
  kind: 'llm-full-response',
  timestamp: Date.now(),
  text,
});

/** Create a TTSAudioRawFrame. */
export const ttsAudioRaw = (
  audio: ArrayBuffer,
  sampleRate: number,
  numChannels: number,
): TTSAudioRawFrame => ({
  id: createFrameId(),
  kind: 'tts-audio-raw',
  timestamp: Date.now(),
  audio,
  sampleRate,
  numChannels,
});

/** Create a TTSTextFrame. */
export const ttsText = (text: string): TTSTextFrame => ({
  id: createFrameId(),
  kind: 'tts-text',
  timestamp: Date.now(),
  text,
});

/** Create a StartFrame. */
export const start = (): StartFrame => ({
  id: createFrameId(),
  kind: 'start',
  timestamp: Date.now(),
});

/** Create an EndFrame. */
export const end = (): EndFrame => ({
  id: createFrameId(),
  kind: 'end',
  timestamp: Date.now(),
});

/** Create a TTSStartedFrame. */
export const ttsStarted = (): TTSStartedFrame => ({
  id: createFrameId(),
  kind: 'tts-started',
  timestamp: Date.now(),
});

/** Create a TTSStoppedFrame. */
export const ttsStopped = (): TTSStoppedFrame => ({
  id: createFrameId(),
  kind: 'tts-stopped',
  timestamp: Date.now(),
});

/** Create a UserTurnStartedFrame. */
export const userTurnStarted = (): UserTurnStartedFrame => ({
  id: createFrameId(),
  kind: 'user-turn-started',
  timestamp: Date.now(),
});

/** Create a UserTurnEndedFrame. */
export const userTurnEnded = (): UserTurnEndedFrame => ({
  id: createFrameId(),
  kind: 'user-turn-ended',
  timestamp: Date.now(),
});

/** Create a BotTurnStartedFrame. */
export const botTurnStarted = (): BotTurnStartedFrame => ({
  id: createFrameId(),
  kind: 'bot-turn-started',
  timestamp: Date.now(),
});

/** Create a BotTurnEndedFrame. */
export const botTurnEnded = (): BotTurnEndedFrame => ({
  id: createFrameId(),
  kind: 'bot-turn-ended',
  timestamp: Date.now(),
});
