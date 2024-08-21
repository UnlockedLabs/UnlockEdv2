-- +goose Up
-- +goose StatementBegin
CREATE TABLE public.programs (
    id SERIAL NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    deleted_at timestamp with time zone,
    provider_platform_id bigint NOT NULL,
    name character varying(60),
    description character varying(510),
    external_id character varying(255),
    thumbnail_url character varying(255),
    type character varying(255),
    outcome_types character varying(255),
    external_url character varying(255),
    alt_name character varying(255),
    total_progress_milestones bigint
);

CREATE TABLE public.provider_platforms (
    id SERIAL NOT NULL,
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
    oidc_id bigint
);

CREATE TABLE public.provider_user_mappings (
    id SERIAL NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    deleted_at timestamp with time zone,
    user_id bigint NOT NULL,
    provider_platform_id bigint NOT NULL,
    external_user_id character varying(255) NOT NULL,
    external_username character varying(255) NOT NULL,
    authentication_provider_status character varying(255) DEFAULT 'none'::character varying NOT NULL,
    external_login_id character varying(255)
);

-- +goose StatementEnd


-- +goose Down
-- +goose StatementBegin
DROP TABLE IF EXISTS public.programs CASCADE;
DROP SEQUENCE IF EXISTS public.programs_id_seq;

DROP TABLE IF EXISTS public.provider_platforms CASCADE;
DROP SEQUENCE IF EXISTS public.provider_platforms_id_seq;

DROP TABLE IF EXISTS public.provider_user_mappings CASCADE;
DROP SEQUENCE IF EXISTS public.provider_user_mappings_id_seq;
-- +goose StatementEnd
