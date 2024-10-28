-- +goose Up
-- +goose StatementBegin
CREATE TYPE video_availability AS ENUM (
'available',
'processing',
'has_error'
);
CREATE TABLE public.videos (
    id SERIAL NOT NULL PRIMARY KEY,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    deleted_at timestamp with time zone,
    youtube_id character varying(56) NOT NULL,
	url character varying(255), 
    title character varying(255) NOT NULL,
	availability video_availability NOT NULL DEFAULT 'processing',
	description text,
	thumbnail_url character varying(255),
	channel_title character varying(255),
	visibility_status boolean NOT NULL DEFAULT false,
	open_content_provider_id integer,
	FOREIGN KEY (open_content_provider_id) REFERENCES open_content_providers(id) ON DELETE SET NULL
);

CREATE TABLE public.video_download_attempts (
	id SERIAL NOT NULL PRIMARY KEY,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    deleted_at timestamp with time zone,
	video_id integer NOT NULL,
	error_message character varying(255),
	FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE
);

CREATE INDEX idx_youtube_id_videos ON public.videos USING btree (youtube_id);
CREATE INDEX idx_title_videos ON public.videos USING btree (title);
CREATE INDEX idx_open_content_provider_id_videos ON public.videos USING btree (open_content_provider_id);
CREATE INDEX idx_videos_deleted_at ON public.videos USING btree (deleted_at);
CREATE INDEX idx_video_attempts_deleted_at ON public.video_download_attempts USING btree (deleted_at);
CREATE INDEX idx_video_attempts_video_id ON public.video_download_attempts USING btree (video_id);
ALTER TABLE public.open_content_providers ADD COLUMN api_key character varying(255);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE public.videos CASCADE;
DROP TYPE video_availability;
DROP TABLE public.video_download_attempts CASCADE;
ALTER TABLE public.open_content_providers DROP COLUMN api_key;
-- +goose StatementEnd
