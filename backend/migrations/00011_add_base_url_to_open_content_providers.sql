-- +goose Up
-- +goose StatementBegin
ALTER TABLE public.open_content_providers RENAME COLUMN url TO base_url;
ALTER TABLE public.libraries RENAME COLUMN url TO path;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE public.open_content_providers RENAME COLUMN base_url TO url;
ALTER TABLE public.libraries RENAME COLUMN path TO url;
-- +goose StatementEnd
