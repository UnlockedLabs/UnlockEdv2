-- +goose Up
-- +goose StatementBegin
CREATE TYPE public.funding_type AS ENUM (
    'Federal_Grants',
    'State_Grants',
    'Nonprofit_Organizations',
    'Educational_Grants',
    'Inmate_Welfare_Funds',
    'Other'
);
ALTER TABLE public.programs DROP COLUMN credit_type;
ALTER TABLE public.programs DROP COLUMN program_type;
ALTER TABLE public.programs ADD COLUMN funding_type funding_type;
DROP TABLE IF EXISTS public.program_tags CASCADE;
ALTER TABLE public.facilities_programs ADD COLUMN program_owner VARCHAR(255);
ALTER TABLE public.program_sections ADD COLUMN capacity INT;
ALTER TABLE public.program_sections ADD COLUMN name VARCHAR(255);
ALTER TABLE public.program_sections ADD COLUMN instructor_name VARCHAR(255);
ALTER TABLE public.program_sections ADD COLUMN description TEXT;
ALTER TABLE public.program_sections ADD COLUMN archived_at timestamp with time zone;
ALTER TABLE public.program_sections ADD COLUMN start_dt date;
ALTER TABLE public.program_sections ADD COLUMN duration VARCHAR(32) NOT NULL DEFAULT '';
ALTER TABLE public.program_sections ADD COLUMN status VARCHAR(50);
ALTER TABLE public.program_sections ADD COLUMN credit_hours INT;
ALTER TABLE public.program_sections ADD COLUMN is_active boolean;
ALTER TABLE public.program_section_enrollments ADD COLUMN enrollment_status VARCHAR(255);
ALTER TABLE public.program_section_events RENAME COLUMN location TO room;

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

CREATE TYPE public.credit_type AS ENUM (
    'Completion',
    'Participation',
    'Earned-time',
    'Education'
);

CREATE TABLE public.program_credit_types (
    program_id integer NOT NULL,
    credit_type credit_type NOT NULL,

    FOREIGN KEY (program_id) REFERENCES public.programs(id) ON UPDATE CASCADE ON DELETE CASCADE,

    PRIMARY KEY (program_id, credit_type) 
);

CREATE TABLE public.program_completions (
    id SERIAL NOT NULL PRIMARY KEY,
    program_section_id integer,
    facility_name CHARACTER VARYING(255) NOT NULL,
    credit_type CHARACTER VARYING(255) NOT NULL, 
    admin_email CHARACTER VARYING(255) NOT NULL,
    program_owner CHARACTER VARYING(255) NOT NULL,
    program_name CHARACTER VARYING(255), 
    program_id integer NOT NULL,
    program_section_name CHARACTER VARYING(255),
    program_section_start_dt CHARACTER VARYING(255),
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    deleted_at timestamp with time zone,
    
    FOREIGN KEY (program_section_id) REFERENCES public.program_sections(id) ON UPDATE CASCADE ON DELETE CASCADE,
    FOREIGN KEY (program_id) REFERENCES public.programs(id) ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE TABLE public.programs_sections_history (
    id SERIAL NOT NULL PRIMARY KEY,
    parent_ref_d INT,
    table_name VARCHAR(255),
    before_update json,
    after_update json
);

CREATE OR REPLACE FUNCTION public.log_programs_sections_updates()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.programs_sections_history (parent_ref_d, table_name, before_update, after_update)
    VALUES (
        OLD.id,  --the parent id
        TG_TABLE_NAME, --the table name of table being updated
        row_to_json(OLD), -- function to convert record into json before change 
        row_to_json(NEW)  -- function to convert record into json after change
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sql_trigger_programs_update
    AFTER UPDATE ON public.programs
FOR EACH ROW
    EXECUTE FUNCTION public.log_programs_sections_updates();

CREATE TRIGGER sql_trigger_program_sections_update
    AFTER UPDATE ON public.program_sections
FOR EACH ROW
    EXECUTE FUNCTION public.log_programs_sections_updates();
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
CREATE TABLE public.program_tags (
        tag_id INTEGER NOT NULL, 
        program_id INTEGER NOT NULL, 
        facility_id INTEGER DEFAULT 0, 
        FOREIGN KEY (tag_id) REFERENCES public.tags(id) ON DELETE CASCADE, 
        FOREIGN KEY (program_id) REFERENCES public.programs(id) ON DELETE CASCADE
);
DROP TABLE IF EXISTS public.program_types CASCADE;
DROP TYPE IF EXISTS public.program_type;
ALTER TABLE public.programs ADD COLUMN program_type CHARACTER VARYING(50);
DROP TRIGGER IF EXISTS sql_trigger_programs_update ON programs;
DROP TRIGGER IF EXISTS sql_trigger_program_sections_update ON program_sections;
DROP FUNCTION IF EXISTS public.log_programs_sections_updates();
DROP TABLE IF EXISTS public.programs_sections_history CASCADE;
DROP TABLE IF EXISTS public.program_completions CASCADE;
DROP TABLE IF EXISTS public.program_credit_types CASCADE;
DROP TYPE IF EXISTS public.credit_type;
ALTER TABLE public.programs ADD COLUMN credit_type CHARACTER VARYING(50);
ALTER TABLE public.programs DROP COLUMN funding_type;
DROP TYPE IF EXISTS public.funding_type;
ALTER TABLE public.facilities_programs DROP COLUMN program_owner;
ALTER TABLE public.program_sections DROP COLUMN capacity;
ALTER TABLE public.program_sections DROP COLUMN name;
ALTER TABLE public.program_sections DROP COLUMN instructor_name;
ALTER TABLE public.program_sections DROP COLUMN description;
ALTER TABLE public.program_sections DROP COLUMN archived_at;
ALTER TABLE public.program_sections DROP COLUMN start_dt;
ALTER TABLE public.program_sections DROP COLUMN duration;
ALTER TABLE public.program_sections DROP COLUMN status;
ALTER TABLE public.program_sections DROP COLUMN credit_hours;
ALTER TABLE public.program_sections DROP COLUMN is_active;
ALTER TABLE public.program_section_enrollments DROP COLUMN enrollment_status;
ALTER TABLE public.program_section_events RENAME COLUMN room TO location;
-- +goose StatementEnd
