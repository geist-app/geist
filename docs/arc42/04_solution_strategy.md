# 4. Solution Strategy

The core problem — extracting a trustworthy price from an unknown site — is
solved by **multi-strategy extraction with voting**, orchestrated in
`scrapeProductWithVoting` (`scraper.ts:1362`).

## 4.1 Fetch strategy: static first, browser as fallback

A plain axios GET is the default. A headless (stealth) browser is used only when:

1. the site is on a hardcoded JS-heavy allowlist,

   ```ts
   // backend/src/services/scraper.ts:1384-1390
   const jsHeavySites = [
     /bestbuy\.com/i, /target\.com/i, /walmart\.com/i, /costco\.com/i,
   ];
   const requiresBrowser = jsHeavySites.some(pattern => pattern.test(url));
   ```

2. the static fetch returns **HTTP 403**,

   ```ts
   // backend/src/services/scraper.ts:1427-1430
   if (axiosError instanceof AxiosError && axiosError.response?.status === 403) {
     html = await scrapeWithBrowser(url);
     usedBrowser = true;
   ```

3. or static extraction produced **zero candidates**,

   ```ts
   // backend/src/services/scraper.ts:1461
   if (allCandidates.length === 0 && !usedBrowser) {
   ```

> **Known limitation.** Sites that are JS-rendered *and* return 200/429/503 from
> a bot wall (e.g. rossmann.de, zara.com) match none of these triggers, so the
> browser fallback never runs and extraction fails. The challenge-wait loop also
> only recognizes Cloudflare titles (`scraper.ts:292`), not Akamai/DataDome.

## 4.2 Anti-bot handling

The headless browser uses the stealth plugin, non-automation launch flags,
human-like input, and a Cloudflare challenge wait:

```ts
// backend/src/services/scraper.ts:250-265
async function scrapeWithBrowser(url: string): Promise<string> {
  const browser = await puppeteer.launch({
    headless: true,
    args: [ '--no-sandbox', '--disable-blink-features=AutomationControlled', ... ],
    ignoreDefaultArgs: ['--enable-automation'],
  });
```

## 4.3 Four extraction methods

Run against the fetched HTML and merged into one candidate list
(`scraper.ts:1443-1458`):

| # | Method | Function | Confidence |
| --- | --- | --- | --- |
| 1 | JSON-LD structured data | `extractJsonLdCandidates` (`scraper.ts:90`) | 0.9 |
| 2 | Site-specific scrapers | `extractSiteSpecificCandidates` (`scraper.ts:127`) | 0.85 |
| 3 | Generic CSS selectors | `extractGenericCssCandidates` (`scraper.ts:173`) | 0.6 |
| 4 | AI / LLM | `ai-extractor.ts` (extract / arbitrate / verify) | — |

Site-specific scrapers are a lookup table matched by URL; only a fixed set of
retailers is covered (Amazon, Walmart, Best Buy, Target, eBay, Newegg, Home
Depot, Costco, AliExpress, and a generic Magento 2 matcher):

```ts
// backend/src/services/scraper.ts:335-338
const siteScrapers: SiteScraper[] = [
  // Amazon
  { match: (url) => /amazon\.(com|co\.uk|ca|de|fr|es|it|co\.jp|in|com\.au)/i.test(url),
```

## 4.4 Reconciliation: consensus, then AI, then the user

Candidates are grouped by price (within 5%); the largest group wins:

```ts
// backend/src/services/scraper.ts:42-46
function pricesMatch(price1: number, price2: number): boolean {
  ...
  return (diff / avg) < 0.05; // Within 5%
}
```

When methods disagree, AI arbitration (`tryAIArbitration`, `ai-extractor.ts:1155`)
picks a candidate. If still ambiguous, the API defers to the user by returning
the candidate list for manual confirmation:

```ts
// backend/src/routes/products.ts:113-118
res.status(200).json({
  needsReview: true,
  ...
  priceCandidates: candidates.map(c => ({ ... })),
```

This layering — deterministic methods → voting → AI → human — is the central
architectural decision that trades full automation for correctness.
