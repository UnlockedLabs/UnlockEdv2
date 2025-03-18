-- +goose Up
-- +goose StatementBegin
ALTER TABLE public.programs ADD COLUMN program_owner VARCHAR(255);
ALTER TABLE public.programs ADD COLUMN funding_type VARCHAR(50);
ALTER TABLE public.facilities_programs ADD COLUMN archived_at timestamp with time zone;
ALTER TABLE public.program_sections ADD COLUMN capacity INT;
ALTER TABLE public.program_sections ADD COLUMN name VARCHAR(255);
ALTER TABLE public.program_sections ADD COLUMN instructor_name VARCHAR(255);
ALTER TABLE public.program_sections ADD COLUMN description TEXT;
ALTER TABLE public.program_sections ADD COLUMN archived_at timestamp with time zone;
ALTER TABLE public.program_sections ADD COLUMN start_dt date;
ALTER TABLE public.program_sections ADD COLUMN duration VARCHAR(32);
ALTER TABLE public.program_sections ADD COLUMN total_hours INT;
ALTER TABLE public.program_sections ADD COLUMN is_active boolean;
ALTER TABLE public.program_section_enrollments ADD COLUMN enrollment_status VARCHAR(255);
ALTER TABLE program_section_events RENAME COLUMN location TO room;

CREATE TABLE public.program_completions (
        id SERIAL NOT NULL PRIMARY KEY,
        program_section_id integer NOT NULL,
        program_id integer NOT NULL,
        facility_name CHARACTER VARYING(255) NOT NULL,
        credit_type CHARACTER VARYING(255) NOT NULL, 
        program_owner CHARACTER VARYING(255) NOT NULL,
        program_name CHARACTER VARYING(255), 
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
DROP TRIGGER IF EXISTS sql_trigger_programs_update ON programs;
DROP TRIGGER IF EXISTS sql_trigger_program_sections_update ON program_sections;
DROP FUNCTION IF EXISTS log_programs_sections_updates();
DROP TABLE IF EXISTS public.programs_sections_history CASCADE;
DROP TABLE IF EXISTS public.program_completions CASCADE;
ALTER TABLE public.programs DROP COLUMN program_owner;
ALTER TABLE public.programs DROP COLUMN funding_type;
ALTER TABLE public.facilities_programs DROP COLUMN archived_at;
ALTER TABLE public.program_sections DROP COLUMN capacity;
ALTER TABLE public.program_sections DROP COLUMN name;
ALTER TABLE public.program_sections DROP COLUMN instructor_name;
ALTER TABLE public.program_sections DROP COLUMN description;
ALTER TABLE public.program_sections DROP COLUMN archived_at;
ALTER TABLE public.program_sections DROP COLUMN start_dt;
ALTER TABLE public.program_sections DROP COLUMN duration;
ALTER TABLE public.program_sections DROP COLUMN total_hours;
ALTER TABLE public.program_sections DROP COLUMN is_active;
ALTER TABLE public.program_section_enrollments DROP COLUMN enrollment_status;
ALTER TABLE program_section_events RENAME COLUMN room TO location;
-- +goose StatementEnd
