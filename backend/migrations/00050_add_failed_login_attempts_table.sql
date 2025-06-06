-- +goose Up
-- +goose StatementBegin
CREATE TABLE IF NOT EXISTS public.failed_login_attempts (
    user_id INTEGER NOT NULL PRIMARY KEY, 
    first_attempt_at timestamptz NOT NULL DEFAULT NOW(),
    last_attempt_at timestamptz NOT NULL DEFAULT NOW(),
    attempt_count integer NOT NULL DEFAULT 0, 
    locked_until timestamptz NULL,
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS user_failed_login_attempts_user_id_idx ON public.failed_login_attempts(user_id);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE IF EXISTS public.failed_login_attempts CASCADE;
-- +goose StatementEnd
