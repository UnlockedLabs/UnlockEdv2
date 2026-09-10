-- +goose Up
-- +goose NO TRANSACTION
-- Login resolves users with LOWER(username) = ? so a username can be typed in any
-- casing (ID-849). idx_users_username (migration 00002) is a plain btree on the raw
-- value and cannot serve that predicate, which would leave every login attempt —
-- including unauthenticated failures — sequentially scanning users.
--
-- CONCURRENTLY so building the index does not block writes to users, which is the
-- table every login reads. Postgres forbids concurrent index operations inside a
-- transaction, hence NO TRANSACTION — note that goose applies that directive to the
-- whole file, so the Down below runs unwrapped too and is likewise concurrent.
-- Trade-off: an interrupted run can leave an INVALID index behind, which has to be
-- dropped manually before re-running.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_username_lower ON public.users (LOWER(username));

-- +goose Down
DROP INDEX CONCURRENTLY IF EXISTS public.idx_users_username_lower;
