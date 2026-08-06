# 1. Introduction and Goals

Geist is a self-hosted web application that tracks product prices across online
retailers and notifies the user on price changes. Its central technical
challenge is **extracting a reliable price from an arbitrary product URL**.

Because no single extraction technique works for every shop, Geist runs several
independent strategies and reconciles them. The strategies are modelled as an
explicit enum:

```ts
// backend/src/services/scraper.ts:17
export type ExtractionMethod = 'json-ld' | 'site-specific' | 'generic-css' | 'ai';
```

## Quality Goals

| Priority | Goal | Rationale (evidence in code) |
| --- | --- | --- |
| 1 | **Extraction correctness** | Multiple methods vote; a price is only trusted when methods agree within 5% — `pricesMatch` (`scraper.ts:42`). |
| 2 | **Robustness against varied sites** | Falls back JSON-LD → site-specific → generic CSS → AI, so unknown shops still have a path (`scraper.ts:1443-1469`). |
| 3 | **User verifiability** | A wrong auto-pick is worse than asking; the API returns candidates for review instead of guessing silently (`products.ts:98-129`). |

## Main Use Case

Add a product URL → extract name, price, image, stock status → let the user
confirm the price → store and re-check on a schedule. The entry point is:

```ts
// backend/src/routes/products.ts:86
const scrapedData = await scrapeProductWithVoting(url, userId);
```
