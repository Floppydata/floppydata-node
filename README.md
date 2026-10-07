# Floppydata TypeScript SDK

Typed client for the [Floppydata](https://floppydata.com) Client API v2: Web Data
(search and page fetching), rotating and static proxies, Cloud Browser sessions,
and account balances and usage.

```bash
npm install @floppydata/sdk
```

Requires Node.js 18 or newer. The package is ESM-only.

## Quick start

Create a Client API key at https://app.floppydata.com/api-keys.

```ts
import { FloppyData } from '@floppydata/sdk';

const fd = new FloppyData({ apiKey: process.env.FLOPPYDATA_API_KEY });

const { data: balances } = await fd.getAccountBalances();
console.log(balances.webData?.requests.remaining);

const { data: page } = await fd.fetchWebData({ url: 'https://example.com', difficulty: 'auto' });
console.log(page.html.length);
```

If `apiKey` is omitted, the client reads `FLOPPYDATA_API_KEY` from the environment.
Keep the key on the server: anyone holding it can spend your balance.

Every method takes one object with its parameters and returns `{ data, request, response }`.
Parameters and responses are fully typed, and each method's documentation comes
from the API reference at https://api.floppydata.net/docs.

## Methods

| Product | Methods |
| --- | --- |
| Web Data | `searchWebData`, `fetchWebData`, `getWebDataBalance`, `getWebDataUsage` |
| Rotating proxy | `buildRotatingProxyConnection`, `listRotatingProxyLocations`, `getRotatingProxyBalance`, `getRotatingProxyUsage`, `listRotatingProxyRequests`, `listRotatingProxySubusers`, `createRotatingProxySubuser`, `deleteRotatingProxySubuser` |
| Static proxy | `listStaticProxies` |
| Proxy tools | `checkProxy` |
| Account | `getAccountBalances`, `getAccountUsage` |
| Cloud Browser | `createBrowserSession`, `getBrowserSession`, `listBrowserSessions`, `stopBrowserSession`, `createBrowserSessionLiveView`, `deleteBrowserSession`, `deleteBrowserSettings` |

Response types are exported by name, for example `BrowserSession`, `Subuser`,
`StaticProxy`, `RotatingProxyConnection` and `ApiError`.

## Errors

Methods throw `FloppyDataError` when the API answers with a non-2xx status:

```ts
import { FloppyData, FloppyDataError } from '@floppydata/sdk';

try {
  await fd.fetchWebData({ url: 'https://example.com' });
} catch (error) {
  if (error instanceof FloppyDataError) {
    error.status; // 402
    error.code; // 'insufficient_balance'
    error.details; // { requestId, recoveryHint, target, ... }
  }
  throw error;
}
```

`code` is one of the documented `ApiErrorCode` values, or `'unknown_error'` when
the response was not a Floppydata JSON error. Network failures are not wrapped and
surface as the original `fetch` error.

To branch on errors without exceptions, pass `{ throwOnError: false }` as the
second argument. `error` is then the parsed API error body:

```ts
const result = await fd.getWebDataBalance({ throwOnError: false });
if (result.error) {
  console.error(result.error.error.code);
} else {
  console.log(result.data.requests.remaining);
}
```

## Cloud Browser

`createBrowserSession` returns a `connectUrl` for Playwright or Puppeteer:

```ts
import { chromium } from 'playwright-core';

const { data: session } = await fd.createBrowserSession({ persist: { ttlSeconds: 3600 } });
const browser = await chromium.connectOverCDP(session.connectUrl!);
// ...
await fd.stopBrowserSession({ sessionId: session.id });
```

Pass `settings: { id }` from an earlier persistent session to restore its
fingerprint, proxy IP, cookies and storage.

## Configuration

```ts
new FloppyData({
  apiKey: '...', // default: process.env.FLOPPYDATA_API_KEY
  baseUrl: 'https://api.floppydata.net', // default
  fetch: customFetch, // default: global fetch
});
```

## Examples

[`examples/`](examples) has runnable end-to-end flows for each product:

| File | Flow |
| --- | --- |
| `01-web-data.ts` | Check balance, search, fetch top results, report usage |
| `02-rotating-proxy.ts` | Create a subuser, pick a location, build and verify a connection, read usage and request history |
| `03-static-proxy.ts` | List static IPs and health-check each one |
| `04-account.ts` | Balances and usage across products |
| `05-cloud-browser.ts` | Persistent session with Playwright, live view, reuse saved state, clean up |
| `06-error-handling.ts` | Error codes, `settings_in_use` recovery, non-throwing style |

```bash
pnpm install
FLOPPYDATA_API_KEY=... pnpm exec tsx examples/04-account.ts
```

Examples 01, 02, 05 and 06 spend Web Data requests, proxy traffic or browser time.

## Versioning

The SDK follows semantic versioning, independently of the API version. While it
is `0.x`, minor versions may contain breaking changes. See [CHANGELOG.md](CHANGELOG.md).

## Development

Most of the code is generated from the API's OpenAPI spec with
[`@hey-api/openapi-ts`](https://heyapi.dev). `src/gen` is generated output: do not
edit it. Change [`openapi-ts.config.ts`](openapi-ts.config.ts) or the API itself.

```bash
pnpm sync-spec   # download the production spec into openapi/v2.json
pnpm generate    # regenerate src/gen
pnpm typecheck && pnpm lint && pnpm test
```

The hand-written parts are `src/floppyData.ts` (client setup) and `src/errors.ts`.

CI fails when `src/gen` does not match the committed spec. On `main`, it also runs
every example against a test environment set by the `FLOPPYDATA_STAGING_BASE_URL`
and `FLOPPYDATA_STAGING_API_KEY` repository secrets; without both, that job is
skipped.

Releases use [release-please](https://github.com/googleapis/release-please): commit
with [Conventional Commits](https://www.conventionalcommits.org) (`feat:`, `fix:`,
`feat!:`), merge the release PR it opens, and the release workflow publishes to npm
with provenance through trusted publishing.

## License

MIT
