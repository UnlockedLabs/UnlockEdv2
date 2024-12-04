-- +goose Up
-- +goose StatementBegin
DROP TABLE IF EXISTS public.left_menu_links CASCADE;
CREATE TABLE public.helpful_links (
    id SERIAL NOT NULL PRIMARY KEY,
    created_at timestamp with time zone, 
    updated_at timestamp with time zone,
    deleted_at timestamp with time zone, 
    visibility_status boolean DEFAULT true,
    thumbnail_url CHARACTER VARYING(255) NOT NULL,
    description CHARACTER VARYING(255) NOT NULL,
    title CHARACTER VARYING(255) NOT NULL,
    url CHARACTER VARYING(255) NOT NULL,
    facility_id integer,
    open_content_provider_id integer,

    FOREIGN KEY (facility_id) REFERENCES public.facilities(id) ON UPDATE CASCADE ON DELETE CASCADE,
    FOREIGN KEY (open_content_provider_id) REFERENCES public.open_content_providers(id) ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE INDEX idx_helpful_links_facility_id ON public.helpful_links USING btree (facility_id);
CREATE INDEX idx_helpful_links_title ON public.helpful_links USING btree (title);

INSERT INTO open_content_providers (
name,
base_url,
thumbnail,
currently_enabled,
description,
created_at,
updated_at
)
VALUES (
'HelpfulLinks',
'helpful_links',
'/ul-logo.png',
    true,
'Helpful links for users!',
    NOW(),
    NOW()
);
-- +goose StatementEnd
-- +goose Down
-- +goose StatementBegin
DROP TABLE IF EXISTS public.helpful_links CASCADE;
CREATE TABLE public.left_menu_links (
    id SERIAL NOT NULL PRIMARY KEY,
    name character varying(255) NOT NULL,
    rank integer DEFAULT 1,
    links jsonb
);
-- +goose StatementEnd


