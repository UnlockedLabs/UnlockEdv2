-- +goose Up
-- +goose StatementBegin
CREATE TABLE public.programs (
	id SERIAL PRIMARY KEY,
	name VARCHAR(255) NOT NULL,
	description TEXT,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    deleted_at timestamp with time zone
);
CREATE INDEX idx_programs_deleted_at ON public.programs USING btree (deleted_at);


CREATE TABLE public.program_tags (
    id SERIAL PRIMARY KEY,
	program_id integer NOT NULL,
    value VARCHAR(255) NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    deleted_at timestamp with time zone,
	FOREIGN KEY (program_id) REFERENCES programs(id)
);
CREATE INDEX idx_program_tags_program_id ON public.program_tags USING btree (program_id);
CREATE INDEX idx_program_tags_value ON public.program_tags USING btree (value);


CREATE TABLE public.program_sections (
    id SERIAL PRIMARY KEY,
	program_id integer NOT NULL,
	facility_id integer NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    deleted_at timestamp with time zone,
	FOREIGN KEY (program_id) REFERENCES programs(id) ON UPDATE CASCADE,
	FOREIGN KEY (facility_id) REFERENCES facilities(id) ON UPDATE CASCADE
);
CREATE INDEX idx_program_sections_program_id ON public.program_sections USING btree (program_id);
CREATE INDEX idx_program_sections_facility_id ON public.program_sections USING btree (facility_id);
CREATE INDEX idx_program_sections_deleted_at ON public.program_sections USING btree (deleted_at);


CREATE TABLE public.section_enrollments (
    id SERIAL PRIMARY KEY,
	section_id integer NOT NULL,
	user_id integer NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    deleted_at timestamp with time zone,
	FOREIGN KEY (section_id) REFERENCES program_sections(id) ON UPDATE CASCADE,
	FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE CASCADE
);
CREATE INDEX idx_section_enrollments_section_id ON public.section_enrollments USING btree (section_id);
CREATE INDEX idx_section_enrollments_user_id ON public.section_enrollments USING btree (user_id);
CREATE INDEX idx_section_enrollments_deleted_at ON public.section_enrollments USING btree (deleted_at);


CREATE TABLE public.section_events (
    id SERIAL PRIMARY KEY,
	section_id integer NOT NULL,
	start_time timestamp with time zone NOT NULL,
	end_time timestamp with time zone NOT NULL,
	recurrance_rule VARCHAR(255) NOT NULL DEFAULT 'NONE'::character varying,
	location VARCHAR(255) NOT NULL DEFAULT 'TBD'::character varying,
	created_at timestamp with time zone,
	updated_at timestamp with time zone,
	deleted_at timestamp with time zone,
	FOREIGN KEY (section_id) REFERENCES program_sections(id) ON UPDATE CASCADE
);
CREATE INDEX idx_section_events_section_id ON public.section_events USING btree (section_id);
CREATE INDEX idx_section_events_deleted_at ON public.section_events USING btree (deleted_at);
CREATE INDEX idx_section_events_start_time ON public.section_events USING btree (start_time);
CREATE INDEX idx_section_events_end_time ON public.section_events USING btree (end_time);


CREATE TABLE public.section_event_overrides (
    id SERIAL PRIMARY KEY,
	event_id integer NOT NULL,
	start_time timestamp with time zone,
	end_time timestamp with time zone,
	override_rule VARCHAR(128) NOT NULL DEFAULT 'NONE'::character varying,
	is_cancelled boolean NOT NULL DEFAULT false,
	created_at timestamp with time zone,
	updated_at timestamp with time zone,
	deleted_at timestamp with time zone,
	FOREIGN KEY (event_id) REFERENCES section_events(id) ON UPDATE CASCADE
);
CREATE INDEX index_section_event_overrides_event_id ON public.section_event_overrides USING btree (event_id);
CREATE INDEX idx_section_event_overrides_event_id ON public.section_event_overrides USING btree (event_id);
CREATE INDEX idx_section_event_overrides_start_time ON public.section_event_overrides USING btree (start_time);
CREATE INDEX idx_section_event_overrides_end_time ON public.section_event_overrides USING btree (end_time);
CREATE INDEX idx_section_event_overrides_deleted_at ON public.section_event_overrides USING btree (deleted_at);
CREATE INDEX idx_section_event_overrides_is_cancelled ON public.section_event_overrides USING btree (is_cancelled);


CREATE TABLE public.section_event_attendance (
    id SERIAL PRIMARY KEY,
	event_id integer NOT NULL,
	user_id integer NOT NULL,
	created_at timestamp with time zone,
	updated_at timestamp with time zone,
	deleted_at timestamp with time zone,
	FOREIGN KEY (event_id) REFERENCES section_events(id) ON UPDATE CASCADE,
	FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE CASCADE
);
CREATE INDEX idx_attendance_event_id ON public.attendance USING btree (event_id);
CREATE INDEX idx_attendance_user_id ON public.attendance USING btree (user_id);
CREATE INDEX idx_attendance_date ON public.attendance USING btree (date);
CREATE INDEX idx_attendance_deleted_at ON public.attendance USING btree (deleted_at);

-- +goose StatementEnd
-- +goose Down
-- +goose StatementBegin
DROP TABLE public.programs CASCADE;
DROP TABLE public.program_tags CASCADE;
DROP TABLE public.program_sections CASCADE;
DROP TABLE public.section_enrollments CASCADE;
DROP TABLE public.section_events CASCADE;
DROP TABLE public.section_event_overrides CASCADE;
DROP TABLE public.attendance CASCADE;

-- +goose StatementEnd


