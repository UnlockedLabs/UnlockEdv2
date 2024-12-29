-- +goose Up
-- +goose StatementBegin
ALTER TABLE public.open_content_favorites DROP COLUMN updated_at;
ALTER TABLE public.open_content_favorites DROP COLUMN deleted_at;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE public.open_content_favorites ADD COLUMN updated_at timestamp with time zone;
ALTER TABLE public.open_content_favorites ADD COLUMN deleted_at timestamp with time zone;
-- +goose StatementEnd
