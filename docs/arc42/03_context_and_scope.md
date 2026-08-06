# 3. Context and Scope

## System Scope

Geist accepts a product URL from an authenticated user, extracts price data from
the target retailer, persists it, and pushes notifications on change. The add
route is the boundary between the user and the extraction subsystem:

```ts
// backend/src/routes/products.ts:24
router.post('/', async (req: AuthRequest, res: Response) => {
  ...
  const { url, refresh_interval, selectedPrice, selectedMethod } = req.body;
```

## External Systems (Business Context)

| Neighbor | Direction | Role |
| --- | --- | --- |
| **User (browser SPA)** | in/out | Submits URLs, confirms the extracted price candidate. |
| **Retailer websites** | out | Scraped for price/name/image/stock (Amazon, Walmart, eBay, … — see chapter 4). Fetched over HTTP or, as a fallback, a headless browser. |
| **AI provider** (Anthropic / OpenAI / Gemini / Ollama) | out | Extracts, arbitrates and verifies prices from HTML when deterministic methods disagree or fail — `backend/src/services/ai-extractor.ts`. |
| **Notification providers** (Telegram, Pushover, ntfy, Gotify) | out | Deliver price-change alerts — `backend/src/services/notifications.ts`. |
| **PostgreSQL** | out | Stores products, price history and stock history. |

## Technical Context

- **Inbound:** HTTPS from the SPA, terminated by Caddy (automatic TLS), proxied
  to the backend API — `Caddyfile`, `docker-compose.prod.yml`.
- **Outbound to retailers:** default path is an axios GET with a
  browser-imitating header set; the stealth headless browser is a conditional
  fallback (`scraper.ts:1396-1434`).
- **Outbound to AI/notification providers:** HTTPS to third-party APIs, selected
  per user configuration.

Everything inside this boundary (extraction strategies, voting, persistence) is
in scope for this documentation; the retailer sites and provider APIs are
external and out of Geist's control — a key driver for the solution strategy.
