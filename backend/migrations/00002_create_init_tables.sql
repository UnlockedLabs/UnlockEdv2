-- +goose Up
-- +goose StatementBegin
CREATE TABLE public.cron_jobs (
    id text NOT NULL PRIMARY KEY,
    name text,
    schedule text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    deleted_at timestamp with time zone
);

CREATE TABLE public.facilities (
    id SERIAL NOT NULL PRIMARY KEY,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    deleted_at timestamp with time zone,
    name character varying(255) NOT NULL
);
CREATE INDEX idx_facility_deleted_at ON public.facilities USING btree (deleted_at);


CREATE TABLE public.users (
    id SERIAL NOT NULL PRIMARY KEY,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    deleted_at timestamp with time zone,
    username character varying(255) NOT NULL,
    name_first character varying(255) NOT NULL,
    email character varying(255) NOT NULL,
    name_last character varying(255) NOT NULL,
    role character varying(255) DEFAULT 'student'::character varying,
    kratos_id character varying(255),
    facility_id integer,
    FOREIGN KEY (facility_id) REFERENCES public.facilities(id) ON UPDATE CASCADE ON DELETE CASCADE
);
CREATE INDEX idx_users_deleted_at ON public.users USING btree (deleted_at);
CREATE INDEX idx_users_facility_id ON public.users USING btree (facility_id);
CREATE INDEX idx_users_email ON public.users USING btree (email);
CREATE INDEX idx_users_username ON public.users USING btree (username);
CREATE INDEX idx_users_kratos_id ON public.users USING btree (kratos_id);


CREATE TABLE public.left_menu_links (
    id SERIAL NOT NULL PRIMARY KEY,
    name character varying(255) NOT NULL,
    rank integer DEFAULT 1,
    links jsonb
);

CREATE TABLE public.provider_platforms (
    id SERIAL NOT NULL PRIMARY KEY,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    deleted_at timestamp with time zone,
    type character varying(100),
    name character varying(255),
    description character varying(1024),
    icon_url character varying(255),
    account_id character varying(64),
    access_key character varying(255),
    base_url character varying(255),
    state character varying(100),
    external_auth_provider_id character varying(128)
);
CREATE INDEX idx_provider_platforms_deleted_at ON public.provider_platforms USING btree (deleted_at);
CREATE INDEX idx_provider_platforms_external_auth_provider_id ON public.provider_platforms USING btree (external_auth_provider_id);


CREATE TABLE public.oidc_clients (
    id SERIAL NOT NULL PRIMARY KEY,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    deleted_at timestamp with time zone,
    provider_platform_id integer,
    client_id character varying(255),
    client_name character varying(255),
    client_secret character varying(255),
    redirect_uris character varying(255),
    scopes character varying(255),
    FOREIGN KEY (provider_platform_id) REFERENCES public.provider_platforms(id) ON UPDATE CASCADE ON DELETE CASCADE
);
CREATE INDEX idx_oidc_clients_deleted_at ON public.oidc_clients USING btree (deleted_at);
CREATE INDEX idx_oidc_clients_provider_platform_id ON public.oidc_clients USING btree (provider_platform_id);

CREATE TABLE public.courses (
    id SERIAL NOT NULL PRIMARY KEY,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    deleted_at timestamp with time zone,
    provider_platform_id integer NOT NULL,
    name character varying(60),
    description character varying(510),
    external_id character varying(255) NOT NULL UNIQUE,
    thumbnail_url character varying(255),
    type character varying(255),
    outcome_types character varying(255),
    external_url character varying(255),
    alt_name character varying(255),
    total_progress_milestones integer NOT NULL DEFAULT 1,
    FOREIGN KEY (provider_platform_id) REFERENCES public.provider_platforms(id) ON UPDATE CASCADE ON DELETE CASCADE
);
CREATE INDEX idx_courses_deleted_at ON public.courses USING btree (deleted_at);
CREATE INDEX idx_courses_provider_platform_id ON public.courses USING btree (provider_platform_id);


CREATE TABLE public.milestones (
    id SERIAL NOT NULL PRIMARY KEY,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    deleted_at timestamp with time zone,
    user_id integer NOT NULL,
    course_id integer NOT NULL,
    external_id character varying(255) NOT NULL UNIQUE,
    type character varying(255) NOT NULL,
    is_completed boolean DEFAULT false,
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE,
    FOREIGN KEY (course_id) REFERENCES public.courses(id) ON UPDATE CASCADE ON DELETE CASCADE
);
CREATE INDEX idx_milestones_deleted_at ON public.milestones USING btree (deleted_at);
CREATE INDEX idx_milestones_user_id ON public.milestones USING btree (user_id);
CREATE INDEX idx_milestones_course_id ON public.milestones USING btree (course_id);

