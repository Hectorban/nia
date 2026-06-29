/**
 * @file ContextAggregator.ts
 * @description
 * Accumulates user and assistant conversation turns into a shared
 * `ChatContext`, modeled on pipecat's `ContextAggregator` with separate
 * `.user()` and `.assistant()` processors.
 *
 * Two `FrameProcessor` subclasses share a single `ChatContext` instance:
 *
 *   - `ContextAggregatorUser`     — sits early in the chain (after STT).
 *     Watches `TranscriptionFrame`s: the first partial marks the start of a
 *     user turn (emits `UserTurnStartedFrame`), a final transcript is appended
 *     to the context as a user message and closes the turn
 *     (emits `UserTurnEndedFrame`).
 *
 *   - `ContextAggregatorAssistant` — sits later in the chain (after LLM/TTS).
 *     Watches `TTSStartedFrame`/`TTSStoppedFrame` for turn boundaries
 *     (emitting `BotTurnStartedFrame`/`BotTurnEndedFrame`) and accumulates
 *     `TTSTextFrame` text, committing a sentence to the context whenever a
 *     sentence boundary (`.`, `!`, `?`) is reached. `LLMFullResponseFrame` is
 *     used as a fallback so the full response is captured even when the TTS
 *     stage never emits per-chunk text frames.
 *
 * Both aggregators forward every frame they don't consume unchanged, so they
 * are transparent to stages downstream of them.
 */

import { FrameProcessor } from './FrameProcessor';
import {
  type Frame,
  FrameDirection,
  type TranscriptionFrame,
  type TTSTextFrame,
  type LLMFullResponseFrame,
} from './frames';
import {
  userTurnStarted as userTurnStartedFrame,
  userTurnEnded as userTurnEndedFrame,
  botTurnStarted as botTurnStartedFrame,
  botTurnEnded as botTurnEndedFrame,
} from './frames';

// ---------------------------------------------------------------------------
// Message + context types
// ---------------------------------------------------------------------------

/** A single accumulated conversation turn. */
export interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
  timestamp: number;
}

/** The shape an LLM provider expects for its message history. */
export interface LLMMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

// ---------------------------------------------------------------------------
// ChatContext — the shared conversation store
// ---------------------------------------------------------------------------

/**
 * Shared, mutable conversation log. Both the user and assistant aggregators
 * append to the same instance so the LLM stage can read a complete history
 * via `toLLMMessages()`.
 */
export class ChatContext {
  messages: ChatMessage[] = [];

  /** Append a turn. */
  addMessage(role: 'user' | 'assistant', text: string): void {
    this.messages.push({ role, text, timestamp: Date.now() });
  }

  /**
   * Convert the accumulated history into the `{role, content}` format LLM
   * providers expect. Only `user` and `assistant` turns are emitted; a
   * `system` message is the caller's responsibility (prepended separately).
   */
  toLLMMessages(): LLMMessage[] {
    return this.messages.map((m) => ({
      role: m.role,
      content: m.text,
    }));
  }

  /** Reset the conversation log. */
  clear(): void {
    this.messages = [];
  }
}

// ---------------------------------------------------------------------------
// ContextAggregatorUser
// ---------------------------------------------------------------------------

/**
 * Aggregates user turns from STT output.
 *
 *   - First partial `TranscriptionFrame` (isFinal === false) → emit
 *     `UserTurnStartedFrame` downstream (once per turn).
 *   - Final `TranscriptionFrame` (isFinal === true) → append the text to the
 *     shared `ChatContext` as a `user` message and emit `UserTurnEndedFrame`.
 *   - All other frames are forwarded unchanged.
 */
export class ContextAggregatorUser extends FrameProcessor {
  private readonly context: ChatContext;
  /** True between the first partial and the final of a single user turn. */
  private turnInProgress = false;

  constructor(context: ChatContext) {
    super();
    this.context = context;
  }

  async processFrame(frame: Frame, direction: FrameDirection): Promise<void> {
    // Only inspect/act on downstream transcription frames.
    if (direction === FrameDirection.Downstream && frame.kind === 'transcription') {
      const tf = frame as TranscriptionFrame;
      if (tf.isFinal) {
        // Close the turn: record the utterance and signal downstream.
        if (tf.text.length > 0) {
          this.context.addMessage('user', tf.text);
        }
        this.turnInProgress = false;
        await this.pushFrame(userTurnEndedFrame(), direction);
        return;
      }
      // Partial: mark the start of a user turn (first partial only).
      if (!this.turnInProgress) {
        this.turnInProgress = true;
        await this.pushFrame(userTurnStartedFrame(), direction);
      }
      // Forward the partial itself so UI stages can show live transcription.
      await this.pushFrame(frame, direction);
      return;
    }

    // Pass-through for everything else (both directions).
    await this.pushFrame(frame, direction);
  }
}

