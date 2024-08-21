-- +goose Up
-- +goose StatementBegin
CREATE TABLE public.favorites (
    id SERIAL NOT NULL,
    user_id bigint,
    program_id bigint
);

CREATE TABLE public.left_menu_links (
    id SERIAL NOT NULL,
    name character varying(255) NOT NULL,
    rank bigint DEFAULT 1,
    links jsonb
);


CREATE TABLE public.milestones (
    id SERIAL NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    deleted_at timestamp with time zone,
    user_id bigint NOT NULL,
    program_id bigint NOT NULL,
    external_id character varying(255) NOT NULL,
    type character varying(255) NOT NULL,
    is_completed boolean DEFAULT false
);

-- +goose StatementEnd



-- +goose Down
-- +goose StatementBegin
DROP TABLE IF EXISTS public.favorites CASCADE;
DROP SEQUENCE IF EXISTS public.favorites_id_seq;

DROP TABLE IF EXISTS public.left_menu_links CASCADE;
DROP SEQUENCE IF EXISTS public.left_menu_links_id_seq;

DROP TABLE IF EXISTS public.milestones CASCADE;
DROP SEQUENCE IF EXISTS public.milestones_id_seq;
-- +goose StatementEnd
