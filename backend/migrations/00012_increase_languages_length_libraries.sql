-- +goose Up
-- +goose StatementBegin
ALTER TABLE public.libraries ALTER COLUMN language TYPE VARCHAR(512);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE public.libraries ALTER COLUMN language TYPE VARCHAR(255);
-- +goose StatementEnd
