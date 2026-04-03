-- +goose Up
ALTER TABLE public.program_class_event_overrides
  ADD COLUMN instructor_id INTEGER REFERENCES public.users(id);

-- +goose Down
ALTER TABLE public.program_class_event_overrides DROP COLUMN IF EXISTS instructor_id;
