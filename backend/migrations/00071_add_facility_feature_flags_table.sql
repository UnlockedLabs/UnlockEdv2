-- +goose Up
-- +goose StatementBegin
CREATE TABLE public.facility_feature_flags (
    id SERIAL PRIMARY KEY,
    facility_id INTEGER NOT NULL,
    feature feature NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    deleted_at timestamp with time zone,
    create_user_id INTEGER,
    update_user_id INTEGER,
    UNIQUE (facility_id, feature),
    FOREIGN KEY (facility_id) REFERENCES public.facilities(id) ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX idx_facility_feature_flags_facility_id ON public.facility_feature_flags USING btree (facility_id);
CREATE INDEX idx_facility_feature_flags_deleted_at ON public.facility_feature_flags USING btree (deleted_at);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE IF EXISTS public.facility_feature_flags CASCADE;
-- +goose StatementEnd
