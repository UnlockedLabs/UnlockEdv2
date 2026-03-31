-- +goose Up
-- +goose StatementBegin
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

ALTER TABLE public.user_notes
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS create_user_id INTEGER,
    ADD COLUMN IF NOT EXISTS update_user_id INTEGER;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_notes' AND column_name = 'admin_id') THEN
        UPDATE public.user_notes SET create_user_id = admin_id WHERE create_user_id IS NULL;
        ALTER TABLE public.user_notes ALTER COLUMN create_user_id SET NOT NULL;
        ALTER TABLE public.user_notes DROP COLUMN admin_id;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_user_notes_create_user') THEN
        ALTER TABLE public.user_notes ADD CONSTRAINT fk_user_notes_create_user FOREIGN KEY (create_user_id) REFERENCES public.users(id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_user_notes_update_user') THEN
        ALTER TABLE public.user_notes ADD CONSTRAINT fk_user_notes_update_user FOREIGN KEY (update_user_id) REFERENCES public.users(id);
    END IF;
END $$;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE IF EXISTS public.user_notes;
-- +goose StatementEnd
