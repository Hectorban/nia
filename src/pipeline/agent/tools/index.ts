/**
 * @file tools/index.ts
 * @description
 * Built-in tool handlers that migrate the inline `clientTools` map from
 * `useRealtimeChat.ts` into the typed `ToolRegistry`.
 *
 * Each tool is a *factory function* that takes its service dependencies as
 * arguments (dependency injection), so the tools are testable and don't
 * hardcode singleton access.
 *
 *   - VTube Studio tools take a `VTubeStudioService` instance and an
 *     `isConnected()` predicate.
 *   - Firecrawl tools take a `getApiKey()` accessor.
 */

import { ToolHandler } from '../ToolRegistry';
import {
  VTubeStudioService,
  findBestExpressionMatch,
} from '../../../services/vtubeStudio';
import { FirecrawlService } from '../../../services/firecrawl';

// ---------------------------------------------------------------------------
// VTube Studio tools
// ---------------------------------------------------------------------------

/**
 * Activate a named VTube Studio expression.
 */
export function createChangeExpressionTool(
  vtubeService: VTubeStudioService,
  isConnected: () => boolean,
): ToolHandler {
  return {
    name: 'change_expression',
    description:
      'Change the VTube Studio avatar expression. Use when you want to show a specific expression.',
    parameters: {
      type: 'object',
      properties: {
        expression: {
          type: 'string',
          description: 'The name of the expression to activate',
        },
        duration: {
          type: 'number',
          description: 'How long to hold the expression in seconds (optional)',
        },
      },
      required: ['expression'],
    },
    async execute(args) {
      const { expression, duration } = args as {
        expression: string;
        duration?: number;
      };
      if (!isConnected()) return 'VTube Studio not connected';
      try {
        await vtubeService.activateExpression(expression, duration);
        return `Successfully activated expression: ${expression}`;
      } catch (err) {
        return `Failed to activate expression: ${err instanceof Error ? err.message : 'Unknown error'}`;
      }
    },
  };
}

/**
 * Trigger an emotion-based expression, finding the best match among the
 * avatar's currently available expressions.
 */
export function createTriggerEmotionTool(
  vtubeService: VTubeStudioService,
  isConnected: () => boolean,
): ToolHandler {
  return {
    name: 'trigger_emotion',
    description:
      'Trigger an emotion-based expression on the VTube Studio avatar. Finds the best matching expression for the given emotion.',
    parameters: {
      type: 'object',
      properties: {
        emotion: {
          type: 'string',
          description: 'The emotion to express (e.g. happy, sad, surprised)',
        },
        duration: {
          type: 'number',
          description:
            'How long to hold the expression in seconds (optional, default 3)',
        },
      },
      required: ['emotion'],
    },
    async execute(args) {
      const { emotion, duration } = args as {
        emotion: string;
        duration?: number;
      };
      if (!isConnected()) return 'VTube Studio not connected';
      try {
        const expressions = await vtubeService.getExpressions();
        const bestMatch = findBestExpressionMatch(emotion, expressions);
        if (!bestMatch) return `No suitable expression found for emotion: ${emotion}`;
        await vtubeService.activateExpression(bestMatch, duration ?? 3);
        return `Triggered ${emotion} emotion with expression: ${bestMatch}`;
      } catch (err) {
        return `Failed to trigger emotion: ${err instanceof Error ? err.message : 'Unknown error'}`;
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Firecrawl tools
// ---------------------------------------------------------------------------

/**
 * Fetch and read the content of a web URL, optionally with a screenshot.
 */
export function createFetchUrlTool(getApiKey: () => string | undefined): ToolHandler {
  return {
    name: 'fetch_url',
    description:
      'Fetch and read the content of a web URL. Returns the page text and optional screenshot.',
    parameters: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'The URL to fetch' },
        includeScreenshot: {
          type: 'boolean',
          description: 'Whether to capture a screenshot (optional)',
        },
      },
      required: ['url'],
    },
    async execute(args) {
      const { url, includeScreenshot } = args as {
        url: string;
        includeScreenshot?: boolean;
      };
      const apiKey = getApiKey();
      if (!apiKey) return 'Error: Firecrawl API key is not configured.';
      try {
        const response = await FirecrawlService.scrapeWithApiKey(
          url,
          apiKey,
          includeScreenshot ?? false,
        );
        if (!response.success) return `Error fetching URL: ${response.error}`;
        if (!response.markdown) return 'Error: No content retrieved from URL';
        const title = response.metadata?.title ?? 'Unknown Title';
        const description = response.metadata?.description ?? '';
        const screenshotUrl =
          response.screenshot ?? response.actions?.screenshots?.[0];
        let result = `Successfully fetched content from: ${url}\n\nTitle: ${title}${
          description ? `\nDescription: ${description}` : ''
        }`;
        if (screenshotUrl) result += `\nScreenshot: ${screenshotUrl}`;
        result += `\n\nContent:\n${response.markdown}`;
        return result;
      } catch (err) {
        return `Failed to fetch URL: ${err instanceof Error ? err.message : 'Unknown error'}`;
      }
    },
  };
}

/**
 * Take a screenshot of a web URL and return the screenshot URL.
 */
export function createScreenshotUrlTool(
  getApiKey: () => string | undefined,
): ToolHandler {
  return {
    name: 'screenshot_url',
    description:
      'Take a screenshot of a web URL and return the screenshot URL.',
    parameters: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'The URL to screenshot' },
      },
      required: ['url'],
    },
    async execute(args) {
      const { url } = args as { url: string };
      const apiKey = getApiKey();
      if (!apiKey) return 'Error: Firecrawl API key is not configured.';
      try {
        const response = await FirecrawlService.scrapeWithApiKey(url, apiKey, true);
        if (!response.success) return `Error taking screenshot: ${response.error}`;
        const screenshotUrl =
          response.screenshot ?? response.actions?.screenshots?.[0];
        if (!screenshotUrl) return 'Error: No screenshot was captured from the URL';
        const title = response.metadata?.title ?? 'Unknown Title';
        return `Successfully captured screenshot of: ${url}\n\nTitle: ${title}\nScreenshot: ${screenshotUrl}`;
      } catch (err) {
        return `Failed to take screenshot: ${err instanceof Error ? err.message : 'Unknown error'}`;
      }
    },
  };
}
