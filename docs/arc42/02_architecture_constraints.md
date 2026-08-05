# 2. Architecture Constraints

## Technical Constraints

| Constraint | Evidence |
| --- | --- |
| **Node.js + TypeScript backend** | `backend/src/**/*.ts` |
| **Static fetch via axios + cheerio** | `import axios ...` / `import { load } from 'cheerio'` (`scraper.ts:1-2`) |
| **JS rendering via puppeteer-extra + stealth plugin** (only fallback) | `puppeteer.use(StealthPlugin());` (`scraper.ts:12`) |
| **Pluggable AI providers** (Anthropic / OpenAI / Gemini / Ollama) | `backend/src/services/ai-extractor.ts` |
| **PostgreSQL for persistence** | `docker-compose.yml`, `database/init.sql` |
| **Self-hosted, containerized deployment** | `docker-compose.prod.yml`, `Caddyfile` |

## Design Constraints (imposed by the current implementation)

- **One HTML document per extraction.** The static methods (JSON-LD,
  site-specific, generic CSS) all parse the *same* fetched HTML — they do not
  each fetch independently (`scraper.ts:1437-1458`).
- **Single HTTP attempt, no retry loop**, 20 s timeout, `en-US` locale
  hardcoded:

  ```ts
  // backend/src/services/scraper.ts:1409-1423
  'Accept-Language': 'en-US,en;q=0.9',
  ...
  timeout: 20000,
  maxRedirects: 5,
  ```

- **Browser fallback is narrowly gated.** Puppeteer is used only for a hardcoded
  allowlist, on HTTP `403`, or when static extraction yields zero candidates
  (see [chapter 4](04_solution_strategy.md)). This constrains which sites can
  succeed.
- **Errors are logged, not surfaced.** The orchestrator swallows failures and
  returns an empty result:

  ```ts
  // backend/src/services/scraper.ts:1741-1745
  } catch (error) {
    console.error(`[Voting] Error scraping ${url}:`, error);
  }
  return result;
  ```

  The route then reports a single generic message
  (`"Could not extract price from the provided URL"`, `products.ts:89-93`) — the
  user is not told *why* (blocked vs. no price).
