-- +goose Up
-- +goose StatementBegin
alter table public.programs 
add COLUMN credit_type character varying(255), 
add COLUMN program_status character varying(50), 
add COLUMN program_type character varying(50);

create table public.facilities_programs(
    id SERIAL not null primary key,
    facility_id integer not null,
    program_id integer not null,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    deleted_at timestamp with time zone,
    foreign key (facility_id) references public.facilities(id) on update cascade on delete cascade,
    foreign key (program_id) references public.programs(id) on update cascade on delete cascade
);
create index idx_facility_program_facility_id on public.facilities_programs using btree (facility_id);

create index idx_facility_program_program_id on public.facilities_programs using btree (program_id);
-- +goose StatementEnd
-- +goose Down
-- +goose StatementBegin
alter table public.programs 
drop COLUMN credit_type, 
drop COLUMN program_status,
drop COLUMN program_type;
drop table if exists public.facilities_programs CASCADE;
-- +goose StatementEnd
