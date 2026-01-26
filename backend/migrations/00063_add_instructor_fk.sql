-- +goose Up
-- +goose StatementBegin
ALTER TABLE public.program_classes ADD COLUMN instructor_id INTEGER REFERENCES public.users(id);

CREATE INDEX idx_program_classes_instructor_id ON public.program_classes(instructor_id);

COMMENT ON COLUMN public.program_classes.instructor_id IS 'Foreign key to users table for instructor assignment';

-- Note: We intentionally DO NOT backfill instructor_id based on instructor_name matching
-- This is because:
-- 1. Name matching is error-prone and can lead to incorrect assignments
-- 2. Existing classes will have NULL instructor_id until manually assigned
-- 3. The instructor_name field will be removed after transition period
-- 4. Frontend will get instructor names from the users table relationship
-- 5. Classes will be manually assigned to appropriate instructors going forward
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP INDEX IF EXISTS idx_program_classes_instructor_id;
ALTER TABLE public.program_classes DROP COLUMN IF EXISTS instructor_id;
-- +goose StatementEnd