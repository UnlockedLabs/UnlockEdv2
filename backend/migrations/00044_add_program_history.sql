-- +goose Up
-- +goose StatementBegin
ALTER TABLE public.programs ADD COLUMN archived_at TIMESTAMP WITH TIME ZONE;
CREATE TABLE public.daily_programs_facilities_history (
    date DATE NOT NULL,
    total_programs INTEGER NOT NULL,
    total_active_programs INTEGER NOT NULL,
    total_archived_programs INTEGER NOT NULL,
    total_enrollments INTEGER NOT NULL,
    total_completions INTEGER NOT NULL,
    total_program_offerings INTEGER NOT NULL,
    total_facilities INTEGER NOT NULL,
    total_students_present INTEGER NOT NULL,
)
CREATE TABLE public.daily_program_facilities_history (
    date DATE NOT NULL,
    program_id INTEGER NOT NULL,
    total_active_facilities INTEGER NOT NULL,
    total_enrollments INTEGER NOT NULL,
    total_completions INTEGER NOT NULL,
    total_active_enrollments INTEGER NOT NULL,
    total_classes INTEGER NOT NULL,
    total_archived_classes INTEGER NOT NULL,
    total_students_present INTEGER NOT NULL,
)
CREATE TABLE public.daily_program_facility_history (
    date DATE NOT NULL,
    program_id INTEGER NOT NULL,
    facility_id INTEGER NOT NULL,
    total_enrollments INTEGER NOT NULL,
    total_completions INTEGER NOT NULL,
    total_active_enrollments INTEGER NOT NULL,
    total_classes INTEGER NOT NULL,
    total_archived_classes INTEGER NOT NULL,
    total_students_present INTEGER NOT NULL
)
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE public.programs DROP COLUMN archived_at;
DROP TABLE public.daily_programs_facilities_history;
DROP TABLE public.daily_program_facilities_history;
DROP TABLE public.daily_program_facility_history;
-- +goose StatementEnd
