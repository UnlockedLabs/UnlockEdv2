-- +goose Up
-- +goose StatementBegin
ALTER TABLE public.programs ADD COLUMN create_user_id integer;
ALTER TABLE public.programs ADD COLUMN update_user_id integer;

update public.programs 
    set create_user_id = (select id from users where role = 'system_admin' limit 1)
where create_user_id is null;

delete from program_classes_history 
    where table_name = 'programs';
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE public.programs DROP COLUMN create_user_id;
ALTER TABLE public.programs DROP COLUMN update_user_id;
-- +goose StatementEnd
