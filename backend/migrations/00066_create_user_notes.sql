-- +goose Up
-- +goose StatementBegin
CREATE TABLE public.user_notes (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    note TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    create_user_id INTEGER NOT NULL REFERENCES public.users(id),
    update_user_id INTEGER REFERENCES public.users(id)
);

CREATE INDEX idx_user_notes_user_id ON public.user_notes(user_id);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE IF EXISTS public.user_notes;
-- +goose StatementEnd
