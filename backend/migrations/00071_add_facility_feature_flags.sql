-- +goose Up
-- +goose StatementBegin
CREATE TABLE public.facility_feature_flags (
    facility_id INTEGER NOT NULL,
    feature feature NOT NULL,
    enabled BOOLEAN NOT NULL,
    update_user_id INTEGER,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    PRIMARY KEY (facility_id, feature),
    FOREIGN KEY (facility_id) REFERENCES public.facilities(id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX idx_facility_feature_flags_feature ON public.facility_feature_flags USING btree (feature);

-- Per-facility control now supersedes the statewide staged-rollout gate that
-- kept this off by default; flip the floor to enabled so it behaves like the
-- other three top-level features (on by default, opt out per facility).
UPDATE public.feature_flags SET enabled = TRUE WHERE name = 'learning_record';
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE IF EXISTS public.facility_feature_flags CASCADE;

UPDATE public.feature_flags SET enabled = FALSE WHERE name = 'learning_record';
-- +goose StatementEnd
