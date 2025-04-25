-- +goose Up
-- +goose StatementBegin
ALTER TABLE public.program_classes ADD COLUMN create_user_id integer;
ALTER TABLE public.program_classes ADD COLUMN update_user_id integer;

update public.program_classes 
    set create_user_id = (select id from users where role = 'system_admin' limit 1)
where create_user_id is null;

delete from program_classes_history 
    where table_name = 'program_classes';

ALTER TABLE public.program_classes_history RENAME COLUMN parent_ref_d TO parent_ref_id;

DROP TRIGGER IF EXISTS sql_trigger_programs_update ON public.programs;
DROP TRIGGER IF EXISTS sql_trigger_program_classes_update ON public.program_classes;
DROP FUNCTION IF EXISTS public.log_program_classes_updates();
CREATE OR REPLACE FUNCTION public.log_program_classes_updates()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.program_classes_history (parent_ref_id, table_name, before_update, after_update)
    VALUES (
        OLD.id,
        TG_TABLE_NAME,
        row_to_json(OLD),
        row_to_json(NEW)
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sql_trigger_programs_update
    AFTER UPDATE ON public.programs
FOR EACH ROW
    EXECUTE FUNCTION public.log_program_classes_updates();

CREATE TRIGGER sql_trigger_program_classes_update
    AFTER UPDATE ON public.program_classes
FOR EACH ROW
    EXECUTE FUNCTION public.log_program_classes_updates();
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE public.program_classes DROP COLUMN create_user_id;
ALTER TABLE public.program_classes DROP COLUMN update_user_id;

ALTER TABLE public.program_classes_history RENAME COLUMN parent_ref_id TO parent_ref_d;

DROP TRIGGER IF EXISTS sql_trigger_programs_update ON public.programs;
DROP TRIGGER IF EXISTS sql_trigger_program_classes_update ON public.program_classes;
DROP FUNCTION IF EXISTS public.log_program_classes_updates();
CREATE OR REPLACE FUNCTION public.log_program_classes_updates()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.program_classes_history (parent_ref_d, table_name, before_update, after_update)
    VALUES (
        OLD.id,
        TG_TABLE_NAME,
        row_to_json(OLD),
        row_to_json(NEW)
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sql_trigger_programs_update
    AFTER UPDATE ON public.programs
FOR EACH ROW
    EXECUTE FUNCTION public.log_program_classes_updates();

CREATE TRIGGER sql_trigger_program_classes_update
    AFTER UPDATE ON public.program_classes
FOR EACH ROW
    EXECUTE FUNCTION public.log_program_classes_updates();
-- +goose StatementEnd
