-- +goose Up
-- +goose StatementBegin
ALTER TABLE public.open_content_providers ADD COLUMN name character varying(255);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE public.open_content_providers DROP COLUMN name;
-- +goose StatementEnd
