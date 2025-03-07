-- +goose Up
-- +goose StatementBegin
ALTER TABLE public.videos DROP COLUMN IF EXISTS visibility_status;
-- +goose StatementEnd
-- +goose Down
-- +goose StatementBegin
ALTER TABLE public.videos ADD COLUMN visibility_status BOOLEAN;
-- +goose StatementEnd
