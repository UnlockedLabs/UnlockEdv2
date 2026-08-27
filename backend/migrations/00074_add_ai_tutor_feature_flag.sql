-- +goose Up
-- +goose NO TRANSACTION
ALTER TYPE feature ADD VALUE IF NOT EXISTS 'ai_tutor';

INSERT INTO public.feature_flags (name, enabled)
VALUES ('ai_tutor', FALSE)
ON CONFLICT (name) DO NOTHING;

-- +goose Down
-- +goose NO TRANSACTION
DELETE FROM public.facility_feature_flags WHERE feature = 'ai_tutor';
DELETE FROM public.feature_flags WHERE name = 'ai_tutor';

ALTER TYPE feature RENAME TO feature_old;

CREATE TYPE feature AS ENUM ('open_content', 'provider_platforms', 'program_management', 'request_content', 'helpful_links', 'upload_video', 'learning_record', 'resident_programs');

ALTER TABLE public.feature_flags ALTER COLUMN name TYPE feature USING name::text::feature;
ALTER TABLE public.page_feature_flags ALTER COLUMN page_feature TYPE feature USING page_feature::text::feature;
ALTER TABLE public.facility_feature_flags ALTER COLUMN feature TYPE feature USING feature::text::feature;

DROP TYPE feature_old;
