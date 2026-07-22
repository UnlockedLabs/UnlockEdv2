# AI Tutor Integration — Context for Part B (UnlockEdv2 side)

> **Status: FULLY IMPLEMENTED + LIVE-SMOKED (2026-07-14), uncommitted.** All of Part B
> (B1–B4) plus role-based access and SuperAdmin impersonation are built and running in the
> embedded stack. The B1–B4 sections below are kept as the build recipe / where-it-lives
> reference. Verified live (`docker compose up -d --build`):
>   - migration applied (see the renumber note below), `feature` enum has `ai_tutor`;
>   - **Feature Control** has an **AI Tutor** toggle (SuperAdmin) that flips the flag exactly
>     like every other feature; the sidebar link shows in **both** the admin and resident navs;
>   - kill switch: flag OFF → `curl /tutor/api/me` = **403**; flag ON, no auth = **401**;
>   - `/tutor` = **200** with `X-Frame-Options: SAMEORIGIN`; the embedded iframe is full-bleed;
>   - `/tutor/api/me/select` = **401** unauth in unlocked mode (super-admin-gated student picker);
>   - `tutor.*` schema created via `db:push` (8 tables) and seeded with demo data for
>     facility-1 users via `../ai/unlocked-hiset-ai/lib/db/seed-unlocked.ts`;
>   - **role mapping**: UnlockEd staff (`system_admin`/`facility_admin`/`department_admin`) →
>     tutor **teacher view** (auto-landed); residents → **student**; `/tutor/teacher` is
>     staff-gated server-side; **SuperAdmin** (that role OR username `SuperAdmin`) can
>     impersonate any student via the picker ("Stop impersonating" to return).
> The ONLY unrun step is the browser leg: Kratos-login as a seeded student vs a staff member,
> confirm the role-appropriate view and that a submitted essay lands in `tutor.*` with the
> right `user_id`/`facility_id`. Everything up to the authenticated data write is proven.
> Part A (tutor repo) is done — see its handoff for the data-access layer + the single
> DB-target seam (`lib/db/client.ts`), the identity/role adapters, and `seed-unlocked.ts`.
>
> **MIGRATION RENUMBER (important):** the migration is now
> `00072_add_ai_tutor_feature_flag.sql`, NOT 00070. `00070` and `00071` are already taken on
> other branches (`00070_helpful_links_global_visibility`, `00070_add_facility_feature_flags_table`,
> `00071_add_enrollment_types_to_provider_platforms`), and the dev DB had already recorded
> goose `version_id 70` — so a file numbered 70 was silently skipped (goose tracks numbers,
> not content) and the enum value never got added. Renumbering to 72 fixed it. Keep 72 (or
> rerun `make migration NAME=...` if main has advanced past 72 by merge time).
>
> **Branch:** `CK-7vn/tutor-merge` (already checked out). The original plan said to
> branch `feat/ai-tutor-service` off main — we're instead landing this on the existing
> `CK-7vn/tutor-merge` integration branch. **Commit policy: the repo owner commits.
> Never run `git commit`/`git push`.**

## The two repos

- **Tutor** (the service): `../ai/unlocked-hiset-ai` (sibling checkout), branch
  `unlocked-adapter`. Part A is COMPLETE — see its
  `CK-7vn/2026-07-13-adapter-handoff.md`. The tutor is its own Next.js app served under
  basePath `/tutor`, writes only to the Postgres `tutor.*` schema, reads UnlockEd's
  `users`/`facilities`/`feature_flags` read-only, and validates the Kratos session via
  `GET $KRATOS_PUBLIC_URL/sessions/whoami`. It never imports UnlockEd code.
- **UnlockEdv2** (this repo): needs four changes — a feature flag, a compose service, an
  nginx route, and a nav entry + iframe page.

**Source-of-truth plan** (full task text, Part B section):
`../ai/unlocked-hiset-ai/docs/plans/2026-07-13-unlocked-integration-layer-plan.md`. This
file supersedes that plan's Part B *where they differ* — the notes below are verified
against the current state of this repo (2026-07-13); the plan's line numbers and the
goose `StatementBegin/End` migration style are stale.

## Local development — working on the AI Tutor (start here)

**The two repos must be sibling checkouts.** Compose builds the tutor from a local
relative path (`build.context: ../ai/unlocked-hiset-ai`), so your directory layout has to be:

