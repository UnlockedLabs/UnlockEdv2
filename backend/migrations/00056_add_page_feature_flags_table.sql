-- +goose Up
-- +goose StatementBegin
ALTER TYPE feature ADD VALUE 'request_content';
ALTER TYPE feature ADD VALUE 'helpful_links';
ALTER TYPE feature ADD VALUE 'upload_video';

CREATE TABLE public.page_feature_flags (
    id SERIAL PRIMARY KEY,
    feature_flag_id integer NOT NULL,
    page_feature feature NOT NULL UNIQUE,
    enabled BOOLEAN NOT NULL DEFAULT FALSE,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    deleted_at timestamp with time zone,
    FOREIGN KEY (feature_flag_id) REFERENCES public.feature_flags(id) ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE INDEX idx_page_feature_flags_page_feature ON public.page_feature_flags USING btree (page_feature);
CREATE INDEX idx_page_feature_flags_deleted_at ON public.page_feature_flags USING btree (deleted_at);
CREATE INDEX idx_page_feature_flags_feature_flag_id ON public.page_feature_flags USING btree (feature_flag_id);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE IF EXISTS public.page_feature_flags CASCADE;

ALTER TYPE feature RENAME TO feature_old;

CREATE TYPE feature AS ENUM ('open_content', 'provider_platforms', 'program_management');

ALTER TABLE public.feature_flags ALTER COLUMN name TYPE feature USING name::text::feature;

DROP TYPE feature_old;
-- +goose StatementEnd
