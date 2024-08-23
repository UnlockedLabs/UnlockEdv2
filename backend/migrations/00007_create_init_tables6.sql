-- +goose Up
-- +goose StatementBegin
ALTER TABLE ONLY public.activities
    ADD CONSTRAINT activities_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.cron_jobs
    ADD CONSTRAINT cron_jobs_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.facilities
    ADD CONSTRAINT facilities_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.favorites
    ADD CONSTRAINT favorites_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.left_menu_links
    ADD CONSTRAINT left_menu_links_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.milestones
    ADD CONSTRAINT milestones_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.oidc_clients
    ADD CONSTRAINT oidc_clients_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.open_content_providers
    ADD CONSTRAINT open_content_providers_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.outcomes
    ADD CONSTRAINT outcomes_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.programs
    ADD CONSTRAINT programs_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.provider_platforms
    ADD CONSTRAINT provider_platforms_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.provider_user_mappings
    ADD CONSTRAINT provider_user_mappings_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.runnable_tasks
    ADD CONSTRAINT runnable_tasks_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.user_activities
    ADD CONSTRAINT user_activities_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);

CREATE INDEX idx_activities_deleted_at ON public.activities USING btree (deleted_at);
CREATE INDEX idx_facilities_deleted_at ON public.facilities USING btree (deleted_at);
CREATE INDEX idx_milestones_deleted_at ON public.milestones USING btree (deleted_at);
CREATE INDEX idx_oidc_clients_deleted_at ON public.oidc_clients USING btree (deleted_at);
CREATE INDEX idx_open_content_providers_deleted_at ON public.open_content_providers USING btree (deleted_at);
CREATE INDEX idx_outcomes_deleted_at ON public.outcomes USING btree (deleted_at);
CREATE INDEX idx_programs_deleted_at ON public.programs USING btree (deleted_at);
CREATE INDEX idx_provider_platforms_deleted_at ON public.provider_platforms USING btree (deleted_at);
CREATE INDEX idx_provider_user_mappings_deleted_at ON public.provider_user_mappings USING btree (deleted_at);
CREATE INDEX idx_runnable_tasks_deleted_at ON public.runnable_tasks USING btree (deleted_at);
CREATE INDEX idx_user_activities_deleted_at ON public.user_activities USING btree (deleted_at);
CREATE INDEX idx_users_deleted_at ON public.users USING btree (deleted_at);

CREATE TRIGGER milestone_completion_trigger AFTER INSERT ON public.milestones FOR EACH ROW EXECUTE FUNCTION public.check_milestone_completion();

ALTER TABLE ONLY public.activities
    ADD CONSTRAINT fk_activities_program FOREIGN KEY (program_id) REFERENCES public.programs(id);
ALTER TABLE ONLY public.activities
    ADD CONSTRAINT fk_activities_user FOREIGN KEY (user_id) REFERENCES public.users(id);
ALTER TABLE ONLY public.users
    ADD CONSTRAINT fk_facilities_users FOREIGN KEY (facility_id) REFERENCES public.facilities(id) ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE ONLY public.milestones
    ADD CONSTRAINT fk_milestones_user FOREIGN KEY (user_id) REFERENCES public.users(id);
ALTER TABLE ONLY public.open_content_providers
    ADD CONSTRAINT fk_open_content_providers_provider_platform FOREIGN KEY (provider_platform_id) REFERENCES public.provider_platforms(id);
ALTER TABLE ONLY public.outcomes
    ADD CONSTRAINT fk_outcomes_user FOREIGN KEY (user_id) REFERENCES public.users(id);
ALTER TABLE ONLY public.milestones
    ADD CONSTRAINT fk_programs_milestones FOREIGN KEY (program_id) REFERENCES public.programs(id);
ALTER TABLE ONLY public.outcomes
    ADD CONSTRAINT fk_programs_outcomes FOREIGN KEY (program_id) REFERENCES public.programs(id);
ALTER TABLE ONLY public.oidc_clients
    ADD CONSTRAINT fk_provider_platforms_oidc_client FOREIGN KEY (provider_platform_id) REFERENCES public.provider_platforms(id);
ALTER TABLE ONLY public.programs
    ADD CONSTRAINT fk_provider_platforms_programs FOREIGN KEY (provider_platform_id) REFERENCES public.provider_platforms(id);