// ---------------------------------------------------------------------------
// ContextAggregatorAssistant
// ---------------------------------------------------------------------------

/** Matches a sentence terminator followed by whitespace or end-of-string. */
const SENTENCE_BOUNDARY = /[.!?](?:\s|$)/;

/**
 * Aggregates assistant turns from LLM/TTS output.
 *
 *   - `TTSStartedFrame` → emit `BotTurnStartedFrame` downstream.
 *   - `TTSStoppedFrame` → emit `BotTurnEndedFrame` downstream and flush any
 *     pending sentence fragment.
 *   - `TTSTextFrame` → accumulate text; on a sentence boundary commit the
 *     accumulated sentence to the shared `ChatContext` as an `assistant`
 *     message.
 *   - `LLMFullResponseFrame` → record the complete response as an assistant
 *     message (fallback when no TTSTextFrames are produced, e.g. text-only
 *     mode or a TTS that doesn't emit text).
 *   - All other frames are forwarded unchanged.
 */
export class ContextAggregatorAssistant extends FrameProcessor {
  private readonly context: ChatContext;
  /** Text accumulated since the last committed sentence boundary. */
  private pendingText = '';

  constructor(context: ChatContext) {
    super();
    this.context = context;
  }

  async processFrame(frame: Frame, direction: FrameDirection): Promise<void> {
    if (direction !== FrameDirection.Downstream) {
      await this.pushFrame(frame, direction);
      return;
    }

    switch (frame.kind) {
      case 'tts-started': {
        await this.pushFrame(botTurnStartedFrame(), direction);
        await this.pushFrame(frame, direction);
        return;
      }
      case 'tts-stopped': {
        // Flush any trailing fragment as a final sentence.
        if (this.pendingText.trim().length > 0) {
          this.context.addMessage('assistant', this.pendingText.trim());
          this.pendingText = '';
        }
        await this.pushFrame(botTurnEndedFrame(), direction);
        await this.pushFrame(frame, direction);
        return;
      }
      case 'tts-text': {
        const tf = frame as TTSTextFrame;
        await this.pushFrame(frame, direction);
        this.pendingText += tf.text;
        // Commit each complete sentence as its own assistant message so the
        // context stays granular and reflects what was actually spoken.
        while (SENTENCE_BOUNDARY.test(this.pendingText)) {
          const match = this.pendingText.match(SENTENCE_BOUNDARY);
          if (!match || match.index === undefined) break;
          const end = match.index + match[0].length;
          const sentence = this.pendingText.slice(0, end).trim();
          this.pendingText = this.pendingText.slice(end);
          if (sentence.length > 0) {
            this.context.addMessage('assistant', sentence);
          }
        }
        return;
      }
      case 'llm-full-response': {
        const lf = frame as LLMFullResponseFrame;
        // Fallback path: capture the complete response. We only record it if
        // we haven't already accumulated the same text via TTSTextFrames.
        if (this.pendingText.trim().length === 0 && lf.text.length > 0) {
          this.context.addMessage('assistant', lf.text);
        }
        await this.pushFrame(frame, direction);
        return;
      }
      default: {
        await this.pushFrame(frame, direction);
        return;
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Convenience factory — mirrors pipecat's `ContextAggregator` constructor.
// ---------------------------------------------------------------------------

/**
 * Result of {@link createContextAggregator} — the two processors share one
 * `ChatContext`. Place `user` early (after STT) and `assistant` later (after
 * LLM/TTS) in the pipeline.
 */
export interface ContextAggregatorPair {
  user: ContextAggregatorUser;
  assistant: ContextAggregatorAssistant;
  context: ChatContext;
}

/**
 * Construct a matched user/assistant aggregator pair backed by a fresh
 * `ChatContext`. This mirrors pipecat's `ContextAggregator` constructor which
 * returns a pair that shares state.
 */
export function createContextAggregator(
  context: ChatContext = new ChatContext(),
): ContextAggregatorPair {
  return {
    user: new ContextAggregatorUser(context),
    assistant: new ContextAggregatorAssistant(context),
    context,
  };
}
