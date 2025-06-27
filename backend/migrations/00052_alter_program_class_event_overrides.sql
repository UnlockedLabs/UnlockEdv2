-- +goose Up
-- +goose StatementBegin
ALTER TABLE public.program_class_event_overrides ADD COLUMN linked_override_event_id INTEGER REFERENCES public.program_class_event_overrides(id);
ALTER TABLE program_class_event_overrides DROP CONSTRAINT unique_event_id_rrule;
CREATE UNIQUE INDEX unique_event_id_rrule_idx ON program_class_event_overrides (event_id, override_rrule) WHERE deleted_at IS NULL;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE public.program_class_event_overrides DROP COLUMN linked_override_event_id;
DROP INDEX IF EXISTS unique_event_id_rrule_idx;
--delete all records that have deleted_at 
delete from public.program_class_event_overrides where deleted_at IS NOT NULL;
ALTER TABLE public.program_class_event_overrides ADD CONSTRAINT unique_event_id_rrule UNIQUE (event_id, override_rrule);
-- +goose StatementEnd
