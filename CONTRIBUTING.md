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
`feat!:`), merge the release PR it opens, and the release workflow stages the
version on npm with provenance through trusted publishing. A maintainer then
publishes it with 2FA: `npm stage list @floppydata/sdk`, then
`npm stage approve <stage-id>` (npm >= 11.19).

If the release workflow tagged a release but failed before staging it, stage
the existing tag by hand: `gh workflow run release.yml -f publish_tag=vX.Y.Z`.

## Keeping up with the API

The `Sync API spec` workflow (`.github/workflows/sync-spec.yml`) regenerates the
SDK from the production spec and opens a `feat:` or `feat!:` PR on branch
`sync/api-spec` when it changed (breaking changes are detected with oasdiff). The
client-api production deploy triggers it through `repository_dispatch`
(`api-spec-updated`, with the deployed spec's SHA-256 so the workflow waits for
production to serve it); it also runs daily and can be started by hand. Merge the
PR, then merge the release PR that release-please opens.
