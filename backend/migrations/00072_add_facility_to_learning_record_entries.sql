-- +goose Up
-- +goose StatementBegin
ALTER TABLE public.learning_record_entries
    ADD COLUMN facility_id    INTEGER REFERENCES public.facilities(id) ON DELETE SET NULL,
    ADD COLUMN facility_other TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_learning_record_entries_facility_id ON public.learning_record_entries(facility_id);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP INDEX IF EXISTS idx_learning_record_entries_facility_id;

ALTER TABLE public.learning_record_entries
    DROP COLUMN facility_id,
    DROP COLUMN facility_other;
-- +goose StatementEnd
