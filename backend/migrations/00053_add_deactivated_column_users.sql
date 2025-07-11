-- +goose Up
-- +goose StatementBegin
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMP NULL DEFAULT NULL;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE public.users DROP COLUMN IF EXISTS deactivated_at;
-- +goose StatementEnd
