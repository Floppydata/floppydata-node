# Changelog

## 0.1.0 (2026-10-07)


### ⚠ BREAKING CHANGES

* `ApiErrorCode` no longer includes `upstream_error`; match `service_error` and read `details.serviceStatus` instead.

### Features

* regenerate from the Client API v2 spec without provider references ([75f73bc](https://github.com/Floppydata/floppydata-node/commit/75f73bc23ee156849efe467753dceacec56978b8))
* TypeScript SDK for the Floppydata Client API v2 ([c4047ed](https://github.com/Floppydata/floppydata-node/commit/c4047edf961674850ba58ec68d9f84256a51e28f))
