-- +goose Up
-- +goose StatementBegin
ALTER TABLE public.users ADD COLUMN deactivated_at TIMESTAMP NULL DEFAULT NULL;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE public.users DROP COLUMN deactivated_at;
-- +goose StatementEnd
