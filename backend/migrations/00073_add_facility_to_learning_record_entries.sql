-- +goose Up
-- +goose StatementBegin
-- IF NOT EXISTS is load-bearing, not defensive habit. This migration was
-- originally numbered 00072 and was applied under that number in at least one
-- environment before it was renumbered to 00073. goose records the version
-- number only -- never the filename or the contents -- so those databases have
-- the columns already but no 00073 row, and a plain ADD COLUMN fails there with
-- "column facility_id of relation learning_record_entries already exists".
ALTER TABLE public.learning_record_entries
    ADD COLUMN IF NOT EXISTS facility_id    INTEGER REFERENCES public.facilities(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS facility_other TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_learning_record_entries_facility_id ON public.learning_record_entries(facility_id);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP INDEX IF EXISTS idx_learning_record_entries_facility_id;

ALTER TABLE public.learning_record_entries
    DROP COLUMN IF EXISTS facility_id,
    DROP COLUMN IF EXISTS facility_other;
-- +goose StatementEnd
