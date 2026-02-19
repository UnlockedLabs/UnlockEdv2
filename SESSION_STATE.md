# Session State

## Current status
- Facility dashboard aligned with Carolina: metrics, missing attendance, today's schedule, grey background, spacing fixes.
- Missing attendance service uses DST-safe canonical time and filters future occurrences.
- Department admin now pulls all facilities' classes via `facility=all` support.
- Facility health heading layout matches Carolina (heading outside table card).

## Key file changes
### Backend
- `backend/src/database/dashboard.go`: attendance concerns now based only on 3+ unexcused absences.
- `backend/src/services/classes.go`: missing attendance business logic, DST canonical time, future filter.
- `backend/src/handlers/classes_handler.go`: missing attendance endpoint uses service; `/api/program-classes` supports `facility=all`.
- `backend/src/database/events_attendance.go`: query helpers for missing attendance.
- `backend/src/database/class_events.go`: exported `GenerateEventInstances`.
- `backend/src/database/program_classes.go`: added `GetClasses` with optional facility; `GetClassesForFacility` delegates.

### Frontend
- `frontend-v2/src/pages/Dashboard.tsx`: metrics from `/api/dashboard/class-metrics`, missing attendance wiring, today’s schedule attendance route fix, layout/spacing updates, dept admin classes fetch uses `facility=all`, memoization for `allClasses`/`programs`.

## Current endpoints in use
- `GET /api/dashboard/class-metrics` (dept admin uses `?facility=all`)
- `GET /api/program-classes?facility=all&all=true` (dept admin)
- `GET /api/program-classes/missing-attendance?facility=all&days=3&all=true`

## Next steps (if needed)
1) Add a department-admin backend endpoint for per-facility health metrics (program count, missing attendance, attendance concerns) and wire `FacilityHealthTable` to it.
2) Final layout adjustments to department admin view to match Carolina pixel-for-pixel if any remain.
