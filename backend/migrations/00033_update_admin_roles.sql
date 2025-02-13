-- +goose Up
-- +goose StatementBegin
INSERT INTO public.user_roles (name) VALUES 
('department_admin'),
('facility_admin');

UPDATE public.users 
SET role = 'department_admin'
WHERE role = 'admin';

delete from public.user_roles
where name = 'admin'
;
-- +goose StatementEnd
-- +goose Down
-- +goose StatementBegin
INSERT INTO public.user_roles(name) VALUES ('admin');

UPDATE public.users 
SET role = 'admin'
WHERE role IN ('department_admin', 'facility_admin');;

delete from public.user_roles
where name in ('department_admin', 'facility_admin')
;
-- +goose StatementEnd


