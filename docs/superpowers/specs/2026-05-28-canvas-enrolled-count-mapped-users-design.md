# Canvas Enrolled Count — Mapped Users Only

**Date:** 2026-05-28

## Problem

Two backend handlers populate the `enrolled` field on Canvas classes using `total_students` from the Canvas API. This is a raw Canvas count that includes students who have no `ProviderUserMapping` in UnlockEd. The result is that the enrollment card (StatCards) on the class detail page and the class list view show a count that does not match the roster, which correctly filters to mapped users only.

**Exempt:** The manage-users page for a Canvas connection legitimately needs all Canvas users (for the admin mapping workflow) and is not changed.

## Affected Handlers

| Handler | File | Issue |
|---|---|---|
| `handleGetCanvasClassDetail` | `backend/src/handlers/canvas_programs.go:267` | Uses `total_students` from course detail API |
| `handleGetCanvasClasses` | `backend/src/handlers/canvas_programs.go:173` | Uses `total_students` from courses list API |
| `handleGetCanvasClassEnrollments` | `backend/src/handlers/canvas_programs.go:357` | Already correct — filters to mapped users |

## Design

### Helper method

Add a method on `Server` in `canvas_programs.go`:

```go
func (srv *Server) countMappedCanvasEnrollees(provider *models.ProviderPlatform, rawCourseID uint) (int64, error)
```

1. Calls Canvas: `GET {baseUrl}/api/v1/courses/{rawCourseID}/enrollments?type[]=StudentEnrollment&state[]=active&per_page=100`
2. Extracts Canvas user ID strings from each enrollment's `user.id` field
3. Queries: `SELECT COUNT(*) FROM provider_user_mappings WHERE provider_platform_id = ? AND external_user_id IN ?`
4. Returns the count, or an error

This mirrors the filtering logic already in `handleGetCanvasClassEnrollments` (lines 395–425) but returns a count instead of full rows.

### `handleGetCanvasClassDetail`

- Remove `?include[]=total_students` from the Canvas course detail URL
- After decoding the course JSON, call `countMappedCanvasEnrollees(provider, rawCourseID)`
- Assign the result to `enrolled` (keep `int64` type, return 0 on error with a log warning rather than failing the whole request)

### `handleGetCanvasClasses`

- Remove `include[]=total_students` from the Canvas courses list URL
- After building the `classes` slice, concurrently count mapped enrollees:
  - Allocate a `sync.Mutex`-protected `map[uint]int64` keyed by `rawCourseID`
  - Launch one goroutine per course via `sync.WaitGroup`; each calls `countMappedCanvasEnrollees`
  - After `wg.Wait()`, update each class's `Enrolled` and `ProgramClass.Enrolled` from the map
- If a per-course count fails, log a warning and leave `enrolled = 0` for that course rather than failing the whole list

## Error Handling

Count failures are non-fatal: log at warn level and use 0 as the fallback. This ensures a Canvas API hiccup on one course doesn't break the whole class list or detail page.

## Out of Scope

- Pagination of Canvas enrollments beyond 100 per course (pre-existing limitation)
- Frontend changes (the `enrolled` field shape is unchanged)
- Any changes to the user matching / manage-users workflow
