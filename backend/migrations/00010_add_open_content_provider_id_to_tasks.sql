-- +goose Up
-- +goose StatementBegin
ALTER TABLE public.runnable_tasks 
ALTER COLUMN provider_platform_id DROP NOT NULL,
ADD COLUMN open_content_provider_id integer REFERENCES open_content_providers(id);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE public.runnable_tasks 
ALTER COLUMN provider_platform_id SET NOT NULL,
DROP COLUMN open_content_provider_id;
-- +goose StatementEnd
