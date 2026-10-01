-- EN-96: restructure feature_flags / facility_feature_flags.
--
-- a. facility_feature_flags was missing create_user_id, and linked to a feature by the raw
--    `feature` enum instead of a real FK id. It now carries feature_flag_id -> feature_flags(id).
-- b. feature_flags.enabled and page_feature_flags.enabled are both dropped -- nothing edits
--    either after their initial seed insert, so the "enabled by default" behavior for every
--    feature (top-level and sub) moves to one hardcoded map in Go (models.DefaultEnabled).
--
-- Wrinkle the ticket doesn't mention: facility_feature_flags.feature also stores per-facility
-- overrides for sub/page features (request_content, upload_video, ...), which live in the
-- separate page_feature_flags table with its own id space. is_page_feature marks shadow copies
-- of those 4 rows inside feature_flags, so every one of the 9 features gets one real id to hang
-- the new FK off of, without touching page_feature_flags itself or losing the ability to
-- override a sub-feature per facility.

-- +goose Up
-- +goose StatementBegin

ALTER TABLE public.feature_flags ADD COLUMN is_page_feature BOOLEAN NOT NULL DEFAULT FALSE;

INSERT INTO public.feature_flags (name, enabled, is_page_feature, created_at, updated_at)
SELECT page_feature, enabled, TRUE, now(), now()
  FROM public.page_feature_flags
ON CONFLICT (name) DO NOTHING;

ALTER TABLE public.facility_feature_flags ADD COLUMN feature_flag_id INTEGER;
ALTER TABLE public.facility_feature_flags ADD COLUMN create_user_id INTEGER;

UPDATE public.facility_feature_flags f
   SET feature_flag_id = ff.id
  FROM public.feature_flags ff
 WHERE ff.name = f.feature;

ALTER TABLE public.facility_feature_flags DROP CONSTRAINT facility_feature_flags_pkey;
ALTER TABLE public.facility_feature_flags DROP COLUMN feature;

ALTER TABLE public.facility_feature_flags ALTER COLUMN feature_flag_id SET NOT NULL;
ALTER TABLE public.facility_feature_flags
    ADD CONSTRAINT facility_feature_flags_pkey PRIMARY KEY (facility_id, feature_flag_id);

ALTER TABLE public.facility_feature_flags
    ADD CONSTRAINT fk_facility_feature_flags_feature_flag_id
        FOREIGN KEY (feature_flag_id) REFERENCES public.feature_flags(id)
        ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE public.facility_feature_flags
    ADD CONSTRAINT fk_facility_feature_flags_create_user_id
        FOREIGN KEY (create_user_id) REFERENCES public.users(id) ON DELETE SET NULL;

CREATE INDEX idx_facility_feature_flags_feature_flag_id ON public.facility_feature_flags(feature_flag_id);
CREATE INDEX idx_facility_feature_flags_create_user_id ON public.facility_feature_flags(create_user_id);

ALTER TABLE public.feature_flags DROP COLUMN enabled;
ALTER TABLE public.page_feature_flags DROP COLUMN enabled;

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin

ALTER TABLE public.feature_flags ADD COLUMN enabled BOOLEAN NOT NULL DEFAULT FALSE;
UPDATE public.feature_flags SET enabled = TRUE
 WHERE name IN ('open_content', 'provider_platforms', 'program_management');
UPDATE public.feature_flags SET enabled = FALSE
 WHERE name IN ('learning_record', 'ai_tutor');

ALTER TABLE public.page_feature_flags ADD COLUMN enabled BOOLEAN NOT NULL DEFAULT TRUE;

DROP INDEX IF EXISTS public.idx_facility_feature_flags_create_user_id;
DROP INDEX IF EXISTS public.idx_facility_feature_flags_feature_flag_id;

ALTER TABLE public.facility_feature_flags DROP CONSTRAINT IF EXISTS fk_facility_feature_flags_create_user_id;
ALTER TABLE public.facility_feature_flags DROP CONSTRAINT IF EXISTS fk_facility_feature_flags_feature_flag_id;
ALTER TABLE public.facility_feature_flags DROP CONSTRAINT IF EXISTS facility_feature_flags_pkey;

ALTER TABLE public.facility_feature_flags ADD COLUMN feature feature;

UPDATE public.facility_feature_flags f
   SET feature = ff.name
  FROM public.feature_flags ff
 WHERE ff.id = f.feature_flag_id;

ALTER TABLE public.facility_feature_flags ALTER COLUMN feature SET NOT NULL;
ALTER TABLE public.facility_feature_flags
    ADD CONSTRAINT facility_feature_flags_pkey PRIMARY KEY (facility_id, feature);
CREATE INDEX idx_facility_feature_flags_feature ON public.facility_feature_flags USING btree (feature);

ALTER TABLE public.facility_feature_flags DROP COLUMN feature_flag_id;
ALTER TABLE public.facility_feature_flags DROP COLUMN create_user_id;

DELETE FROM public.feature_flags WHERE is_page_feature = TRUE;
ALTER TABLE public.feature_flags DROP COLUMN is_page_feature;

-- +goose StatementEnd
