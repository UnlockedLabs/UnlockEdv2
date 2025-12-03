-- Add instructor_id foreign key to program_classes table
-- This enables instructor dropdown functionality and bulk cancellation by instructor
-- The instructor_name field is kept for backward compatibility during transition

ALTER TABLE public.program_classes ADD COLUMN instructor_id INTEGER REFERENCES public.users(id);

-- Create index for efficient instructor-based queries
CREATE INDEX idx_program_classes_instructor_id ON public.program_classes(instructor_id);

-- Add comment for documentation
COMMENT ON COLUMN public.program_classes.instructor_id IS 'Foreign key to users table for instructor assignment';