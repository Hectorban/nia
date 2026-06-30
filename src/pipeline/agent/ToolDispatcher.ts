/**
 * @file ToolDispatcher.ts
 * @description
 * A `FrameProcessor` that sits in the pipeline and coordinates tool execution.
 *
 * Today the OpenRouterLLM stage only *logs* tool calls (the Phase 3 stub), so
 * the dispatcher's pipeline behaviour is transparent — it forwards every
 * frame unchanged. The real work happens via {@link executeTool}, which the
 * LLM's `onToolCall` callback will be wired to in Phase 6 (UI integration).
 *
 * Holding the registry here keeps tool ownership with the pipeline and lets
 * the dispatcher reject unknown tool names with a clear error string instead
 * of an unhandled exception.
 */

import { FrameProcessor } from '../FrameProcessor';
import { type Frame, FrameDirection } from '../frames';
import { ToolRegistry } from './ToolRegistry';

export class ToolDispatcher extends FrameProcessor {
  private registry: ToolRegistry;

  constructor(registry: ToolRegistry) {
    super();
    this.registry = registry;
  }

  /**
   * Transparent pass-through. Tool execution is driven by the LLM's
   * `onToolCall` callback (wired in Phase 6), not by frame inspection.
   */
  async processFrame(frame: Frame, direction: FrameDirection): Promise<void> {
    await this.pushFrame(frame, direction);
  }

  /**
   * Execute a registered tool by name.
   *
   * Unknown tools and execution errors are returned as error strings so the
   * LLM can react to them instead of crashing the pipeline.
   */
  async executeTool(name: string, args: Record<string, unknown>): Promise<string> {
    const tool = this.registry.get(name);
    if (!tool) {
      return `Error: Tool "${name}" not found`;
    }
    try {
      return await tool.execute(args);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      return `Error executing tool "${name}": ${msg}`;
    }
  }

  /** Expose the underlying registry (e.g. for the LLM wiring). */
  getRegistry(): ToolRegistry {
    return this.registry;
  }
}
