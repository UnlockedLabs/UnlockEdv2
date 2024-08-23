-- +goose Up
-- +goose StatementBegin
CREATE TABLE public.activities (
    id SERIAL NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    deleted_at timestamp with time zone,
    program_id bigint NOT NULL,
    user_id bigint NOT NULL,
    type character varying(255) NOT NULL,
    total_time bigint,
    time_delta bigint,
    external_id character varying(255) NOT NULL
);

CREATE TABLE public.cron_jobs (
    id text NOT NULL,
    name text,
    schedule text,
    created_at timestamp with time zone
);

CREATE TABLE public.facilities (
    id SERIAL NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    deleted_at timestamp with time zone,
    name character varying(255) NOT NULL
);

-- +goose StatementEnd



-- +goose Down
-- +goose StatementBegin
DROP TABLE IF EXISTS public.activities CASCADE;
DROP TABLE IF EXISTS public.cron_jobs CASCADE;
DROP TABLE IF EXISTS public.facilities CASCADE;
-- +goose StatementEnd