```
Work/
  UnlockEdv2/                 <- this repo
  ai/unlocked-hiset-ai/       <- the AI Tutor service (its own git repo, branch unlocked-adapter)
```

If your repos aren't in this exact layout, create a symlink so that the `build.context`
path in `docker-compose.yml` (`../ai/unlocked-hiset-ai`) resolves correctly from this
repo's root before running `make dev`.

Docker copies the tutor's working tree straight from `../ai/unlocked-hiset-ai` — no git
remote, no image registry. **Local changes do NOT need to be committed/pushed to appear in
the container**; the build uses whatever is on disk. (You still commit for history and so
the *other* engineers' checkouts get your code — their compose builds from *their* local
copy.)

**Dev loop (tutor changes — hot-reload mode):**

```bash
# Start UnlockEd with the tutor running as a live Next.js dev server:
make dev-tutor
```

`make dev-tutor` uses `docker-compose.dev-tutor.yml` as an override — it mounts
`../ai/unlocked-hiset-ai` directly into the container and runs `npm run dev:docker` instead
of the production build. File saves in the tutor repo are picked up by Next.js HMR
immediately; no container rebuild needed.

`make dev` (without the override) still runs the production image build — use it when you
want to verify the production path or aren't actively editing tutor code.

**Turn the feature on:** log in as SuperAdmin → **Feature Control** → toggle **AI Tutor** on
(toggling via the UI refreshes the server's in-memory feature cache), then **log out and back
in** — feature access is baked into the session at login, so an existing session won't see it
until re-auth. The "AI Tutor" link then appears in the sidebar (admin and resident navs).

**Roles (automatic, by UnlockEd role):** staff (`system_admin`/`facility_admin`/
`department_admin`) land in the tutor's **teacher view**; residents get the **student**
experience. `/tutor/teacher` is staff-gated server-side. A **SuperAdmin** (the `system_admin`
role *or* the username `SuperAdmin`) additionally gets a **Students** picker to impersonate any
student for QA, and a **Stop impersonating** button to return. No one else sees the picker.

**Config switches** (env on the `tutor-service` block in `docker-compose.yml`):

- `AUTH_MODE=unlocked` — Kratos owns identity (embedded default). `standalone` uses the
  student-selector as a login stand-in (dev only; SuperAdmin).
- `DATABASE_URL` — the single DB-target switch. Point at UnlockEd's Postgres (tutor writes
  the isolated `tutor.*` schema) or the tutor's own DB. Nothing else opens a connection.
- `TUTOR_FEATURE_FLAG=ai_tutor`, plus one AI key: `ANTHROPIC_API_KEY` (or `GEMINI_API_KEY` /
  `OPENAI_API_KEY`). Set these in your UnlockEd `.env` — the compose block reads them through.

