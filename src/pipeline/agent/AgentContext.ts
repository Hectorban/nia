/**
 * @file AgentContext.ts
 * @description
 * The agent harness configuration: identity/system prompt, tool registry, and
 * the shared conversation `ChatContext`. This is what gets passed to (or read
 * by) the pipeline when an agent run starts.
 *
 * `AgentContext` is deliberately a thin composition layer — it owns the three
 * pieces an agent needs (config, conversation, tools) and exposes convenience
 * accessors that bridge them to the LLM API (`toLLMMessages`, tool defs).
 */

import { ChatContext } from '../ContextAggregator';
import { ToolRegistry } from './ToolRegistry';
import { ToolDefinition } from '../services/llm/OpenRouterLLM';

/** Static configuration for an agent run. */
export interface AgentConfig {
  /** The agent's identity/name for logging. */
  name?: string;
  /** System prompt — the agent's instructions. */
  systemPrompt?: string;
  /** Language code (e.g. 'es', 'en'). */
  language?: string;
  /** LLM model slug (e.g. 'anthropic/claude-sonnet-4'). */
  model?: string;
}

export class AgentContext {
  readonly config: AgentConfig;
  readonly chatContext: ChatContext;
  readonly tools: ToolRegistry;

  constructor(
    config: AgentConfig = {},
    chatContext?: ChatContext,
    tools?: ToolRegistry,
  ) {
    this.config = config;
    this.chatContext = chatContext ?? new ChatContext();
    this.tools = tools ?? new ToolRegistry();
  }

  /** Build the LLM messages array: system prompt + conversation history. */
  toLLMMessages() {
    return this.chatContext.toLLMMessages();
  }

  /** Get tool definitions for the LLM API. */
  toToolDefinitions(): ToolDefinition[] {
    return this.tools.toToolDefinitions();
  }

  /** Reset the conversation. */
  reset(): void {
    this.chatContext.clear();
  }
}
