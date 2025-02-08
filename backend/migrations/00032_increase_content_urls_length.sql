-- +goose Up
-- +goose StatementBegin
ALTER TABLE public.open_content_urls ALTER COLUMN content_url TYPE VARCHAR(512);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE public.open_content_urls ALTER COLUMN content_url TYPE VARCHAR(255);
-- +goose StatementEnd