**Tutor schema:** the tutor owns only `tutor.*` (8 tables). The compose block sets
`RUN_MIGRATIONS=true`, so the container **auto-provisions the schema on start** (idempotent
`CREATE ... IF NOT EXISTS` via `docker/apply-schema.mjs`) — no manual `db:push` for a fresh
dev. `npm run db:push` from the tutor repo is still the schema source of truth for iterating;
regenerate `docker/tutor-schema.sql` from it after changes (see that file's header).

**Demo data:** to seed essays/sessions for existing UnlockEd users (writes `tutor.*` only,
never host tables):

```bash
cd ../ai/unlocked-hiset-ai
DATABASE_URL=postgres://unlocked:dev@localhost:5432/unlocked AUTH_MODE=standalone \
  npx tsx lib/db/seed-unlocked.ts
```

**Gotchas that will bite:**

- Wrong directory layout → compose build fails (the `../ai/unlocked-hiset-ai` path is literal).
- Edited the tutor but don't see it → use `make dev-tutor` (hot-reload mount); `make dev` runs a production build that requires an explicit `docker compose up -d --build tutor-service` to pick up changes.
- Enabled the flag but no nav link → you didn't re-login (feature access is per-session).
- Migration numbering: keep `00072_add_ai_tutor_feature_flag.sql`; renumber only if `main`
  advanced past 72 (goose tracks version *numbers*, not content).

**CI/CD & the published image (tutor repo):** `.github/workflows/ci.yml` runs on every push —
`npm ci` + `npm test`, then builds the production image (`Dockerfile`, multi-stage Next
standalone, non-root) and pushes to **GHCR**:
`ghcr.io/unlockedlabs/unlocked-smart-tutor`. Tags: `:<branch>` + `:sha-<short>` on branch
pushes; a `vX.Y.Z` git tag publishes `:X.Y.Z`, `:X.Y`, and `:latest`.

**Build vs. pull.** The `tutor-service` compose block has both `build:` (sibling checkout)
and `image:` (GHCR), so both modes work from the same file:

- **`make dev-tutor`** — mounts `../ai/unlocked-hiset-ai` as a live volume and runs the
  Next.js dev server inside the container. **Use this when actively editing the tutor** —
  HMR picks up every file save with no rebuild.
- **`make dev`** — builds the tutor production image from `../ai/unlocked-hiset-ai`. Use
  when you want to verify the production path or aren't editing tutor code.
- **`make dev-registry`** — pulls the published image instead (no tutor checkout needed).
  Override the tag with `TUTOR_IMAGE_TAG` (default `unlocked-adapter`; use a `vX.Y.Z` tag for
  a release). Needs `docker login ghcr.io` unless the GHCR package is set to Internal/Public.

For staging/prod, deploy the `image:` with a pinned `vX.Y.Z` tag and `RUN_MIGRATIONS=true`
(or run schema provisioning as a separate step).

## Why it's shaped this way (don't "simplify" these away)

- **basePath `/tutor`**: nginx routes `/api/` to UnlockEd's Go backend (`server:8080`).
  The tutor therefore serves *everything*, including its own API, under `/tutor` so a
  tutor call to `/tutor/api/...` never collides with UnlockEd's `/api/...`. (The tutor's
  client code already prefixes every fetch — that's why basePath is on.)
- **`ai_tutor` feature flag checked server-side**: the tutor calls `isTutorEnabled()`
  against `feature_flags` on every request, so disabling the flag is a real kill switch
  (403), not just a hidden nav link.
- **Same-origin iframe**: the tutor page is an `<iframe src="/tutor">` inside UnlockEd
  chrome. Same origin ⇒ the `ory_kratos_session` cookie flows to the tutor automatically.
  The Go backend sends `X-Frame-Options: DENY` on its own responses, but `/tutor` is
  proxied straight to the tutor, which sets `SAMEORIGIN` itself (done in Part A).

## Verified facts (current repo state, 2026-07-13)

- **AI Tutor migration (shipped):** `backend/migrations/00072_add_ai_tutor_feature_flag.sql`
  (see the renumber note above). `00070`/`00071` were taken on other branches; keep 72 unless
  `main` advances past it by merge time.
- **Migration convention for enum values** (from 00069, the current pattern — NOT the
  StatementBegin/End the old plan shows): use `-- +goose NO TRANSACTION`, then
  `ALTER TYPE feature ADD VALUE IF NOT EXISTS '…';` and
  `INSERT INTO public.feature_flags (name, enabled) VALUES ('…', FALSE) ON CONFLICT (name) DO NOTHING;`.
- **Feature enum (Go):** `backend/src/models/feature_flags.go` — top-level features are a
  `const (…)` block plus the `AllFeatures` slice. `ai_tutor` is a top-level feature (like
  `OpenContentAccess`), not a page-level one.
- **Feature enum (TS):** `frontend/src/types/user.ts` lines 18–25, `enum FeatureAccess`.
- **Sidebar:** `frontend/src/components/navigation/Sidebar.tsx`. Student links live in the
  `StudentNav` function (~line 289); it already imports `hasFeature`, `FeatureAccess`, and
  **`AcademicCapIcon`** (line 19) — no new import needed. Existing gated links use
  `hasFeature(user, FeatureAccess.X) && <NavLink to=… icon=… label=… active={isActive([…])} collapsed={collapsed} onClick={onNavigate} />`.
- **Routes:** modules live in `frontend/src/routes/*.tsx` and are registered in the
  `createBrowserRouter([...])` array in `frontend/src/routes/index.tsx`. Pattern:
  `declareAuthenticatedRoutes([{ path, element, handle:{title} }], AllRoles, [FeatureAccess.X])`
  (see `knowledge-routes.tsx`). `AllRoles`/`AdminRoles` from `@/auth/useAuth`.
- **Iframe page reference:** `frontend/src/pages/knowledge-center/LibraryViewer.tsx`
  (heavier than we need — copy only its layout wrapper feel, not its bookmark/tour logic).
- **nginx dev config:** `config/dev.nginx.conf` — has `location /api/` → `server:8080`,
  `location /sessions/` → `kratos:4433`, and `location /` → `frontend:5173`. Add a
  `location /tutor` block. Served by the `rev_proxy` (nginx:1.21.3-alpine) service.
- **docker-compose:** services share the `intranet` network. Postgres is
  `postgres://unlocked:dev@postgres:5432/unlocked` (host port `5432:5432`). Kratos public
  at `http://kratos:4433`. The `server` service shows the env style to match.
- **Run/migrate:** `make dev` (stack up), `make migration NAME=add_ai_tutor_feature_flag`
  (scaffold), `make migrate` (apply). `make install-dep` installs goose if missing.

---

## B1 — `ai_tutor` feature flag

**Files:** new `backend/migrations/00072_add_ai_tutor_feature_flag.sql` (see renumber note above);
`backend/src/models/feature_flags.go`; `frontend/src/types/user.ts`.

1. Migration (match 00069's style exactly):

```sql
-- +goose Up
-- +goose NO TRANSACTION
ALTER TYPE feature ADD VALUE IF NOT EXISTS 'ai_tutor';

INSERT INTO public.feature_flags (name, enabled)
VALUES ('ai_tutor', FALSE)
ON CONFLICT (name) DO NOTHING;

-- +goose Down
DELETE FROM public.feature_flags WHERE name = 'ai_tutor';
```

(Prefer `make migration NAME=add_ai_tutor_feature_flag` to get the next number/timestamp,
then paste the body — it also runs `goose fix`.)

2. `feature_flags.go`: add `AiTutorAccess FeatureAccess = "ai_tutor"` to the top-level
   `const (…)` block and append `AiTutorAccess` to the `AllFeatures` slice.

3. `user.ts`: add `AiTutorAccess = 'ai_tutor'` to the `FeatureAccess` enum.

**Verify:** `make migrate`, then enable it (admin feature-flags UI, or
`UPDATE feature_flags SET enabled = TRUE WHERE name = 'ai_tutor';`).

## B2 — compose service + nginx route

**Files:** `docker-compose.yml`, `config/dev.nginx.conf`.

1. Add a service (style-match `server`; build context is the sibling tutor checkout —
   fine for the dev branch, swap for a published image in the pilot):

```yaml
tutor-service:
  build:
    context: ../ai/unlocked-hiset-ai
  networks:
    - intranet
  environment:
    - AUTH_MODE=unlocked
    - DATABASE_URL=postgres://unlocked:dev@postgres:5432/unlocked
    - KRATOS_PUBLIC_URL=http://kratos:4433
    - TUTOR_FEATURE_FLAG=ai_tutor
    - AI_PROVIDER=${TUTOR_AI_PROVIDER:-anthropic}
    - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY:-}
    - GEMINI_API_KEY=${GEMINI_API_KEY:-}
  depends_on:
    postgres:
      condition: service_healthy
    kratos:
      condition: service_started
```

2. `config/dev.nginx.conf` — add **above** `location /` (so it wins; nginx prefix-matches
   `/tutor` and `/tutor/...`). No trailing slash on `proxy_pass` — the app serves under
   basePath `/tutor`, so the URI must pass through unmodified:

```nginx
location /tutor {
  proxy_pass http://tutor-service:3000;
  proxy_http_version 1.1;
  proxy_set_header Host $host;
  proxy_set_header X-Forwarded-Proto $scheme;
  proxy_set_header X-Forwarded-Host $host;
}
```

3. Tutor tables in the shared DB: from the tutor repo, once, run
   `DATABASE_URL=postgres://unlocked:dev@localhost:5432/unlocked npm run db:push`. Safe —
   all tutor objects live in the `tutor.*` schema and drizzle-kit is scoped to it via
   `schemaFilter`, so UnlockEd's `public` objects are invisible to it. (A migrate-on-start
   entrypoint is deferred; tracked in the tutor repo TODO.)

**Verify:** `make dev`, then `curl -sI http://localhost/tutor` → a 200/307 from Next (not
an nginx 502) with `X-Frame-Options: SAMEORIGIN`.

## B3 — nav entry + embedded tutor page

**Files:** new `frontend/src/pages/AiTutor.tsx`; new
`frontend/src/routes/tutor-routes.tsx` (register in `routes/index.tsx`); edit
`frontend/src/components/navigation/Sidebar.tsx` (`StudentNav`).

1. `AiTutor.tsx` — thin iframe (match the height/layout wrapper of neighboring student
   pages when you build it):

```tsx
export default function AiTutor() {
    return (
        <div className="w-full h-[calc(100vh-4rem)]">
            <iframe
                sandbox="allow-same-origin allow-scripts allow-forms"
                className="w-full h-full border-0"
                src="/tutor"
                title="AI Tutor"
            />
        </div>
    );
}
```

2. `tutor-routes.tsx` (mirror `knowledge-routes.tsx`), then add `TutorRoutes` to the
   `createBrowserRouter([...])` array in `routes/index.tsx`:

```tsx
import { declareAuthenticatedRoutes } from '@/auth/declareAuthenticatedRoutes';
import { AllRoles } from '@/auth/useAuth';
import { FeatureAccess } from '@/types';
import AiTutor from '@/pages/AiTutor';
import type { RouteObject } from 'react-router-dom';

export const TutorRoutes: RouteObject = declareAuthenticatedRoutes(
    [{ path: 'ai-tutor', element: <AiTutor />, handle: { title: 'AI Tutor' } }],
    AllRoles,
    [FeatureAccess.AiTutorAccess]
);
```

3. `Sidebar.tsx` `StudentNav` — add after the Knowledge Center `NavLink` (imports for
   `hasFeature`, `FeatureAccess`, `AcademicCapIcon` already exist):

```tsx
{hasFeature(user, FeatureAccess.AiTutorAccess) && (
    <NavLink
        to="/ai-tutor"
        icon={AcademicCapIcon}
        label="AI Tutor"
        active={isActive(['/ai-tutor'])}
        collapsed={collapsed}
        onClick={onNavigate}
    />
)}
```

**Verify:** flag on → "AI Tutor" appears in the student sidebar → click → tutor loads
embedded (no new tab). Flag off → link disappears.

> **As shipped (beyond this recipe):** the nav link was added to **both** `AdminNav` and
> `StudentNav` (staff and residents), and a **SuperAdmin-only "AI Tutor" card** was added to
> the Feature Control page (`frontend/src/pages/admin/FeatureControl.tsx`) so the flag can be
> toggled from the UI. The iframe page opts into the layout's full-bleed treatment
> (`AuthenticatedLayout.tsx` + `AiTutor.tsx` at `h-[calc(100vh-4rem)]`). Role-appropriate
> landing and the SuperAdmin student picker live in the **tutor** repo (identity adapters,
> `app/teacher/layout.tsx` gate, `app/page.tsx` routing, `app/api/me/select`).

## B4 — end-to-end smoke (the demo script)

> **Status:** steps 1 and 4–6 verified via curl/container smoke (see the status header).
> Steps 2–3 (the interactive Kratos-login → submit → row-ownership check) are the one unrun
> leg — they need a real browser session. Run them as both a resident and a staff member to
> confirm the role split.

1. `make dev` with `ai_tutor` enabled and a real AI key exported.
2. Log in through Kratos as a seeded student → "AI Tutor" in sidebar → click → embedded
   tutor loads inside UnlockEd chrome.
3. `psql` the shared DB: the student's activity lands in `tutor.*` tables with `user_id` =
   the UnlockEd user id and their real `facility_id`.
4. Ask the tutor a math question → correct guarded answer.
5. As an admin, disable `ai_tutor` → nav entry disappears AND
   `curl -s http://localhost/tutor/api/me -H "Cookie: <student session>"` → **403**
   (server-side kill switch, not just UI).
6. Confirm the tutor still runs standalone from its own repo (zero UnlockEd deps).

## Risks / notes

- **Two-repo coordination**: this needs an UnlockEd-side reviewer committed early or it
  stalls. Flag it before starting.
- The `ALTER TYPE … ADD VALUE` cannot run in a txn — that's why the migration uses
  `-- +goose NO TRANSACTION`. Don't wrap it.
- Build context `../ai/unlocked-hiset-ai` assumes the sibling checkout; note in the PR that
  the pilot will pull a published image instead.
- The tutor validates sessions by calling `http://kratos:4433/sessions/whoami` directly on
  `intranet` (not via nginx) — kratos must be reachable on that network (it is).
