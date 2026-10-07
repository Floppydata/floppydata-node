// Web Data: check balance -> search -> fetch the top results -> report usage.
//
//   FLOPPYDATA_API_KEY=... npx tsx examples/01-web-data.ts

import { FloppyData, FloppyDataError } from '@floppydata/sdk';

const fd = new FloppyData({ baseUrl: process.env.FLOPPYDATA_BASE_URL });

const QUERY = 'browser automation frameworks';
const PAGES_TO_FETCH = 3;

// 1. Make sure we can afford one search plus N page fetches.
const { data: balance } = await fd.getWebDataBalance();
console.log(`Web Data requests remaining: ${balance.requests.remaining}`);
if (balance.requests.remaining < 1 + PAGES_TO_FETCH) {
  throw new Error('Not enough Web Data requests left');
}

// 2. Search the web (consumes 1 request).
const { data: search } = await fd.searchWebData({ query: QUERY, numResults: 10 });
console.log(`Search ${search.requestId}: ${search.results.length} results`);
for (const result of search.results) {
  console.log(`  - ${result.title} (${result.url})`);
}

// 3. Fetch rendered HTML for the top results (1 request each).
//    One failed page should not stop the others.
for (const result of search.results.slice(0, PAGES_TO_FETCH)) {
  try {
    const { data: page } = await fd.fetchWebData({
      url: result.url,
      countryCode: 'US',
      difficulty: 'auto', // retries low -> medium -> high on non-2xx
      renderDelayMs: 2000,
      cacheMaxAgeDays: 1, // accept a cached copy up to 1 day old
    });
    const title = /<title>(.*?)<\/title>/is.exec(page.html)?.[1]?.trim();
    console.log(`Fetched ${page.sourceUrl}: ${page.html.length} bytes, title "${title}"`);
  } catch (error) {
    if (!(error instanceof FloppyDataError)) throw error;
    console.error(`Fetch ${result.url} failed: ${error.code} (HTTP ${error.status})`);
  }
}

// 4. Usage rollups, plus an explicit date range.
const { data: usage } = await fd.getWebDataUsage({ from: '2026-09-01', to: '2026-09-30' });
const { yesterday, last7Days, last30Days, requestedRange } = usage.requests;
console.log('Web Data usage (total / successful / failed):');
console.log(`  yesterday:    ${yesterday.total} / ${yesterday.successful} / ${yesterday.failed}`);
console.log(`  last 7 days:  ${last7Days.total} / ${last7Days.successful} / ${last7Days.failed}`);
console.log(`  last 30 days: ${last30Days.total} / ${last30Days.successful} / ${last30Days.failed}`);
if (requestedRange) {
  console.log(`  ${usage.filters.from}..${usage.filters.to}: ${requestedRange.total}`);
}
