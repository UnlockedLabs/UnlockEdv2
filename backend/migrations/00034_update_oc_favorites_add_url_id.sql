-- +goose Up
-- +goose StatementBegin
ALTER TABLE public.open_content_favorites 
ADD COLUMN open_content_url_id integer,
ADD COLUMN name text;
-- +goose StatementEnd
-- +goose Down
-- +goose StatementBegin
ALTER TABLE public.open_content_favorites
DROP COLUMN open_content_url_id,
DROP COLUMN name;
-- +goose StatementEnd


