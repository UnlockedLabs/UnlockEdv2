-- +goose Up
-- +goose StatementBegin
CREATE TABLE public.runnable_tasks (
    id SERIAL NOT NULL,
    job_id text,
    last_run timestamp with time zone,
    provider_platform_id bigint,
    status text,
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
    external_auth_provider_id character varying(128),
    oidc_id bigint,
    schedule text
);

CREATE TABLE public.user_activities (
    id SERIAL NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    deleted_at timestamp with time zone,
    user_id bigint NOT NULL,
    browser_name text DEFAULT 'unknown'::text,
    platform text DEFAULT 'unknown'::text,
    device text DEFAULT 'unknown'::text,
    ip text DEFAULT 'unknown'::text,
    clicked_url text DEFAULT 'unknown'::text
);

CREATE TABLE public.users (
    id SERIAL NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    deleted_at timestamp with time zone,
    username character varying(255) NOT NULL,
    name_first character varying(255) NOT NULL,
    email character varying(255) NOT NULL,
    password character varying(255) NOT NULL,
    password_reset boolean DEFAULT true,
    name_last character varying(255) NOT NULL,
    role character varying(255) DEFAULT 'student'::character varying,
    kratos_id character varying(255),
    facility_id bigint
);

-- +goose StatementEnd



-- +goose Down
-- +goose StatementBegin
DROP TABLE IF EXISTS public.runnable_tasks CASCADE;
DROP SEQUENCE IF EXISTS public.runnable_tasks_id_seq;

DROP TABLE IF EXISTS public.user_activities CASCADE;
DROP SEQUENCE IF EXISTS public.user_activities_id_seq;

DROP TABLE IF EXISTS public.users CASCADE;
DROP SEQUENCE IF EXISTS public.users_id_seq;
-- +goose StatementEnd
