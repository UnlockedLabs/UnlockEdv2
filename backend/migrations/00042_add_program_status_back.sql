-- +goose Up
-- +goose StatementBegin
ALTER TABLE public.programs ADD COLUMN is_active bool ;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE public.programs DROP COLUMN is_active;
-- +goose StatementEnd
