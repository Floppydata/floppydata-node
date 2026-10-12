# Contributing

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
