-- +goose Up
-- +goose StatementBegin
CREATE TYPE public.section_status AS ENUM (
    'Scheduled',
    'Active',
    'Cancelled',
    'Completed',
    'Paused',
    'Pending'
);
ALTER TABLE public.program_sections DROP COLUMN status;
ALTER TABLE public.program_sections ADD COLUMN status section_status;
ALTER TABLE public.programs DROP COLUMN program_status;
DROP TABLE IF EXISTS public.program_types CASCADE;
DROP TYPE IF EXISTS public.program_type;

CREATE TYPE public.program_type AS ENUM (
    'Educational',
    'Vocational',
    'Mental_Health_Behavioral',
    'Religious_Faith-Based',
    'Re-Entry',
    'Therapeutic',
    'Life_Skills'
);

CREATE TABLE public.program_types (
        program_type program_type NOT NULL,
        program_id INTEGER NOT NULL, 

        FOREIGN KEY (program_id) REFERENCES public.programs(id) ON DELETE CASCADE,
        PRIMARY KEY (program_id, program_type) 
);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE public.program_sections DROP COLUMN status;
ALTER TABLE public.program_sections ADD COLUMN status VARCHAR(50);
DROP TYPE IF EXISTS public.section_status;
ALTER TABLE public.programs ADD COLUMN program_status VARCHAR(50);
DROP TABLE IF EXISTS public.program_types CASCADE;
DROP TYPE IF EXISTS public.program_type;

CREATE TYPE public.program_type AS ENUM (
    'Educational',
    'Mental_Health_Behavioral',
    'Religious_Faith-Based',
    'Re-Entry',
    'Life_Skills'
);

CREATE TABLE public.program_types (
        program_type program_type NOT NULL,
        program_id INTEGER NOT NULL, 

        FOREIGN KEY (program_id) REFERENCES public.programs(id) ON DELETE CASCADE,
        PRIMARY KEY (program_id, program_type) 
);
-- +goose StatementEnd
