-- +goose Up
-- +goose StatementBegin
CREATE TYPE feature AS ENUM (
    'open_content',
    'provider_platforms',
    'program_management'
);
CREATE TABLE public.feature_flags (
    id SERIAL PRIMARY KEY,
    name feature NOT NULL UNIQUE,
    enabled BOOLEAN NOT NULL DEFAULT FALSE,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    deleted_at timestamp with time zone
);
INSERT INTO public.feature_flags (name, enabled)
VALUES
    ('open_content', TRUE),
    ('provider_platforms', TRUE),
    ('program_management', TRUE);
CREATE INDEX idx_feature_flags_name ON public.feature_flags USING btree (name);
CREATE INDEX idx_feature_flags_deleted_at ON public.feature_flags USING btree (deleted_at);
CREATE TABLE public.user_roles (
	name VARCHAR(64) PRIMARY KEY 
);

INSERT INTO public.user_roles (name)
VALUES
   ('student'),
   ('admin'),
   ('system_admin');

ALTER TABLE public.users
     ADD COLUMN role_name VARCHAR(64) REFERENCES public.user_roles(name);

UPDATE public.users
    SET role_name = role
    WHERE role IN ('system_admin', 'admin', 'student');

UPDATE public.users
    SET role_name = 'student'
    WHERE role_name IS NULL;

ALTER TABLE public.users
ALTER COLUMN role_name SET NOT NULL;

ALTER TABLE public.users DROP COLUMN role;
ALTER TABLE public.users RENAME COLUMN role_name TO role;

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE public.users
ADD COLUMN role character varying(255);

UPDATE public.users
   SET role = role_name;

ALTER TABLE public.users DROP CONSTRAINT fk_role_name;

ALTER TABLE public.users RENAME COLUMN role TO role_name;

ALTER TABLE public.users DROP COLUMN role_name;

DROP TABLE IF EXISTS public.user_roles;

DROP TABLE IF EXISTS public.feature_flags;
DROP TYPE IF EXISTS feature;

DROP INDEX IF EXISTS idx_feature_flags_name;
-- +goose StatementEnd
