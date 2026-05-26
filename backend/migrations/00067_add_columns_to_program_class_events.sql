-- +goose Up
-- +goose StatementBegin
ALTER TABLE public.program_class_events
    ADD COLUMN instructor_id INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
    ADD COLUMN reason CHARACTER VARYING(255) DEFAULT NULL,
    ADD COLUMN is_cancelled BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE public.program_class_events pce
SET instructor_id = pc.instructor_id
FROM public.program_classes pc
WHERE pce.class_id = pc.id
  AND pc.instructor_id IS NOT NULL;

DROP INDEX IF EXISTS idx_program_classes_instructor_id;
ALTER TABLE public.program_classes DROP COLUMN IF EXISTS instructor_id;

CREATE INDEX idx_program_class_events_instructor_id ON public.program_class_events(instructor_id);

COMMENT ON COLUMN public.program_class_events.instructor_id IS 'Foreign key to users table; migrated from program_classes.instructor_id as the authoritative location for per-event instructor assignment';
COMMENT ON COLUMN public.program_class_events.reason IS 'Optional reason recorded when the event was created or modified (e.g. room change, instructor change, reschedule)';
COMMENT ON COLUMN public.program_class_events.is_cancelled IS 'Used for cancelling an entire series of events when requested';
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP INDEX IF EXISTS idx_program_class_events_instructor_id;

-- Restore instructor_id on program_classes
ALTER TABLE public.program_classes
    ADD COLUMN instructor_id INTEGER REFERENCES public.users(id) ON DELETE SET NULL;

-- Backfill program_classes.instructor_id from program_class_events
UPDATE public.program_classes pc
SET instructor_id = pce.instructor_id
FROM public.program_class_events pce
WHERE pce.class_id = pc.id
  AND pce.instructor_id IS NOT NULL;

CREATE INDEX idx_program_classes_instructor_id ON public.program_classes(instructor_id);

ALTER TABLE public.program_class_events
    DROP COLUMN IF EXISTS instructor_id,
    DROP COLUMN IF EXISTS reason,
    DROP COLUMN IF EXISTS is_cancelled;
-- +goose StatementEnd
