-- +goose Up
-- Login resolves users with LOWER(username) = ? so a username can be typed in any
-- casing (ID-849). idx_users_username (migration 00002) is a plain btree on the raw
-- value and cannot serve that predicate, which would leave every login attempt —
-- including unauthenticated failures — sequentially scanning users.
CREATE INDEX IF NOT EXISTS idx_users_username_lower ON public.users (LOWER(username));

-- +goose Down
DROP INDEX IF EXISTS public.idx_users_username_lower;
