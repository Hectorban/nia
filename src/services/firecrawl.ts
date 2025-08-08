import FirecrawlApp from '@mendable/firecrawl-js';

export interface FirecrawlResponse {
  success: boolean;
  markdown?: string;
  html?: string;
  screenshot?: string;
  actions?: {
    screenshots?: string[];
    scrapes?: any[];
  };
  metadata?: {
    title?: string;
    description?: string;
    language?: string;
    sourceURL?: string;
    url?: string;
    statusCode?: number;
    [key: string]: any;
  };
  error?: string;
  warning?: string;
  scrape_id?: string;
}

export class FirecrawlService {
  private app: FirecrawlApp;

  constructor(apiKey: string) {
    this.app = new FirecrawlApp({ apiKey });
  }

  async scrapeUrl(url: string, includeScreenshot: boolean = false): Promise<FirecrawlResponse> {
    try {
      console.log('Scraping URL with Firecrawl:', url, includeScreenshot ? '(with screenshot)' : '');
      
      const formats = includeScreenshot 
        ? ['markdown' as const, 'html' as const, 'screenshot' as const] 
        : ['markdown' as const, 'html' as const];
      
      // https://www.firecrawl.dev/api/scrape-edge
      const scrapeResult = await this.app.scrapeUrl(url, {
        formats,
        onlyMainContent: true,
        includeTags: [""],
        excludeTags: [""],
        maxAge: 14400000,
        parsePDF: true,
        actions: [
          { type: 'wait', milliseconds: 3000 },
        ]
      });
      
      console.log('Firecrawl response received');
      console.log('Scrape result success:', scrapeResult.success);
      console.log('Full scrapeResult object:', JSON.stringify(scrapeResult, null, 2));
      console.log('scrapeResult keys:', Object.keys(scrapeResult));
      console.log('Has data property:', 'data' in scrapeResult);
      console.log('scrapeResult.data type:', typeof (scrapeResult as any).data);
      
      if (!scrapeResult.success) {
        console.error('Firecrawl scrape failed:', scrapeResult.error);
        return {
          success: false,
          error: scrapeResult.error || 'Scrape failed'
        };
      }
      
      // Cast to any to access the properties directly (npm package returns data at root level)
      const result = scrapeResult as any;
      
      console.log('Has markdown:', !!result?.markdown);
      console.log('Has screenshot:', !!result?.screenshot);
      console.log('Markdown length:', result?.markdown?.length || 0);
      console.log('Metadata keys:', result?.metadata ? Object.keys(result.metadata) : 'none');
      
      // The npm package returns data directly at the root level, not nested under 'data'
      return {
        success: true,
        markdown: result?.markdown,
        html: result?.html,
        screenshot: result?.screenshot,
        actions: result?.actions,
        metadata: result?.metadata,
        warning: result?.warning,
        scrape_id: result?.scrape_id
      };
    } catch (error) {
      console.error('Error scraping URL:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  static async scrapeWithApiKey(url: string, apiKey: string, includeScreenshot: boolean = true): Promise<FirecrawlResponse> {
    const service = new FirecrawlService(apiKey);
    return service.scrapeUrl(url, includeScreenshot);
  }
}
