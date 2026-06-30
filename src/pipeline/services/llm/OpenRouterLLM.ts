/**
 * @file OpenRouterLLM.ts
 * @description
 * OpenRouter chat-completions LLM, implemented as a `FrameProcessor`.
 *
 * When a `UserTurnEndedFrame` flows downstream, the processor gathers the
 * shared `ChatContext` history (plus an optional system prompt and tool
 * definitions) and issues a streaming `POST /v1/chat/completions` request to
 * OpenRouter. Each streamed token is emitted as an `LLMTextFrame`; when the
 * stream completes, an `LLMFullResponseFrame` with the assembled text is
 * emitted. Tool-call deltas are logged for now — Phase 5 will wire them to a
 * tool-dispatch harness via the `onToolCall` callback.
 *
 * `stop()` and `interrupt()` both abort any in-flight request.
 */

import { FrameProcessor } from '../../FrameProcessor';
import {
  type Frame,
  FrameDirection,
  llmText,
  llmFullResponse,
  error,
} from '../../frames';
import { type ChatContext, type LLMMessage } from '../../ContextAggregator';

// ---------------------------------------------------------------------------
// Options & tool types
// ---------------------------------------------------------------------------

/** OpenAI-style function tool definition. */
export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface OpenRouterLLMOptions {
  /** OpenRouter API key. */
  apiKey: string;
  /** Model slug, e.g. `anthropic/claude-sonnet-4`, `openai/gpt-4o`. */
  model: string;
  /** Prepended as a `system` message when present. */
  systemPrompt?: string;
  /** Sampling temperature. */
  temperature?: number;
  /** Maximum output tokens. */
  maxTokens?: number;
  /** Function tools the model may call. */
  tools?: ToolDefinition[];
  /**
   * Callback invoked when the model requests a tool call. Set by the agent
   * harness in Phase 5. Returns the tool's result string.
   */
  onToolCall?: (toolName: string, args: Record<string, unknown>) => Promise<string>;
}

// ---------------------------------------------------------------------------
// SSE wire types
// ---------------------------------------------------------------------------

interface StreamDelta {
  content?: string;
  tool_calls?: Array<{
    id?: string;
    function?: { name?: string; arguments?: string };
  }>;
}

interface StreamChunk {
  choices?: Array<{ delta?: StreamDelta }>;
}

// ---------------------------------------------------------------------------
// Processor
// ---------------------------------------------------------------------------

export class OpenRouterLLM extends FrameProcessor {
  private readonly options: OpenRouterLLMOptions;
  private readonly context: ChatContext;
  private abortController: AbortController | null = null;

  constructor(options: OpenRouterLLMOptions, context: ChatContext) {
    super();
    this.options = options;
    this.context = context;
  }

  // -- frame handling ----------------------------------------------------

  async processFrame(frame: Frame, direction: FrameDirection): Promise<void> {
    if (direction === FrameDirection.Downstream && frame.kind === 'user-turn-ended') {
      // Trigger generation, but don't block frame forwarding.
      void this.generateResponse();
    }
    // Forward all frames.
    await this.pushFrame(frame, direction);
  }

  // -- lifecycle ---------------------------------------------------------

  async stop(): Promise<void> {
    this.abortInFlight();
  }

  async interrupt(): Promise<void> {
    // Abort in-flight generation on barge-in.
    this.abortInFlight();
  }

  // -- internals ---------------------------------------------------------

  private abortInFlight(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  private async generateResponse(): Promise<void> {
    try {
      this.abortController = new AbortController();

      const messages: LLMMessage[] = [];
      if (this.options.systemPrompt) {
        messages.push({ role: 'system', content: this.options.systemPrompt });
      }
      messages.push(...this.context.toLLMMessages());

      const body: Record<string, unknown> = {
        model: this.options.model,
        messages,
        stream: true,
      };
      if (this.options.temperature !== undefined) body.temperature = this.options.temperature;
      if (this.options.maxTokens !== undefined) body.max_tokens = this.options.maxTokens;
      if (this.options.tools?.length) body.tools = this.options.tools;

      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.options.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: this.abortController.signal,
      });

      if (!response.ok) {
        throw new Error(`OpenRouter LLM error: ${response.status} ${response.statusText}`);
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let fullResponse = '';
      let buffer = '';

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // Split into complete SSE lines; keep the trailing partial line.
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6);
          if (data === '[DONE]') continue;

          let chunk: StreamChunk;
          try {
            chunk = JSON.parse(data) as StreamChunk;
          } catch {
            continue; // skip malformed chunks
          }

          const delta = chunk.choices?.[0]?.delta;
          if (!delta) continue;

          if (delta.content) {
            fullResponse += delta.content;
            await this.pushFrame(llmText(delta.content), FrameDirection.Downstream);
          }

          if (delta.tool_calls) {
            // Phase 5 will dispatch tool calls via the onToolCall callback.
            // For now, log so tool-call activity is visible during development.
            console.log('LLM tool call:', delta.tool_calls);
          }
        }
      }

      if (fullResponse) {
        await this.pushFrame(llmFullResponse(fullResponse), FrameDirection.Downstream);
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return; // normal on stop/interrupt
      const msg = err instanceof Error ? err.message : 'unknown error';
      await this.pushFrame(error(`LLM error: ${msg}`, false), FrameDirection.Upstream);
    } finally {
      this.abortController = null;
    }
  }
}
