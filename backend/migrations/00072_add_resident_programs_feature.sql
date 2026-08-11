-- +goose Up
-- +goose NO TRANSACTION
-- A newly added enum value cannot be referenced inside the transaction that adds
-- it, so this migration runs unwrapped and the INSERT below autocommits separately.
ALTER TYPE feature ADD VALUE IF NOT EXISTS 'resident_programs';

-- Resident-facing visibility of the Programs page is ON by default: once program
-- tracking is enabled, residents keep access to their own program information
-- unless an admin explicitly turns it off for their facility.
INSERT INTO public.page_feature_flags (feature_flag_id, page_feature, enabled, created_at)
SELECT id, 'resident_programs', TRUE, now()
FROM public.feature_flags WHERE name = 'program_management'
ON CONFLICT (page_feature) DO NOTHING;

-- +goose Down
-- +goose NO TRANSACTION
DELETE FROM public.facility_feature_flags WHERE feature = 'resident_programs';
DELETE FROM public.page_feature_flags WHERE page_feature = 'resident_programs';

ALTER TYPE feature RENAME TO feature_old;

CREATE TYPE feature AS ENUM ('open_content', 'provider_platforms', 'program_management', 'request_content', 'helpful_links', 'upload_video', 'learning_record');

ALTER TABLE public.feature_flags ALTER COLUMN name TYPE feature USING name::text::feature;
ALTER TABLE public.page_feature_flags ALTER COLUMN page_feature TYPE feature USING page_feature::text::feature;
ALTER TABLE public.facility_feature_flags ALTER COLUMN feature TYPE feature USING feature::text::feature;

DROP TYPE feature_old;