ALTER TABLE ONLY public.provider_user_mappings
    ADD CONSTRAINT fk_provider_platforms_provider_user_mappings FOREIGN KEY (provider_platform_id) REFERENCES public.provider_platforms(id);
ALTER TABLE ONLY public.user_activities
    ADD CONSTRAINT fk_users_activity_log FOREIGN KEY (user_id) REFERENCES public.users(id);
ALTER TABLE ONLY public.provider_user_mappings
    ADD CONSTRAINT fk_users_mappings FOREIGN KEY (user_id) REFERENCES public.users(id);

ALTER TABLE ONLY public.open_content_providers
    ADD CONSTRAINT uni_open_content_providers_url UNIQUE (url);
ALTER TABLE ONLY public.users
    ADD CONSTRAINT uni_users_email UNIQUE (email);
ALTER TABLE ONLY public.users
    ADD CONSTRAINT uni_users_username UNIQUE (username);
-- +goose StatementEnd


-- +goose Down
-- +goose StatementBegin
DROP INDEX IF EXISTS idx_activities_deleted_at;
DROP INDEX IF EXISTS idx_facilities_deleted_at;
DROP INDEX IF EXISTS idx_milestones_deleted_at;
DROP INDEX IF EXISTS idx_oidc_clients_deleted_at;
DROP INDEX IF EXISTS idx_open_content_providers_deleted_at;
DROP INDEX IF EXISTS idx_outcomes_deleted_at;
DROP INDEX IF EXISTS idx_programs_deleted_at;
DROP INDEX IF EXISTS idx_provider_platforms_deleted_at;
DROP INDEX IF EXISTS idx_provider_user_mappings_deleted_at;
DROP INDEX IF EXISTS idx_runnable_tasks_deleted_at;
DROP INDEX IF EXISTS idx_user_activities_deleted_at;
DROP INDEX IF EXISTS idx_users_deleted_at;

DROP TRIGGER IF EXISTS milestone_completion_trigger ON public.milestones;

ALTER TABLE public.activities DROP CONSTRAINT IF EXISTS fk_activities_program;
ALTER TABLE public.activities DROP CONSTRAINT IF EXISTS fk_activities_user;
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS fk_facilities_users;
ALTER TABLE public.milestones DROP CONSTRAINT IF EXISTS fk_milestones_user;
ALTER TABLE public.open_content_providers DROP CONSTRAINT IF EXISTS fk_open_content_providers_provider_platform;
ALTER TABLE public.outcomes DROP CONSTRAINT IF EXISTS fk_outcomes_user;
ALTER TABLE public.milestones DROP CONSTRAINT IF EXISTS fk_programs_milestones;
ALTER TABLE public.outcomes DROP CONSTRAINT IF EXISTS fk_programs_outcomes;
ALTER TABLE public.oidc_clients DROP CONSTRAINT IF EXISTS fk_provider_platforms_oidc_client;
ALTER TABLE public.programs DROP CONSTRAINT IF EXISTS fk_provider_platforms_programs;
ALTER TABLE public.provider_user_mappings DROP CONSTRAINT IF EXISTS fk_provider_platforms_provider_user_mappings;
ALTER TABLE public.user_activities DROP CONSTRAINT IF EXISTS fk_users_activity_log;
ALTER TABLE public.provider_user_mappings DROP CONSTRAINT IF EXISTS fk_users_mappings;

ALTER TABLE public.open_content_providers DROP CONSTRAINT IF EXISTS uni_open_content_providers_url;
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS uni_users_email;
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS uni_users_username;

DROP TABLE IF EXISTS public.milestones CASCADE;
DROP TABLE IF EXISTS public.activities CASCADE;
DROP TABLE IF EXISTS public.cron_jobs CASCADE;
DROP TABLE IF EXISTS public.facilities CASCADE;
DROP TABLE IF EXISTS public.favorites CASCADE;
DROP TABLE IF EXISTS public.left_menu_links CASCADE;
DROP TABLE IF EXISTS public.oidc_clients CASCADE;
DROP TABLE IF EXISTS public.open_content_providers CASCADE;
DROP TABLE IF EXISTS public.outcomes CASCADE;
DROP TABLE IF EXISTS public.programs CASCADE;
DROP TABLE IF EXISTS public.provider_platforms CASCADE;
DROP TABLE IF EXISTS public.provider_user_mappings CASCADE;
DROP TABLE IF EXISTS public.runnable_tasks CASCADE;
DROP TABLE IF EXISTS public.user_activities CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

-- +goose StatementEnd
