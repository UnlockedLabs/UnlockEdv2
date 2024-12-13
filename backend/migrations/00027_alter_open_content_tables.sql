-- +goose Up
-- +goose StatementBegin
SELECT 'up SQL query';
ALTER TABLE public.open_content_providers
    RENAME COLUMN name TO title;
ALTER TABLE public.open_content_providers
    RENAME COLUMN base_url TO url;
ALTER TABLE public.open_content_providers
    RENAME COLUMN thumbnail TO thumbnail_url;
ALTER TABLE public.libraries
	RENAME COLUMN name TO title;
ALTER TABLE public.libraries
    RENAME COLUMN path TO url;
ALTER TABLE public.videos
    RENAME COLUMN youtube_id TO external_id;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
SELECT 'down SQL query';
ALTER TABLE public.open_content_providers
    RENAME COLUMN title TO name;
ALTER TABLE public.open_content_providers
    RENAME COLUMN url TO base_url;
ALTER TABLE public.open_content_providers
    RENAME COLUMN thumbnail_url TO thumbnail;
ALTER TABLE public.libraries
    RENAME COLUMN title TO name;
ALTER TABLE public.libraries
    RENAME COLUMN url TO path;
ALTER TABLE public.videos
    RENAME COLUMN external_id TO youtube_id;
-- +goose StatementEnd
