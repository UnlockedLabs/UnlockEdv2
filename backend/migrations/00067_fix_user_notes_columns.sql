-- +goose Up
-- +goose StatementBegin
ALTER TABLE public.user_notes
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS create_user_id INTEGER,
    ADD COLUMN IF NOT EXISTS update_user_id INTEGER;

UPDATE public.user_notes SET create_user_id = admin_id WHERE create_user_id IS NULL;

ALTER TABLE public.user_notes
    ALTER COLUMN create_user_id SET NOT NULL,
    ADD CONSTRAINT fk_user_notes_create_user FOREIGN KEY (create_user_id) REFERENCES public.users(id),
    ADD CONSTRAINT fk_user_notes_update_user FOREIGN KEY (update_user_id) REFERENCES public.users(id);

ALTER TABLE public.user_notes
    DROP COLUMN IF EXISTS admin_id;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE public.user_notes
    ADD COLUMN IF NOT EXISTS admin_id INTEGER;

UPDATE public.user_notes SET admin_id = create_user_id;

ALTER TABLE public.user_notes
    DROP CONSTRAINT IF EXISTS fk_user_notes_create_user,
    DROP CONSTRAINT IF EXISTS fk_user_notes_update_user,
    DROP COLUMN IF EXISTS create_user_id,
    DROP COLUMN IF EXISTS update_user_id,
    DROP COLUMN IF EXISTS updated_at,
    DROP COLUMN IF EXISTS deleted_at;
-- +goose StatementEnd