CREATE TABLE public.activities (
    id SERIAL NOT NULL PRIMARY KEY,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    deleted_at timestamp with time zone,
    course_id integer NOT NULL,
    user_id integer NOT NULL,
    type character varying(255) NOT NULL,
    total_time integer,
    time_delta integer,
    external_id character varying(255) NOT NULL,
    FOREIGN KEY (course_id) REFERENCES public.courses(id) ON UPDATE CASCADE ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE
);
CREATE INDEX idx_activities_deleted_at ON public.activities USING btree (deleted_at);
CREATE INDEX idx_activities_user_id ON public.activities USING btree (user_id);

CREATE TABLE public.favorites (
    id SERIAL NOT NULL PRIMARY KEY,
    user_id integer,
    course_id integer,
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE,
    FOREIGN KEY (course_id) REFERENCES public.courses(id) ON UPDATE CASCADE ON DELETE CASCADE
);
CREATE INDEX idx_favorites_user ON public.favorites USING btree (user_id);
CREATE INDEX idx_favorites_course ON public.favorites USING btree (course_id);

CREATE TABLE public.provider_user_mappings (
    id SERIAL NOT NULL PRIMARY KEY,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    deleted_at timestamp with time zone,
    user_id integer NOT NULL,
    provider_platform_id integer NOT NULL,
    external_user_id character varying(255) NOT NULL,
    external_username character varying(255) NOT NULL,
    authentication_provider_status character varying(255) DEFAULT 'none'::character varying NOT NULL,
    external_login_id character varying(255),
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE,
    FOREIGN KEY (provider_platform_id) REFERENCES public.provider_platforms(id) ON UPDATE CASCADE ON DELETE CASCADE
);
CREATE INDEX idx_provider_user_mappings_deleted_at ON public.provider_user_mappings USING btree (deleted_at);
CREATE INDEX idx_provider_user_mapping_user ON public.provider_user_mappings USING btree (user_id);
CREATE INDEX idx_provider_user_mapping_provider ON public.provider_user_mappings USING btree (provider_platform_id);

CREATE TABLE public.open_content_providers (
    id SERIAL NOT NULL PRIMARY KEY,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    deleted_at timestamp with time zone,
    url character varying(255) NOT NULL,
    provider_platform_id integer,
    thumbnail text,
    currently_enabled boolean,
    description text,
    FOREIGN KEY (provider_platform_id) REFERENCES public.provider_platforms(id) ON UPDATE CASCADE ON DELETE CASCADE
);
CREATE INDEX idx_open_content_providers_deleted_at ON public.open_content_providers USING btree (deleted_at);
CREATE INDEX idx_open_content_providers_provider ON public.open_content_providers USING btree (provider_platform_id);
CREATE INDEX idx_open_content_providers_url ON public.open_content_providers USING btree (url);


CREATE TABLE public.outcomes (
    id SERIAL NOT NULL PRIMARY KEY,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    deleted_at timestamp with time zone,
    type character varying(255) NOT NULL,
    course_id integer NOT NULL,
    user_id integer NOT NULL,
    value character varying(255),
    FOREIGN KEY (course_id) REFERENCES public.courses(id) ON UPDATE CASCADE ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE
);
CREATE INDEX idx_outcomes_deleted_at ON public.outcomes USING btree (deleted_at);
CREATE INDEX idx_outcomes_course_id ON public.outcomes USING btree (course_id);
CREATE INDEX idx_outcomes_user_id ON public.outcomes USING btree (user_id);

CREATE TABLE public.runnable_tasks (
    id SERIAL NOT NULL PRIMARY KEY,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    deleted_at timestamp with time zone,
    job_id text,
    last_run timestamp with time zone,
    provider_platform_id integer NOT NULL,
    status text,
	FOREIGN KEY (job_id) REFERENCES public.cron_jobs(id) ON UPDATE CASCADE ON DELETE CASCADE,
    FOREIGN KEY (provider_platform_id) REFERENCES public.provider_platforms(id) ON UPDATE CASCADE ON DELETE CASCADE
);
CREATE INDEX idx_tasks_deleted_at ON public.runnable_tasks USING btree (deleted_at);
CREATE INDEX idx_tasks_provider_platform_id ON public.runnable_tasks USING btree (provider_platform_id);
CREATE INDEX idx_tasks_job_id ON public.runnable_tasks USING btree (job_id);

-- +goose StatementEnd
-- +goose Down
-- +goose StatementBegin
DROP TABLE IF EXISTS public.cron_jobs CASCADE;
DROP TABLE IF EXISTS public.facilities CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;
DROP TABLE IF EXISTS public.favorites CASCADE;
DROP TABLE IF EXISTS public.left_menu_links CASCADE;
DROP TABLE IF EXISTS public.milestones CASCADE;
DROP TABLE IF EXISTS public.courses CASCADE;
DROP TABLE IF EXISTS public.provider_platforms CASCADE;
DROP TABLE IF EXISTS public.activities CASCADE;
DROP TABLE IF EXISTS public.provider_user_mappings CASCADE;
DROP TABLE IF EXISTS public.oidc_clients CASCADE;
DROP TABLE IF EXISTS public.open_content_providers CASCADE;
DROP TABLE IF EXISTS public.outcomes CASCADE;
DROP TABLE IF EXISTS public.runnable_tasks CASCADE;

-- +goose StatementEnd


