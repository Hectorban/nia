# Quickstart

> Firecrawl allows you to turn entire websites into LLM-ready markdown

<img className="block" src="https://mintlify.s3.us-west-1.amazonaws.com/firecrawl/images/turn-websites-into-llm-ready-data--firecrawl.jpg" alt="Hero Light" />

## Welcome to Firecrawl

[Firecrawl](https://firecrawl.dev?ref=github) is an API service that takes a URL, crawls it, and converts it into clean markdown. We crawl all accessible subpages and give you clean markdown for each. No sitemap required.

## How to use it?

We provide an easy to use API with our hosted version. You can find the playground and documentation [here](https://firecrawl.dev/playground). You can also self host the backend if you'd like.

Check out the following resources to get started:

* [x] **API**: [Documentation](https://docs.firecrawl.dev/api-reference/introduction)
* [x] **SDKs**: [Python](https://docs.firecrawl.dev/sdks/python), [Node](https://docs.firecrawl.dev/sdks/node), [Go](https://docs.firecrawl.dev/sdks/go), [Rust](https://docs.firecrawl.dev/sdks/rust)
* [x] **LLM Frameworks**: [Langchain (python)](https://python.langchain.com/docs/integrations/document_loaders/firecrawl/), [Langchain (js)](https://js.langchain.com/docs/integrations/document_loaders/web_loaders/firecrawl), [Llama Index](https://docs.llamaindex.ai/en/latest/examples/data_connectors/WebPageDemo/#using-firecrawl-reader), [Crew.ai](https://docs.crewai.com/), [Composio](https://composio.dev/tools/firecrawl/all), [PraisonAI](https://docs.praison.ai/firecrawl/), [Superinterface](https://superinterface.ai/docs/assistants/functions/firecrawl), [Vectorize](https://docs.vectorize.io/integrations/source-connectors/firecrawl)
* [x] **Low-code Frameworks**: [Dify](https://dify.ai/blog/dify-ai-blog-integrated-with-firecrawl), [Langflow](https://docs.langflow.org/), [Flowise AI](https://docs.flowiseai.com/integrations/langchain/document-loaders/firecrawl), [Cargo](https://docs.getcargo.io/integration/firecrawl), [Pipedream](https://pipedream.com/apps/firecrawl/)
* [x] **Others**: [Zapier](https://zapier.com/apps/firecrawl/integrations), [Pabbly Connect](https://www.pabbly.com/connect/integrations/firecrawl/)
* [ ] Want an SDK or Integration? Let us know by opening an issue.

**Self-host:** To self-host refer to guide [here](/contributing/self-host).

### API Key

To use the API, you need to sign up on [Firecrawl](https://firecrawl.dev) and get an API key.

### Features

* [**Scrape**](#scraping): scrapes a URL and get its content in LLM-ready format (markdown, structured data via [LLM Extract](#extraction), screenshot, html)
* [**Crawl**](#crawling): scrapes all the URLs of a web page and return content in LLM-ready format
* [**Map**](/features/map): input a website and get all the website urls - extremely fast
* [**Search**](/features/search): search the web and get full content from results
* [**Extract**](/features/extract): get structured data from single page, multiple pages or entire websites with AI.

### Powerful Capabilities

* **LLM-ready formats**: markdown, structured data, screenshot, HTML, links, metadata
* **The hard stuff**: proxies, anti-bot mechanisms, dynamic content (js-rendered), output parsing, orchestration
* **Customizability**: exclude tags, crawl behind auth walls with custom headers, max crawl depth, etc...
* **Media parsing**: pdfs, docx, images.
* **Reliability first**: designed to get the data you need - no matter how hard it is.
* **Actions**: click, scroll, input, wait and more before extracting data

You can find all of Firecrawl's capabilities and how to use them in our [documentation](https://docs.firecrawl.dev)

## Installing Firecrawl

<CodeGroup>
  ```bash Python
  pip install firecrawl-py
  ```

  ```bash Node
  npm install @mendable/firecrawl-js
  ```

  ```bash Go
  go get github.com/mendableai/firecrawl-go
  ```

  ```yaml Rust
  # Add this to your Cargo.toml
  [dependencies]
  firecrawl = "^1.0"
  tokio = { version = "^1", features = ["full"] }
  ```
</CodeGroup>

## Scraping

To scrape a single URL, use the `scrape_url` method. It takes the URL as a parameter and returns the scraped data as a dictionary.

<CodeGroup>
  ```python Python
  from firecrawl import FirecrawlApp

  app = FirecrawlApp(api_key="fc-YOUR_API_KEY")

  # Scrape a website:
  scrape_result = app.scrape_url('firecrawl.dev', formats=['markdown', 'html'])
  print(scrape_result)
  ```

  ```js Node
  import FirecrawlApp, { ScrapeResponse } from '@mendable/firecrawl-js';

  const app = new FirecrawlApp({apiKey: "fc-YOUR_API_KEY"});

  // Scrape a website:
  const scrapeResult = await app.scrapeUrl('firecrawl.dev', { formats: ['markdown', 'html'] }) as ScrapeResponse;

  if (!scrapeResult.success) {
    throw new Error(`Failed to scrape: ${scrapeResult.error}`)
  }

  console.log(scrapeResult)
  ```

  ```go Go
  import (
  	"fmt"
  	"log"

  	"github.com/mendableai/firecrawl-go"
  )

  func main() {
  	// Initialize the FirecrawlApp with your API key
  	apiKey := "fc-YOUR_API_KEY"
  	apiUrl := "https://api.firecrawl.dev"
  	version := "v1"

  	app, err := firecrawl.NewFirecrawlApp(apiKey, apiUrl, version)
  	if err != nil {
  		log.Fatalf("Failed to initialize FirecrawlApp: %v", err)
  	}

  	// Scrape a website
  	scrapeResult, err := app.ScrapeUrl("https://firecrawl.dev", map[string]any{
  		"formats": []string{"markdown", "html"},
  	})
  	if err != nil {
  		log.Fatalf("Failed to scrape URL: %v", err)
  	}

  	fmt.Println(scrapeResult)
  }
  ```

  ```rust Rust
  use firecrawl::{FirecrawlApp, scrape::{ScrapeOptions, ScrapeFormats}};

  #[tokio::main]
  async fn main() {
      // Initialize the FirecrawlApp with the API key
      let app = FirecrawlApp::new("fc-YOUR_API_KEY").expect("Failed to initialize FirecrawlApp");

      let options = ScrapeOptions {
          formats vec! [ ScrapeFormats::Markdown, ScrapeFormats::HTML ].into(),
          ..Default::default()
      };

      let scrape_result = app.scrape_url("https://firecrawl.dev", options).await;

      match scrape_result {
          Ok(data) => println!("Scrape Result:\n{}", data.markdown.unwrap()),
          Err(e) => eprintln!("Map failed: {}", e),
      }
  }
  ```

  ```bash cURL
  curl -X POST https://api.firecrawl.dev/v1/scrape \
      -H 'Content-Type: application/json' \
      -H 'Authorization: Bearer YOUR_API_KEY' \
      -d '{
        "url": "https://docs.firecrawl.dev",
        "formats" : ["markdown", "html"]
      }'
  ```
</CodeGroup>

### Response

SDKs will return the data object directly. cURL will return the payload exactly as shown below.

```json
{
  "success": true,
  "data" : {
    "markdown": "Launch Week I is here! [See our Day 2 Release 🚀](https://www.firecrawl.dev/blog/launch-week-i-day-2-doubled-rate-limits)[💥 Get 2 months free...",
    "html": "<!DOCTYPE html><html lang=\"en\" class=\"light\" style=\"color-scheme: light;\"><body class=\"__variable_36bd41 __variable_d7dc5d font-inter ...",
    "metadata": {
      "title": "Home - Firecrawl",
      "description": "Firecrawl crawls and converts any website into clean markdown.",
      "language": "en",
      "keywords": "Firecrawl,Markdown,Data,Mendable,Langchain",
      "robots": "follow, index",
      "ogTitle": "Firecrawl",
      "ogDescription": "Turn any website into LLM-ready data.",
      "ogUrl": "https://www.firecrawl.dev/",
      "ogImage": "https://www.firecrawl.dev/og.png?123",
      "ogLocaleAlternate": [],
      "ogSiteName": "Firecrawl",
      "sourceURL": "https://firecrawl.dev",
      "statusCode": 200
    }
  }
}
```

## Crawling

Used to crawl a URL and all accessible subpages. This submits a crawl job and returns a job ID to check the status of the crawl.

### Usage

<CodeGroup>
  ```python Python
  from firecrawl import FirecrawlApp, ScrapeOptions

  app = FirecrawlApp(api_key="fc-YOUR_API_KEY")

  # Crawl a website:
  crawl_result = app.crawl_url(
    'https://firecrawl.dev', 
    limit=10, 
    scrape_options=ScrapeOptions(formats=['markdown', 'html']),
  )
  print(crawl_result)
  ```

  ```js Node
  import FirecrawlApp from '@mendable/firecrawl-js';

  const app = new FirecrawlApp({apiKey: "fc-YOUR_API_KEY"});

  const crawlResponse = await app.crawlUrl('https://firecrawl.dev', {
    limit: 100,
    scrapeOptions: {
      formats: ['markdown', 'html'],
    }
  })

  if (!crawlResponse.success) {
    throw new Error(`Failed to crawl: ${crawlResponse.error}`)
  }

  console.log(crawlResponse)
  ```

  ```go Go
  import (
  	"fmt"
  	"log"

  	"github.com/mendableai/firecrawl-go"
  )

  func main() {
  	// Initialize the FirecrawlApp with your API key
  	apiKey := "fc-YOUR_API_KEY"
  	apiUrl := "https://api.firecrawl.dev"
  	version := "v1"

  	app, err := firecrawl.NewFirecrawlApp(apiKey, apiUrl, version)
  	if err != nil {
  		log.Fatalf("Failed to initialize FirecrawlApp: %v", err)
  	}

  	// Crawl a website
  	crawlStatus, err := app.CrawlUrl("https://firecrawl.dev", map[string]any{
  		"limit": 100,
  		"scrapeOptions": map[string]any{
  			"formats": []string{"markdown", "html"},
  		},
  	})
  	if err != nil {
  		log.Fatalf("Failed to send crawl request: %v", err)
  	}

  	fmt.Println(crawlStatus) 
  }
  ```

  ```rust Rust
  use firecrawl::{crawl::{CrawlOptions, CrawlScrapeOptions, CrawlScrapeFormats}, FirecrawlApp};

  #[tokio::main]
  async fn main() {
      // Initialize the FirecrawlApp with the API key
      let app = FirecrawlApp::new("fc-YOUR_API_KEY").expect("Failed to initialize FirecrawlApp");

      // Crawl a website
      let crawl_options = CrawlOptions {
          scrape_options: CrawlScrapeOptions {
              formats: vec![ CrawlScrapeFormats::Markdown, CrawlScrapeFormats::HTML ].into(),
              ..Default::default()
          }.into(),
          limit: 100.into(),
          ..Default::default()
      };

      let crawl_result = app
          .crawl_url("https://mendable.ai", crawl_options)
          .await;

      match crawl_result {
          Ok(data) => println!("Crawl Result (used {} credits):\n{:#?}", data.credits_used, data.data),
          Err(e) => eprintln!("Crawl failed: {}", e),
      }
  }
  ```

  ```bash cURL
  curl -X POST https://api.firecrawl.dev/v1/crawl \
      -H 'Content-Type: application/json' \
      -H 'Authorization: Bearer YOUR_API_KEY' \
      -d '{
        "url": "https://docs.firecrawl.dev",
        "limit": 100,
        "scrapeOptions": {
          "formats": ["markdown", "html"]
        }
      }'
  ```
</CodeGroup>

If you're using cURL or `async crawl` functions on SDKs, this will return an `ID` where you can use to check the status of the crawl.

```json
{
  "success": true,
  "id": "123-456-789",
  "url": "https://api.firecrawl.dev/v1/crawl/123-456-789"
}
```

### Check Crawl Job

Used to check the status of a crawl job and get its result.

<CodeGroup>
  ```python Python
  crawl_status = app.check_crawl_status("<crawl_id>")
  print(crawl_status)
  ```

  ```js Node
  const crawlResponse = await app.checkCrawlStatus("<crawl_id>");

  if (!crawlResponse.success) {
    throw new Error(`Failed to check crawl status: ${crawlResponse.error}`)
  }

  console.log(crawlResponse)
  ```

  ```go Go
  // Get crawl status
  crawlStatus, err := app.CheckCrawlStatus("<crawl_id>")

  if err != nil {
    log.Fatalf("Failed to get crawl status: %v", err)
  }

  fmt.Println(crawlStatus)
  ```

  ```rust Rust
  let crawl_status = app.check_crawl_status(crawl_id).await;

  match crawl_status {
      Ok(data) => println!("Crawl Status:\n{:#?}", data),
      Err(e) => eprintln!("Check crawl status failed: {}", e),
  }
  ```

  ```bash cURL
  curl -X GET https://api.firecrawl.dev/v1/crawl/<crawl_id> \
      -H 'Content-Type: application/json' \
      -H 'Authorization: Bearer YOUR_API_KEY'
  ```
</CodeGroup>

#### Response

The response will be different depending on the status of the crawl. For not completed or large responses exceeding 10MB, a `next` URL parameter is provided. You must request this URL to retrieve the next 10MB of data. If the `next` parameter is absent, it indicates the end of the crawl data.

<CodeGroup>
  ```json Scraping
  {
    "status": "scraping",
    "total": 36,
    "completed": 10,
    "creditsUsed": 10,
    "expiresAt": "2024-00-00T00:00:00.000Z",
    "next": "https://api.firecrawl.dev/v1/crawl/123-456-789?skip=10",
    "data": [
      {
        "markdown": "[Firecrawl Docs home page![light logo](https://mintlify.s3-us-west-1.amazonaws.com/firecrawl/logo/light.svg)!...",
        "html": "<!DOCTYPE html><html lang=\"en\" class=\"js-focus-visible lg:[--scroll-mt:9.5rem]\" data-js-focus-visible=\"\">...",
        "metadata": {
          "title": "Build a 'Chat with website' using Groq Llama 3 | Firecrawl",
          "language": "en",
          "sourceURL": "https://docs.firecrawl.dev/learn/rag-llama3",
          "description": "Learn how to use Firecrawl, Groq Llama 3, and Langchain to build a 'Chat with your website' bot.",
          "ogLocaleAlternate": [],
          "statusCode": 200
        }
      },
      ...
    ]
  }
  ```

  ```json Completed
  {
    "status": "completed",
    "total": 36,
    "completed": 36,
    "creditsUsed": 36,
    "expiresAt": "2024-00-00T00:00:00.000Z",
    "next": "https://api.firecrawl.dev/v1/crawl/123-456-789?skip=26",
    "data": [
      {
        "markdown": "[Firecrawl Docs home page![light logo](https://mintlify.s3-us-west-1.amazonaws.com/firecrawl/logo/light.svg)!...",
        "html": "<!DOCTYPE html><html lang=\"en\" class=\"js-focus-visible lg:[--scroll-mt:9.5rem]\" data-js-focus-visible=\"\">...",
        "metadata": {
          "title": "Build a 'Chat with website' using Groq Llama 3 | Firecrawl",
          "language": "en",
          "sourceURL": "https://docs.firecrawl.dev/learn/rag-llama3",
          "description": "Learn how to use Firecrawl, Groq Llama 3, and Langchain to build a 'Chat with your website' bot.",
          "ogLocaleAlternate": [],
          "statusCode": 200
        }
      },
      ...
    ]
  }
  ```
</CodeGroup>

## Extraction

With LLM extraction, you can easily extract structured data from any URL. We support pydantic schemas to make it easier for you too. Here is how you to use it:

v1 is only supported on node, python and cURL at this time.

<CodeGroup>
  ```python Python
  from firecrawl import JsonConfig, FirecrawlApp
  from pydantic import BaseModel
  app = FirecrawlApp(api_key="<YOUR_API_KEY>")

  class ExtractSchema(BaseModel):
      company_mission: str
      supports_sso: bool
      is_open_source: bool
      is_in_yc: bool

  json_config = JsonConfig(
      schema=ExtractSchema
  )

  llm_extraction_result = app.scrape_url(
      'https://firecrawl.dev',
      formats=["json"],
      json_options=json_config,
      only_main_content=False,
      timeout=120000
  )

  print(llm_extraction_result.json)
  ```

  ```js Node
  import FirecrawlApp from "@mendable/firecrawl-js";
  import { z } from "zod";

  const app = new FirecrawlApp({
    apiKey: "fc-YOUR_API_KEY"
  });

  // Define schema to extract contents into
  const schema = z.object({
    company_mission: z.string(),
    supports_sso: z.boolean(),
    is_open_source: z.boolean(),
    is_in_yc: z.boolean()
  });

  const scrapeResult = await app.scrapeUrl("https://docs.firecrawl.dev/", {
    formats: ["json"],
    jsonOptions: { schema: schema }
  });

  if (!scrapeResult.success) {
    throw new Error(`Failed to scrape: ${scrapeResult.error}`)
  }

  console.log(scrapeResult.json);
  ```

  ```bash cURL
  curl -X POST https://api.firecrawl.dev/v1/scrape \
      -H 'Content-Type: application/json' \
      -H 'Authorization: Bearer YOUR_API_KEY' \
      -d '{
        "url": "https://docs.firecrawl.dev/",
        "formats": ["json"],
        "jsonOptions": {
          "schema": {
            "type": "object",
            "properties": {
              "company_mission": {
                        "type": "string"
              },
              "supports_sso": {
                        "type": "boolean"
              },
              "is_open_source": {
                        "type": "boolean"
              },
              "is_in_yc": {
                        "type": "boolean"
              }
            },
            "required": [
              "company_mission",
              "supports_sso",
              "is_open_source",
              "is_in_yc"
            ]
          }
        }
      }'
  ```
</CodeGroup>

Output:

```json JSON
{
    "success": true,
    "data": {
      "json": {
        "company_mission": "AI-powered web scraping and data extraction",
        "supports_sso": true,
        "is_open_source": true,
        "is_in_yc": true
      },
      "metadata": {
        "title": "Firecrawl",
        "description": "AI-powered web scraping and data extraction",
        "robots": "follow, index",
        "ogTitle": "Firecrawl",
        "ogDescription": "AI-powered web scraping and data extraction",
        "ogUrl": "https://firecrawl.dev/",
        "ogImage": "https://firecrawl.dev/og.png",
        "ogLocaleAlternate": [],
        "ogSiteName": "Firecrawl",
        "sourceURL": "https://firecrawl.dev/"
      },
    }
}
```

### Extracting without schema (New)

You can now extract without a schema by just passing a `prompt` to the endpoint. The llm chooses the structure of the data.

<CodeGroup>
  ```bash cURL
  curl -X POST https://api.firecrawl.dev/v1/scrape \
      -H 'Content-Type: application/json' \
      -H 'Authorization: Bearer YOUR_API_KEY' \
      -d '{
        "url": "https://docs.firecrawl.dev/",
        "formats": ["json"],
        "jsonOptions": {
          "prompt": "Extract the company mission from the page."
        }
      }'
  ```
</CodeGroup>

Output:

```json JSON
{
    "success": true,
    "data": {
      "json": {
        "company_mission": "AI-powered web scraping and data extraction",
      },
      "metadata": {
        "title": "Firecrawl",
        "description": "AI-powered web scraping and data extraction",
        "robots": "follow, index",
        "ogTitle": "Firecrawl",
        "ogDescription": "AI-powered web scraping and data extraction",
        "ogUrl": "https://firecrawl.dev/",
        "ogImage": "https://firecrawl.dev/og.png",
        "ogLocaleAlternate": [],
        "ogSiteName": "Firecrawl",
        "sourceURL": "https://firecrawl.dev/"
      },
    }
}
```

## Interacting with the page with Actions

Firecrawl allows you to perform various actions on a web page before scraping its content. This is particularly useful for interacting with dynamic content, navigating through pages, or accessing content that requires user interaction.

Here is an example of how to use actions to navigate to google.com, search for Firecrawl, click on the first result, and take a screenshot.

It is important to almost always use the `wait` action before/after executing other actions to give enough time for the page to load.

### Example

<CodeGroup>
  ```python Python
  from firecrawl import FirecrawlApp

  app = FirecrawlApp(api_key="fc-YOUR_API_KEY")

  # Scrape a website:
  scrape_result = app.scrape_url('firecrawl.dev', 
      formats=['markdown', 'html'], 
      actions=[
          {"type": "wait", "milliseconds": 2000},
          {"type": "click", "selector": "textarea[title=\"Search\"]"},
          {"type": "wait", "milliseconds": 2000},
          {"type": "write", "text": "firecrawl"},
          {"type": "wait", "milliseconds": 2000},
          {"type": "press", "key": "ENTER"},
          {"type": "wait", "milliseconds": 3000},
          {"type": "click", "selector": "h3"},
          {"type": "wait", "milliseconds": 3000},
          {"type": "scrape"},
          {"type": "screenshot"}
      ]
  )
  print(scrape_result)
  ```

  ```js Node
  import FirecrawlApp, { ScrapeResponse } from '@mendable/firecrawl-js';

  const app = new FirecrawlApp({apiKey: "fc-YOUR_API_KEY"});

  // Scrape a website:
  const scrapeResult = await app.scrapeUrl('firecrawl.dev', { formats: ['markdown', 'html'], actions: [
      { type: "wait", milliseconds: 2000 },
      { type: "click", selector: "textarea[title=\"Search\"]" },
      { type: "wait", milliseconds: 2000 },
      { type: "write", text: "firecrawl" },
      { type: "wait", milliseconds: 2000 },
      { type: "press", key: "ENTER" },
      { type: "wait", milliseconds: 3000 },
      { type: "click", selector: "h3" },
      { type: "scrape" },
      {"type": "screenshot"}
  ] }) as ScrapeResponse;

  if (!scrapeResult.success) {
    throw new Error(`Failed to scrape: ${scrapeResult.error}`)
  }

  console.log(scrapeResult)
  ```

  ```bash cURL
  curl -X POST https://api.firecrawl.dev/v1/scrape \
      -H 'Content-Type: application/json' \
      -H 'Authorization: Bearer YOUR_API_KEY' \
      -d '{
          "url": "google.com",
          "formats": ["markdown"],
          "actions": [
              {"type": "wait", "milliseconds": 2000},
              {"type": "click", "selector": "textarea[title=\"Search\"]"},
              {"type": "wait", "milliseconds": 2000},
              {"type": "write", "text": "firecrawl"},
              {"type": "wait", "milliseconds": 2000},
              {"type": "press", "key": "ENTER"},
              {"type": "wait", "milliseconds": 3000},
              {"type": "click", "selector": "h3"},
              {"type": "wait", "milliseconds": 3000},
              {"type": "screenshot"}
          ]
      }'
  ```
</CodeGroup>

### Output

<CodeGroup>
  ```json JSON
  {
    "success": true,
    "data": {
      "markdown": "Our first Launch Week is over! [See the recap 🚀](blog/firecrawl-launch-week-1-recap)...",
      "actions": {
        "screenshots": [
          "https://alttmdsdujxrfnakrkyi.supabase.co/storage/v1/object/public/media/screenshot-75ef2d87-31e0-4349-a478-fb432a29e241.png"
        ],
        "scrapes": [
          {
            "url": "https://www.firecrawl.dev/",
            "html": "<html><body><h1>Firecrawl</h1></body></html>"
          }
        ]
      },
      "metadata": {
        "title": "Home - Firecrawl",
        "description": "Firecrawl crawls and converts any website into clean markdown.",
        "language": "en",
        "keywords": "Firecrawl,Markdown,Data,Mendable,Langchain",
        "robots": "follow, index",
        "ogTitle": "Firecrawl",
        "ogDescription": "Turn any website into LLM-ready data.",
        "ogUrl": "https://www.firecrawl.dev/",
        "ogImage": "https://www.firecrawl.dev/og.png?123",
        "ogLocaleAlternate": [],
        "ogSiteName": "Firecrawl",
        "sourceURL": "http://google.com",
        "statusCode": 200
      }
    }
  }
  ```
</CodeGroup>

## Open Source vs Cloud

Firecrawl is open source available under the [AGPL-3.0 license](https://github.com/mendableai/firecrawl/blob/main/LICENSE).

To deliver the best possible product, we offer a hosted version of Firecrawl alongside our open-source offering. The cloud solution allows us to continuously innovate and maintain a high-quality, sustainable service for all users.

Firecrawl Cloud is available at [firecrawl.dev](https://firecrawl.dev) and offers a range of features that are not available in the open source version:

![Firecrawl Cloud vs Open Source](https://mintlify.s3.us-west-1.amazonaws.com/firecrawl/images/open-source-cloud.png)

## Contributing

We love contributions! Please read our [contributing guide](https://github.com/mendableai/firecrawl/blob/main/CONTRIBUTING.md) before submitting a pull request.
