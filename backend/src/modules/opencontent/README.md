# Open Content module

Libraries (Kiwix), videos (YouTube), helpful links, favorites, reading
activity and the content proxies. It moved here from core in EN-192.

## Boundaries

- **It imports nothing from core.** It talks to core only through
  `modules/module` (the seam) and `unlocked-contracts`. depguard in
  `backend/.golangci.yml` enforces this.
- **Core asks it questions through `api/`** (interfaces and plain types only),
  and gets the implementation from `registry.OpenContent`. Core never imports
  this package's insides.
- **Core still owns:**
  - the websocket, which Open Content messages through `Deps.Notify`;
  - the scheduled jobs (`scrape_kiwix`, `retry_video_downloads`,
    `sync_video_metadata`), until EN-196;
  - three plain SQL reads of Open Content's tables (facility list, facility
    delete check, user engagement), until EN-198.

## Files

| File | What it holds |
|---|---|
| `module.go` | Registers the routes, sets up AWS and the `library_paths` cache, seeds a new database, lists the test tables |
| `handlers.go` | The API routes, with their access levels and feature flags |
| `proxy.go` | The library proxy (to Kiwix) and the video proxy (to S3) |
| `service.go` | Facility visibility, recording visits, the content-request email, the library cache |
| `store.go` | Every database query |
| `api.go` | The answers to core's questions (`api.OpenContent`) |
| `models.go` | Open Content's tables as Go types |
| `jobs.go` | The video jobs the routes publish to provider-middleware |
| `http.go` | Responses, errors, paging and request helpers, matching core's JSON |
| `migrations/` | This module's own migrations (none yet; its tables come from core's) |

## Tests

- `backend/tests/integration/open_content_routes_test.go` pins every route's
  status, JSON, access level and feature flags against the saved responses in
  `testdata/open_content/`. After an intended change, regenerate them from
  `backend/` with:

  ```bash
  go test ./tests/integration -run 'TestOpenContent' -update
  ```

  The changed JSON then shows in the PR for review.
- The tests run on SQLite, which can't run search (Postgres full-text search
  and Kiwix), the library proxy (NATS), the content-request email (SES) or the
  video jobs (NATS). Check those with `make dev`.
