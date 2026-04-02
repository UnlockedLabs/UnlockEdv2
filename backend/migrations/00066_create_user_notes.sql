-- +goose Up
CREATE TABLE IF NOT EXISTS public.user_notes (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    note TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    create_user_id INTEGER NOT NULL REFERENCES public.users(id),
    update_user_id INTEGER REFERENCES public.users(id)
);

CREATE INDEX IF NOT EXISTS idx_user_notes_user_id ON public.user_notes(user_id);

-- +goose Down
DROP TABLE IF EXISTS public.user_notes;
