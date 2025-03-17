-- +goose Up
-- +goose StatementBegin
ALTER TABLE public.programs ADD COLUMN program_owner VARCHAR(255);
ALTER TABLE public.programs ADD COLUMN funding_type VARCHAR(50);
ALTER TABLE public.facilities_programs ADD COLUMN archived_at timestamp with time zone;
ALTER TABLE public.program_sections ADD COLUMN capacity INT;
ALTER TABLE public.program_sections ADD COLUMN name VARCHAR(255);
ALTER TABLE public.program_sections ADD COLUMN instructor_name VARCHAR(255);
ALTER TABLE public.program_sections ADD COLUMN description TEXT;
ALTER TABLE public.program_sections ADD COLUMN room VARCHAR(255);
ALTER TABLE public.program_sections ADD COLUMN archived_at timestamp with time zone;
ALTER TABLE public.program_sections ADD COLUMN start_dt date;
ALTER TABLE public.program_sections ADD COLUMN end_dt date;
ALTER TABLE public.program_section_enrollments ADD COLUMN enrollment_status VARCHAR(255);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE public.programs DROP COLUMN program_owner;
ALTER TABLE public.programs DROP COLUMN funding_type;
ALTER TABLE public.facilities_programs DROP COLUMN archived_at;
ALTER TABLE public.program_sections DROP COLUMN capacity;
ALTER TABLE public.program_sections DROP COLUMN name;
ALTER TABLE public.program_sections DROP COLUMN instructor_name;
ALTER TABLE public.program_sections DROP COLUMN description;
ALTER TABLE public.program_sections DROP COLUMN room;
ALTER TABLE public.program_sections DROP COLUMN archived_at;
ALTER TABLE public.program_sections DROP COLUMN start_dt;
ALTER TABLE public.program_sections DROP COLUMN end_dt;
ALTER TABLE public.program_section_enrollments DROP COLUMN enrollment_status;
-- +goose StatementEnd
