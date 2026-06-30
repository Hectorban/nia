/**
 * @file ToolRegistry.ts
 * @description
 * A registry for typed tool definitions used by the agent harness. Each tool
 * has a name, description, JSON-Schema parameters, and an async `execute`
 * function that returns a string result back to the LLM.
 *
 * The registry converts its handlers into OpenAI/OpenRouter
 * `ToolDefinition`s so they can be passed straight to the LLM API.
 */

import { ToolDefinition } from '../services/llm/OpenRouterLLM';

/** A single tool handler registered with the agent. */
export interface ToolHandler {
  name: string;
  description: string;
  /** JSON-Schema describing the tool's parameters. */
  parameters: Record<string, unknown>;
  /** Execute the tool with the parsed arguments; return a string for the LLM. */
  execute: (args: Record<string, unknown>) => Promise<string>;
}

export class ToolRegistry {
  private tools: Map<string, ToolHandler> = new Map();

  register(handler: ToolHandler): void {
    this.tools.set(handler.name, handler);
  }

  get(name: string): ToolHandler | undefined {
    return this.tools.get(name);
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  list(): ToolHandler[] {
    return Array.from(this.tools.values());
  }

  /** Convert to OpenAI/OpenRouter tool definitions for the LLM API. */
  toToolDefinitions(): ToolDefinition[] {
    return this.list().map((t) => ({
      type: 'function' as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    }));
  }
}
