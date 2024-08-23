-- +goose Up
-- +goose StatementBegin
CREATE TABLE public.oidc_clients (
    id SERIAL NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    deleted_at timestamp with time zone,
    provider_platform_id bigint,
    client_id character varying(255),
    client_name character varying(255),
    client_secret character varying(255),
    redirect_uris character varying(255),
    scopes character varying(255)
);

CREATE TABLE public.open_content_providers (
    id SERIAL NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    deleted_at timestamp with time zone,
    url character varying(255) NOT NULL,
    provider_platform_id bigint,
    thumbnail text,
    currently_enabled boolean,
    description text
);


CREATE TABLE public.outcomes (
    id SERIAL NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    deleted_at timestamp with time zone,
    type character varying(255) NOT NULL,
    program_id bigint NOT NULL,
    user_id bigint NOT NULL,
    value character varying(255)
);

-- +goose StatementEnd


-- +goose Down
-- +goose StatementBegin
DROP TABLE IF EXISTS public.oidc_clients CASCADE;
DROP TABLE IF EXISTS public.open_content_providers CASCADE;
DROP TABLE IF EXISTS public.outcomes CASCADE;
-- +goose StatementEnd
