-- +goose Up
-- +goose StatementBegin
SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;
COMMENT ON EXTENSION pg_trgm IS 'text similarity measurement and index searching based on trigrams';

-- Enums
CREATE TYPE public.credit_type AS ENUM (
    'Completion',
    'Participation',
    'Earned-time',
    'Education'
);
CREATE TYPE public.feature AS ENUM (
    'open_content',
    'provider_platforms',
    'program_management'
);
CREATE TYPE public.funding_type AS ENUM (
    'Federal_Grants',
    'State_Grants',
    'Nonprofit_Organizations',
    'Educational_Grants',
    'Inmate_Welfare_Funds',
    'Other'
);
CREATE TYPE public.program_type AS ENUM (
    'Educational',
    'Vocational',
    'Mental_Health_Behavioral',
    'Religious_Faith-Based',
    'Re-Entry',
    'Therapeutic',
    'Life_Skills'
);
CREATE TYPE public.section_status AS ENUM (
    'Scheduled',
    'Active',
    'Cancelled',
    'Completed',
    'Paused',
    'Pending'
);

CREATE TYPE public.video_availability AS ENUM (
    'available',
    'processing',
    'has_error'
);

-- functions
CREATE FUNCTION public.check_milestone_completion() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    total_milestones INT;
    user_milestones INT;
BEGIN
    SELECT total_progress_milestones
    INTO total_milestones
    FROM courses 
    WHERE id = NEW.course_id;

    SELECT COUNT(*)
    INTO user_milestones
    FROM milestones
    WHERE course_id = NEW.course_id AND user_id = NEW.user_id;

    IF user_milestones = total_milestones THEN
        INSERT INTO outcomes (type, course_id, user_id, value)
        VALUES ('progress_completion', NEW.course_id, NEW.user_id, '100');
    END IF;

    RETURN NEW;
END;
$$;

CREATE PROCEDURE public.insert_daily_activity_brightspace(IN _user_id integer, IN _course_id integer, IN _type character varying, IN _total_time integer, IN _external_id character varying, IN _created_at timestamp without time zone)
    LANGUAGE plpgsql
    AS $$
DECLARE 
    prev_total_time INTEGER := 0;
    prev_delta_time INTEGER := 0;
BEGIN
    SELECT total_time INTO prev_total_time
    FROM activities
    WHERE user_id = _user_id AND course_id = _course_id
    ORDER BY created_at DESC
    LIMIT 1;

    IF prev_total_time IS NULL THEN
        prev_total_time := 0;
    END IF;

    SELECT time_delta INTO prev_delta_time
    FROM activities
    WHERE user_id = _user_id AND course_id = _course_id
          AND SUBSTRING(external_id FROM '^[^-]+') = SUBSTRING(_external_id FROM '^[^-]+')
    ORDER BY created_at DESC
    LIMIT 1;

    IF prev_delta_time IS NULL THEN
        prev_delta_time := 0;
    END IF;

    INSERT INTO activities (user_id, course_id, type, total_time, time_delta, external_id, created_at, updated_at)
    VALUES (
        _user_id, _course_id, _type, (_total_time - prev_delta_time) + prev_total_time, 
        _total_time - prev_delta_time, _external_id, NOW(), NOW()
    );

    INSERT INTO user_course_activity_totals (user_id, course_id, total_time, last_ts)
    VALUES (_user_id, _course_id, _total_time, NOW())
    ON CONFLICT (user_id, course_id)
    DO UPDATE SET total_time = _total_time, last_ts = NOW();
END;
$$;

CREATE PROCEDURE public.insert_daily_activity_canvas(IN _user_id integer, IN _course_id integer, IN _type character varying, IN _total_time integer, IN _external_id character varying, IN _created_at timestamp without time zone)
    LANGUAGE plpgsql
    AS $$
DECLARE 
    prev_total_time INTEGER := 0;
BEGIN
    SELECT total_time INTO prev_total_time
    FROM activities
    WHERE user_id = _user_id AND course_id = _course_id
    ORDER BY created_at DESC
    LIMIT 1;

    IF prev_total_time IS NULL THEN
        prev_total_time := 0;
    END IF;

    INSERT INTO activities (user_id, course_id, type, total_time, time_delta, external_id, created_at, updated_at)
    VALUES (
        _user_id, _course_id, _type, _total_time, _total_time - prev_total_time, _external_id, _created_at, NOW()
    );

    INSERT INTO user_course_activity_totals (user_id, course_id, total_time, last_ts)
    VALUES (_user_id, _course_id, _total_time, NOW())
    ON CONFLICT (user_id, course_id)
    DO UPDATE SET total_time = _total_time, last_ts = NOW();
END;
$$;

CREATE PROCEDURE public.insert_daily_activity_kolibri(IN _user_id integer, IN _course_id integer, IN _type character varying, IN _total_time integer, IN _external_id character varying, IN _created_at timestamp without time zone)
    LANGUAGE plpgsql
    AS $$
DECLARE 
    prev_total_time INTEGER := 0;
BEGIN
    SELECT total_time INTO prev_total_time
    FROM activities
    WHERE user_id = _user_id AND course_id = _course_id
    ORDER BY created_at DESC
    LIMIT 1;

    IF prev_total_time IS NULL THEN
        prev_total_time := 0;
    END IF;

    INSERT INTO activities (user_id, course_id, type, total_time, time_delta, external_id, created_at, updated_at)
    VALUES (
        _user_id, _course_id, _type, _total_time + prev_total_time, _total_time, _external_id, _created_at, NOW()
    );

    -- Upsert into user_course_activity_totals
    INSERT INTO user_course_activity_totals (user_id, course_id, total_time, last_ts)
    VALUES (_user_id, _course_id, _total_time + prev_total_time, _created_at)
    ON CONFLICT (user_id, course_id)
    DO UPDATE SET total_time = total_time + _total_time, last_ts = _created_at;

END;
$$;

CREATE FUNCTION public.log_program_classes_updates() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    INSERT INTO public.program_classes_history (parent_ref_id, table_name, before_update, after_update)
    VALUES (
        OLD.id,
        TG_TABLE_NAME,
        row_to_json(OLD),
        row_to_json(NEW)
    );
    RETURN NEW;
END;
$$;


SET default_tablespace = '';
SET default_table_access_method = heap;

CREATE TABLE public.activities (
    id SERIAL NOT NULL PRIMARY KEY,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    deleted_at timestamp with time zone,
    course_id integer NOT NULL,
    user_id integer NOT NULL,
    type character varying(255) NOT NULL,
    total_time bigint,
    time_delta bigint,
    external_id character varying(255) NOT NULL
);

CREATE TABLE public.courses (
    id SERIAL NOT NULL PRIMARY KEY,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    deleted_at timestamp with time zone,
    provider_platform_id integer NOT NULL,
    name character varying(255),
    description character varying(510),
    external_id character varying(255) NOT NULL,
    thumbnail_url character varying(255),
    type character varying(255),
    outcome_types character varying(255),
    external_url character varying(255),
    alt_name character varying(255),
    total_progress_milestones integer DEFAULT 1 NOT NULL,
    start_dt date,
    end_dt date
);

CREATE TABLE public.cron_jobs (
    id text NOT NULL,
    name text,
    schedule text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    deleted_at timestamp with time zone,
    category integer DEFAULT 0
);

CREATE TABLE public.daily_program_facilities_history (
    date date DEFAULT CURRENT_DATE NOT NULL,
    program_id integer NOT NULL,
    total_active_facilities integer NOT NULL,
    total_enrollments integer NOT NULL,
    total_completions integer NOT NULL,
    total_active_enrollments integer NOT NULL,
    total_classes integer NOT NULL,
    total_archived_classes integer NOT NULL,
    total_attendances_marked integer NOT NULL,
    total_students_present integer NOT NULL
);


CREATE TABLE public.daily_program_facility_history (
    date date DEFAULT CURRENT_DATE NOT NULL,
    program_id integer NOT NULL,
    facility_id integer NOT NULL,
    total_enrollments integer NOT NULL,
    total_completions integer NOT NULL,
    total_active_enrollments integer NOT NULL,
    total_classes integer NOT NULL,
    total_archived_classes integer NOT NULL,
    total_attendances_marked integer NOT NULL,
    total_students_present integer NOT NULL
);

CREATE TABLE public.daily_programs_facilities_history (
    date date DEFAULT CURRENT_DATE NOT NULL,
    total_programs integer NOT NULL,
    total_active_programs integer NOT NULL,
    total_archived_programs integer NOT NULL,
    total_enrollments integer NOT NULL,
    total_completions integer NOT NULL,
    total_program_offerings integer NOT NULL,
    total_facilities integer NOT NULL,
    total_attendances_marked integer NOT NULL,
    total_students_present integer NOT NULL
);


CREATE TABLE public.facilities (
    id SERIAL NOT NULL PRIMARY KEY,
    timezone character varying(56) DEFAULT 'America/New_York'::character varying NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    deleted_at timestamp with time zone,
    name character varying(255) NOT NULL
);

CREATE TABLE public.facilities_programs (
    id SERIAL NOT NULL PRIMARY KEY,
    facility_id integer NOT NULL,
    program_id integer NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    deleted_at timestamp with time zone,
    program_owner character varying(255)
);

CREATE TABLE public.facility_visibility_statuses (
    facility_id integer NOT NULL,
    open_content_provider_id integer NOT NULL,
    content_id integer NOT NULL,
    visibility_status boolean DEFAULT false NOT NULL
);

CREATE TABLE public.faq_click_metrics (
    user_id integer NOT NULL,
    faq_id integer NOT NULL,
    total bigint DEFAULT 1 NOT NULL
);

CREATE TABLE public.faqs (
    id SERIAL NOT NULL PRIMARY KEY,
    question character varying(255) NOT NULL
);

CREATE TABLE public.feature_flags (
    id SERIAL NOT NULL PRIMARY KEY,
    name public.feature NOT NULL,
    enabled boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    deleted_at timestamp with time zone
);

CREATE TABLE public.goose_db_version (
    id SERIAL NOT NULL PRIMARY KEY,
    version_id bigint NOT NULL,
    is_applied boolean NOT NULL,
    tstamp timestamp without time zone DEFAULT now() NOT NULL
);


CREATE TABLE public.helpful_links (
    id SERIAL NOT NULL PRIMARY KEY,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    deleted_at timestamp with time zone,
    visibility_status boolean DEFAULT true,
    thumbnail_url character varying(255),
    description character varying(255) NOT NULL,
    title character varying(255) NOT NULL,
    url character varying(255) NOT NULL,
    facility_id integer,
    open_content_provider_id integer
);

CREATE TABLE public.libraries (
    id SERIAL NOT NULL PRIMARY KEY,
    open_content_provider_id integer NOT NULL,
    external_id character varying,
    title character varying(255) NOT NULL,
    language character varying(512),
    description text,
    url character varying NOT NULL,
    thumbnail_url character varying,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    deleted_at timestamp with time zone
);


CREATE TABLE public.login_activity (
    time_interval timestamp without time zone NOT NULL,
    facility_id integer NOT NULL,
    total_logins bigint DEFAULT 1,
	PRIMARY KEY (time_interval, facility_id),
);


CREATE TABLE public.login_metrics (
    user_id integer NOT NULL,
    total bigint DEFAULT 1 NOT NULL,
    last_login timestamp with time zone DEFAULT now()
);

CREATE TABLE public.milestones (
    id SERIAL NOT NULL PRIMARY KEY,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    deleted_at timestamp with time zone,
    user_id integer NOT NULL,
    course_id integer NOT NULL,
    external_id character varying(255) NOT NULL,
    type character varying(255) NOT NULL,
    is_completed boolean DEFAULT false
);

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
    scopes character varying(255)
);

CREATE TABLE public.open_content_activities (
    id SERIAL NOT NULL PRIMARY KEY,
    request_ts timestamp(0) without time zone DEFAULT CURRENT_TIMESTAMP,
    open_content_provider_id integer NOT NULL,
    facility_id integer NOT NULL,
    user_id integer NOT NULL,
    content_id integer NOT NULL,
    open_content_url_id integer NOT NULL,
    stop_ts timestamp(0) without time zone,
    duration interval GENERATED ALWAYS AS ((stop_ts - request_ts)) STORED
);

CREATE TABLE public.tags (
    id integer NOT NULL,
    name character varying(255) NOT NULL
);

CREATE TABLE public.open_content_favorites (
    id SERIAL NOT NULL PRIMARY KEY,
    content_id integer NOT NULL,
    open_content_provider_id integer NOT NULL,
    user_id integer NOT NULL,
    facility_id integer,
    created_at timestamp with time zone,
    open_content_url_id integer,
    name text
);

CREATE TABLE public.open_content_providers (
    id SERIAL NOT NULL PRIMARY KEY,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    deleted_at timestamp with time zone,
    url character varying(255) NOT NULL,
    thumbnail_url text,
    currently_enabled boolean,
    description text,
    title character varying(255)
);

CREATE TABLE public.open_content_tags (
    tag_id integer NOT NULL,
    content_id integer NOT NULL,
    open_content_provider_id integer NOT NULL
);

CREATE TABLE public.open_content_urls (
    id integer NOT NULL,
    content_url character varying(512) NOT NULL
);

CREATE TABLE public.outcomes (
    id SERIAL NOT NULL PRIMARY KEY,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    deleted_at timestamp with time zone,
    type character varying(255) NOT NULL,
    course_id integer NOT NULL,
    user_id integer NOT NULL,
    value character varying(255)
);

CREATE TABLE public.program_class_enrollments (
    id SERIAL NOT NULL PRIMARY KEY,
    class_id integer NOT NULL,
    user_id integer NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    deleted_at timestamp with time zone,
    enrollment_status character varying(255)
);


CREATE TABLE public.program_class_event_attendance (
    id SERIAL NOT NULL PRIMARY KEY,
    event_id integer NOT NULL,
    user_id integer NOT NULL,
    date character varying(64) NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    deleted_at timestamp with time zone,
    attendance_status character varying(27),
    note character varying(150)
);


CREATE TABLE public.program_class_event_overrides (
    id SERIAL NOT NULL PRIMARY KEY,
    event_id integer NOT NULL,
    duration character varying(64),
    override_rrule character varying(128) NOT NULL,
    is_cancelled boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    deleted_at timestamp with time zone,
    location character varying(255)
);


CREATE TABLE public.program_class_events (
    id SERIAL NOT NULL PRIMARY KEY,
    class_id integer NOT NULL,
    duration character varying(32) DEFAULT '1h0m0s'::character varying NOT NULL,
    recurrence_rule character varying(255) DEFAULT 'NONE'::character varying NOT NULL,
    room character varying(255) DEFAULT 'TBD'::character varying NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    deleted_at timestamp with time zone
);


CREATE TABLE public.program_classes (
    id SERIAL NOT NULL PRIMARY KEY,
    program_id integer NOT NULL,
    facility_id integer NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    deleted_at timestamp with time zone,
    capacity integer,
    name character varying(255),
    instructor_name character varying(255),
    description text,
    archived_at timestamp with time zone,
    start_dt date,
    credit_hours integer,
    status public.section_status,
    end_dt date,
    create_user_id integer,
    update_user_id integer
);


CREATE TABLE public.program_classes_history (
    id SERIAL NOT NULL PRIMARY KEY,
    parent_ref_id integer,
    table_name character varying(255),
    before_update json,
    after_update json,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE public.program_completions (
    id SERIAL NOT NULL PRIMARY KEY,
    program_class_id integer,
    facility_name character varying(255) NOT NULL,
    credit_type character varying(255) NOT NULL,
    admin_email character varying(255) NOT NULL,
    program_owner character varying(255) NOT NULL,
    program_name character varying(255) NOT NULL,
    program_id integer NOT NULL,
    program_class_name character varying(255),
    program_class_start_dt timestamp with time zone,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    deleted_at timestamp with time zone,
    user_id integer NOT NULL
);


CREATE TABLE public.program_credit_types (
    program_id integer NOT NULL,
    credit_type public.credit_type NOT NULL
);

CREATE TABLE public.video_download_attempts (
    id SERIAL NOT NULL PRIMARY KEY,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    deleted_at timestamp with time zone,
    video_id integer NOT NULL,
    error_message character varying(255)
);

CREATE TABLE public.videos (
    id SERIAL NOT NULL PRIMARY KEY,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    deleted_at timestamp with time zone,
    external_id character varying(56) NOT NULL,
    url character varying(255) NOT NULL,
    title character varying(255) NOT NULL,
    availability public.video_availability DEFAULT 'processing'::public.video_availability NOT NULL,
    duration integer,
    description text,
    thumbnail_url character varying(255),
    channel_title character varying(255),
    open_content_provider_id integer
);

ALTER TABLE ONLY public.courses
    ADD CONSTRAINT courses_external_id_key UNIQUE (external_id);

ALTER TABLE ONLY public.feature_flags
    ADD CONSTRAINT feature_flags_name_key UNIQUE (name);

ALTER TABLE ONLY public.login_activity
    ADD CONSTRAINT login_activity_pkey PRIMARY KEY (time_interval, facility_id);

ALTER TABLE ONLY public.milestones
    ADD CONSTRAINT milestones_external_id_key UNIQUE (external_id);

ALTER TABLE ONLY public.open_content_tags
    ADD CONSTRAINT open_content_types_pkey PRIMARY KEY (tag_id, content_id, open_content_provider_id);

ALTER TABLE ONLY public.program_credit_types
    ADD CONSTRAINT program_credit_types_pkey PRIMARY KEY (program_id, credit_type);

ALTER TABLE ONLY public.program_types
    ADD CONSTRAINT program_types_pkey PRIMARY KEY (program_id, program_type);

ALTER TABLE ONLY public.milestones
    ADD CONSTRAINT unique_extern_id_course_id UNIQUE (external_id, course_id, user_id);

ALTER TABLE ONLY public.open_content_favorites
    ADD CONSTRAINT unique_open_content_favorite UNIQUE (content_id, open_content_provider_id, user_id, facility_id);
ALTER TABLE ONLY public.program_class_event_attendance
    ADD CONSTRAINT unique_program_section_event_attendance UNIQUE (user_id, event_id, date);

ALTER TABLE ONLY public.open_content_activities
    ADD CONSTRAINT unique_user_facility_library_url_timestamp UNIQUE (user_id, facility_id, open_content_provider_id, content_id, open_content_url_id, request_ts);

ALTER TABLE ONLY public.user_course_activity_totals
    ADD CONSTRAINT user_course_activity_totals_pkey PRIMARY KEY (user_id, course_id);

ALTER TABLE ONLY public.user_enrollments
    ADD CONSTRAINT user_enrollments_pkey PRIMARY KEY (user_id, course_id);

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (name);

ALTER TABLE ONLY public.videos
    ADD CONSTRAINT videos_url_key UNIQUE (url);

ALTER TABLE ONLY public.videos
    ADD CONSTRAINT videos_youtube_id_key UNIQUE (external_id);

CREATE INDEX idx_activities_deleted_at ON public.activities USING btree (deleted_at);

CREATE INDEX idx_activities_user_id ON public.activities USING btree (user_id);

CREATE INDEX idx_attendance_date ON public.program_class_event_attendance USING btree (date);

CREATE INDEX idx_attendance_deleted_at ON public.program_class_event_attendance USING btree (deleted_at);

CREATE INDEX idx_attendance_event_id ON public.program_class_event_attendance USING btree (event_id);

CREATE INDEX idx_attendance_user_id ON public.program_class_event_attendance USING btree (user_id);

CREATE INDEX idx_courses_deleted_at ON public.courses USING btree (deleted_at);

CREATE INDEX idx_courses_provider_platform_id ON public.courses USING btree (provider_platform_id);

CREATE INDEX idx_daily_program_facilities_history_date_program_id ON public.daily_program_facilities_history USING btree (date DESC, program_id);

CREATE INDEX idx_daily_program_facility_history_history_date_program_id_faci ON public.daily_program_facility_history USING btree (date DESC, program_id, facility_id);

CREATE INDEX idx_daily_programs_facilities_history_date ON public.daily_programs_facilities_history USING btree (date DESC);

CREATE UNIQUE INDEX idx_event_user_date ON public.program_class_event_attendance USING btree (event_id, user_id, date);

CREATE INDEX idx_facility_deleted_at ON public.facilities USING btree (deleted_at);

CREATE UNIQUE INDEX idx_facility_library_user_favorites ON public.open_content_favorites USING btree (content_id, facility_id, open_content_provider_id) WHERE (facility_id IS NOT NULL);

CREATE INDEX idx_facility_program_facility_id ON public.facilities_programs USING btree (facility_id);

CREATE INDEX idx_facility_program_program_id ON public.facilities_programs USING btree (program_id);

CREATE INDEX idx_feature_flags_deleted_at ON public.feature_flags USING btree (deleted_at);

CREATE INDEX idx_feature_flags_name ON public.feature_flags USING btree (name);

CREATE INDEX idx_helpful_links_facility_id ON public.helpful_links USING btree (facility_id);

CREATE INDEX idx_helpful_links_title ON public.helpful_links USING btree (title);

CREATE INDEX idx_libraries_deleted_at ON public.libraries USING btree (id);

CREATE INDEX idx_libraries_external_id ON public.libraries USING btree (external_id);

CREATE INDEX idx_libraries_open_content_provider_id ON public.libraries USING btree (open_content_provider_id);

CREATE INDEX idx_libraries_url ON public.libraries USING btree (url);

CREATE INDEX idx_milestones_course_id ON public.milestones USING btree (course_id);

CREATE INDEX idx_milestones_deleted_at ON public.milestones USING btree (deleted_at);

CREATE INDEX idx_milestones_user_id ON public.milestones USING btree (user_id);

CREATE INDEX idx_oidc_clients_deleted_at ON public.oidc_clients USING btree (deleted_at);

CREATE INDEX idx_oidc_clients_provider_platform_id ON public.oidc_clients USING btree (provider_platform_id);

CREATE INDEX idx_open_content_activities_content_id_open_content_provider_id ON public.open_content_activities USING btree (content_id, open_content_provider_id, facility_id);

CREATE INDEX idx_open_content_activities_open_content_url_id ON public.open_content_activities USING btree (open_content_url_id);

CREATE INDEX idx_open_content_activities_user_id ON public.open_content_activities USING btree (user_id);

CREATE INDEX idx_open_content_activities_user_id_content_id_facility_id ON public.open_content_activities USING btree (user_id, content_id, facility_id);

CREATE INDEX idx_open_content_categories_name ON public.tags USING btree (name);

CREATE INDEX idx_open_content_provider_id_videos ON public.videos USING btree (open_content_provider_id);

CREATE INDEX idx_open_content_providers_deleted_at ON public.open_content_providers USING btree (deleted_at);

CREATE INDEX idx_open_content_providers_url ON public.open_content_providers USING btree (url);

CREATE INDEX idx_outcomes_course_id ON public.outcomes USING btree (course_id);

CREATE INDEX idx_outcomes_deleted_at ON public.outcomes USING btree (deleted_at);

CREATE INDEX idx_outcomes_user_id ON public.outcomes USING btree (user_id);

CREATE INDEX idx_program_section_enrollments_deleted_at ON public.program_class_enrollments USING btree (deleted_at);

CREATE INDEX idx_program_section_enrollments_section_id ON public.program_class_enrollments USING btree (class_id);

CREATE INDEX idx_program_section_enrollments_user_id ON public.program_class_enrollments USING btree (user_id);

CREATE INDEX idx_program_section_event_overrides_deleted_at ON public.program_class_event_overrides USING btree (deleted_at);

CREATE INDEX idx_program_section_event_overrides_duration ON public.program_class_event_overrides USING btree (duration);

CREATE INDEX idx_program_section_event_overrides_event_id ON public.program_class_event_overrides USING btree (event_id);

CREATE INDEX idx_program_section_event_overrides_is_cancelled ON public.program_class_event_overrides USING btree (is_cancelled);
CREATE INDEX idx_program_sections_facility_id ON public.program_classes USING btree (facility_id);

CREATE INDEX idx_program_sections_program_id ON public.program_classes USING btree (program_id);

CREATE INDEX idx_programs_deleted_at ON public.programs USING btree (deleted_at);

CREATE INDEX idx_programs_is_active ON public.programs USING btree (is_active);

CREATE INDEX idx_programs_overview_30d_archived_at ON public.programs_overview_30d USING btree (archived_at);

CREATE INDEX idx_programs_overview_30d_description ON public.programs_overview_30d USING btree (lower(description));

CREATE INDEX idx_programs_overview_30d_name_lower ON public.programs_overview_30d USING btree (lower((program_name)::text));

CREATE UNIQUE INDEX idx_programs_overview_30d_unique ON public.programs_overview_30d USING btree (program_id);

CREATE INDEX idx_programs_overview_90d_archived_at ON public.programs_overview_90d USING btree (archived_at);

CREATE INDEX idx_programs_overview_90d_description ON public.programs_overview_90d USING btree (lower(description));

CREATE INDEX idx_programs_overview_90d_name_lower ON public.programs_overview_90d USING btree (lower((program_name)::text));

CREATE UNIQUE INDEX idx_programs_overview_90d_unique ON public.programs_overview_90d USING btree (program_id);

CREATE INDEX idx_programs_overview_all_time_archived_at ON public.programs_overview_all_time USING btree (archived_at);

CREATE INDEX idx_programs_overview_all_time_description ON public.programs_overview_all_time USING btree (lower(description));

CREATE INDEX idx_programs_overview_all_time_name_lower ON public.programs_overview_all_time USING btree (lower((program_name)::text));

CREATE UNIQUE INDEX idx_programs_overview_all_time_unique ON public.programs_overview_all_time USING btree (program_id);

CREATE INDEX idx_provider_platforms_deleted_at ON public.provider_platforms USING btree (deleted_at);

CREATE INDEX idx_provider_platforms_external_auth_provider_id ON public.provider_platforms USING btree (external_auth_provider_id);

CREATE INDEX idx_provider_user_mapping_provider ON public.provider_user_mappings USING btree (provider_platform_id);

CREATE INDEX idx_provider_user_mapping_user ON public.provider_user_mappings USING btree (user_id);

CREATE INDEX idx_provider_user_mappings_deleted_at ON public.provider_user_mappings USING btree (deleted_at);

CREATE INDEX idx_section_events_deleted_at ON public.program_class_events USING btree (deleted_at);

CREATE INDEX idx_section_events_duration ON public.program_class_events USING btree (duration);

CREATE INDEX idx_section_events_section_id ON public.program_class_events USING btree (class_id);

CREATE INDEX idx_tasks_deleted_at ON public.runnable_tasks USING btree (deleted_at);

CREATE INDEX idx_tasks_job_id ON public.runnable_tasks USING btree (job_id);

CREATE INDEX idx_tasks_provider_platform_id ON public.runnable_tasks USING btree (provider_platform_id);

CREATE INDEX idx_title_videos ON public.videos USING btree (title);

CREATE INDEX idx_user_account_history_admin_id ON public.user_account_history USING btree (admin_id);

CREATE INDEX idx_user_account_history_program_classes_history_id ON public.user_account_history USING btree (program_classes_history_id);

CREATE INDEX idx_user_account_history_user_id ON public.user_account_history USING btree (user_id);

CREATE UNIQUE INDEX idx_user_enrollments_external_id ON public.user_enrollments USING btree (external_id, course_id) WHERE (external_id IS NOT NULL);

CREATE INDEX idx_user_session_tracking_user_id ON public.user_session_tracking USING btree (user_id);

CREATE INDEX idx_user_session_tracking_user_session_start ON public.user_session_tracking USING btree (user_id, session_id, session_start_ts DESC);

CREATE INDEX idx_users_deleted_at ON public.users USING btree (deleted_at);

CREATE INDEX idx_users_doc_id ON public.users USING btree (doc_id);

CREATE INDEX idx_users_email ON public.users USING btree (email);

CREATE INDEX idx_users_facility_id ON public.users USING btree (facility_id);

CREATE INDEX idx_users_kratos_id ON public.users USING btree (kratos_id);

CREATE INDEX idx_users_username ON public.users USING btree (username);

CREATE INDEX idx_video_attempts_deleted_at ON public.video_download_attempts USING btree (deleted_at);

CREATE INDEX idx_video_attempts_video_id ON public.video_download_attempts USING btree (video_id);

CREATE INDEX idx_video_url ON public.videos USING btree (url);

CREATE INDEX idx_videos_deleted_at ON public.videos USING btree (deleted_at);

CREATE INDEX idx_youtube_id_videos ON public.videos USING btree (external_id);

CREATE INDEX index_program_section_event_overrides_event_id ON public.program_class_event_overrides USING btree (event_id);

CREATE INDEX login_activity_facility_id_idx ON public.login_activity USING btree (facility_id);

CREATE INDEX login_activity_time_interval_idx ON public.login_activity USING btree (time_interval);

CREATE INDEX program_favorites_program_id_index ON public.program_favorites USING btree (program_id);

CREATE INDEX program_favorites_user_id_index ON public.program_favorites USING btree (user_id);

CREATE INDEX user_login_metrics_last_login_idx ON public.login_metrics USING btree (last_login);

CREATE INDEX user_login_metrics_login_count_idx ON public.login_metrics USING btree (total);

CREATE INDEX user_login_metrics_user_id_idx ON public.login_metrics USING btree (user_id);

CREATE TRIGGER sql_trigger_program_classes_update AFTER UPDATE ON public.program_classes FOR EACH ROW EXECUTE FUNCTION public.log_program_classes_updates();

CREATE TRIGGER sql_trigger_programs_update AFTER UPDATE ON public.programs FOR EACH ROW EXECUTE FUNCTION public.log_program_classes_updates();

ALTER TABLE ONLY public.activities
    ADD CONSTRAINT activities_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.activities
    ADD CONSTRAINT activities_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.courses
    ADD CONSTRAINT courses_provider_platform_id_fkey FOREIGN KEY (provider_platform_id) REFERENCES public.provider_platforms(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.facilities_programs
    ADD CONSTRAINT facilities_programs_facility_id_fkey FOREIGN KEY (facility_id) REFERENCES public.facilities(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.facilities_programs
    ADD CONSTRAINT facilities_programs_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.programs(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.facility_visibility_statuses
    ADD CONSTRAINT facility_visibility_statuses_facility_id_fkey FOREIGN KEY (facility_id) REFERENCES public.facilities(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.facility_visibility_statuses
    ADD CONSTRAINT facility_visibility_statuses_open_content_provider_id_fkey FOREIGN KEY (open_content_provider_id) REFERENCES public.open_content_providers(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.faq_click_metrics
    ADD CONSTRAINT faq_click_metrics_faq_id_fkey FOREIGN KEY (faq_id) REFERENCES public.faqs(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.faq_click_metrics
    ADD CONSTRAINT faq_click_metrics_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.helpful_links
    ADD CONSTRAINT helpful_links_facility_id_fkey FOREIGN KEY (facility_id) REFERENCES public.facilities(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.helpful_links
    ADD CONSTRAINT helpful_links_open_content_provider_id_fkey FOREIGN KEY (open_content_provider_id) REFERENCES public.open_content_providers(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.libraries
    ADD CONSTRAINT libraries_open_content_provider_id_fkey FOREIGN KEY (open_content_provider_id) REFERENCES public.open_content_providers(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.login_activity
    ADD CONSTRAINT login_activity_facility_id_fkey FOREIGN KEY (facility_id) REFERENCES public.facilities(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.login_metrics
    ADD CONSTRAINT login_metrics_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.milestones
    ADD CONSTRAINT milestones_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.milestones
    ADD CONSTRAINT milestones_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.oidc_clients
    ADD CONSTRAINT oidc_clients_provider_platform_id_fkey FOREIGN KEY (provider_platform_id) REFERENCES public.provider_platforms(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.open_content_activities
    ADD CONSTRAINT open_content_activities_facility_id_fkey FOREIGN KEY (facility_id) REFERENCES public.facilities(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.open_content_activities
    ADD CONSTRAINT open_content_activities_open_content_provider_id_fkey FOREIGN KEY (open_content_provider_id) REFERENCES public.open_content_providers(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.open_content_activities
    ADD CONSTRAINT open_content_activities_open_content_url_id_fkey FOREIGN KEY (open_content_url_id) REFERENCES public.open_content_urls(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.open_content_activities
    ADD CONSTRAINT open_content_activities_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.open_content_favorites
    ADD CONSTRAINT open_content_favorites_facility_id_fkey FOREIGN KEY (facility_id) REFERENCES public.facilities(id);

ALTER TABLE ONLY public.open_content_favorites
    ADD CONSTRAINT open_content_favorites_open_content_provider_id_fkey FOREIGN KEY (open_content_provider_id) REFERENCES public.open_content_providers(id);

ALTER TABLE ONLY public.open_content_favorites
    ADD CONSTRAINT open_content_favorites_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);

ALTER TABLE ONLY public.open_content_tags
    ADD CONSTRAINT open_content_tags_open_content_provider_id_fkey FOREIGN KEY (open_content_provider_id) REFERENCES public.open_content_providers(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.open_content_tags
    ADD CONSTRAINT open_content_tags_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES public.tags(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.outcomes
    ADD CONSTRAINT outcomes_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.outcomes
    ADD CONSTRAINT outcomes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.program_completions
    ADD CONSTRAINT program_completions_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.programs(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.program_completions
    ADD CONSTRAINT program_completions_program_section_id_fkey FOREIGN KEY (program_class_id) REFERENCES public.program_classes(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.program_completions
    ADD CONSTRAINT program_completions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.program_credit_types
    ADD CONSTRAINT program_credit_types_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.programs(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.program_favorites
    ADD CONSTRAINT program_favorites_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.programs(id);

ALTER TABLE ONLY public.program_favorites
    ADD CONSTRAINT program_favorites_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);

ALTER TABLE ONLY public.program_class_enrollments
    ADD CONSTRAINT program_section_enrollments_section_id_fkey FOREIGN KEY (class_id) REFERENCES public.program_classes(id) ON UPDATE CASCADE;

ALTER TABLE ONLY public.program_class_enrollments
    ADD CONSTRAINT program_section_enrollments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE;

ALTER TABLE ONLY public.program_class_event_attendance
    ADD CONSTRAINT program_section_event_attendance_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.program_class_events(id) ON UPDATE CASCADE;

ALTER TABLE ONLY public.program_class_event_attendance
    ADD CONSTRAINT program_section_event_attendance_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE;

ALTER TABLE ONLY public.program_class_event_overrides
    ADD CONSTRAINT program_section_event_overrides_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.program_class_events(id) ON UPDATE CASCADE;

ALTER TABLE ONLY public.program_class_events
    ADD CONSTRAINT program_section_events_section_id_fkey FOREIGN KEY (class_id) REFERENCES public.program_classes(id) ON UPDATE CASCADE;

ALTER TABLE ONLY public.program_classes
    ADD CONSTRAINT program_sections_facility_id_fkey FOREIGN KEY (facility_id) REFERENCES public.facilities(id) ON UPDATE CASCADE;

ALTER TABLE ONLY public.program_classes
    ADD CONSTRAINT program_sections_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.programs(id) ON UPDATE CASCADE;

ALTER TABLE ONLY public.program_types
    ADD CONSTRAINT program_types_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.programs(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.provider_user_mappings
    ADD CONSTRAINT provider_user_mappings_provider_platform_id_fkey FOREIGN KEY (provider_platform_id) REFERENCES public.provider_platforms(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.provider_user_mappings
    ADD CONSTRAINT provider_user_mappings_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.runnable_tasks
    ADD CONSTRAINT runnable_tasks_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.cron_jobs(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.runnable_tasks
    ADD CONSTRAINT runnable_tasks_open_content_provider_id_fkey FOREIGN KEY (open_content_provider_id) REFERENCES public.open_content_providers(id);

ALTER TABLE ONLY public.runnable_tasks
    ADD CONSTRAINT runnable_tasks_provider_platform_id_fkey FOREIGN KEY (provider_platform_id) REFERENCES public.provider_platforms(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.user_account_history
    ADD CONSTRAINT user_account_history_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.user_account_history
    ADD CONSTRAINT user_account_history_facility_id_fkey FOREIGN KEY (facility_id) REFERENCES public.facilities(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.user_account_history
    ADD CONSTRAINT user_account_history_program_classes_history_id_fkey FOREIGN KEY (program_classes_history_id) REFERENCES public.program_classes_history(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.user_account_history
    ADD CONSTRAINT user_account_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.user_course_activity_totals
    ADD CONSTRAINT user_course_activity_totals_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id);

ALTER TABLE ONLY public.user_course_activity_totals
    ADD CONSTRAINT user_course_activity_totals_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);

ALTER TABLE ONLY public.user_enrollments
    ADD CONSTRAINT user_enrollments_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id);

ALTER TABLE ONLY public.user_enrollments
    ADD CONSTRAINT user_enrollments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);

ALTER TABLE ONLY public.user_session_tracking
    ADD CONSTRAINT user_session_tracking_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_facility_id_fkey FOREIGN KEY (facility_id) REFERENCES public.facilities(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_role_name_fkey FOREIGN KEY (role) REFERENCES public.user_roles(name);

ALTER TABLE ONLY public.video_download_attempts
    ADD CONSTRAINT video_download_attempts_video_id_fkey FOREIGN KEY (video_id) REFERENCES public.videos(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.videos
    ADD CONSTRAINT videos_open_content_provider_id_fkey FOREIGN KEY (open_content_provider_id) REFERENCES public.open_content_providers(id) ON DELETE SET NULL;

INSERT INTO public.user_roles (name) values ('system_admin'), ('department_admin'), ('facility_admin'), ('student');
INSERT INTO public.feature_flags (name, enabled)
VALUES
    ('open_content', TRUE),
    ('provider_platforms', TRUE),
    ('program_management', TRUE);
INSERT INTO public.facilities (name, timezone, created_at, updated_at) VALUES ('Default', 'America/Chicago', now(), now());

INSERT INTO public.users (username, name_first, name_last, email, role, facility_id) VALUES ('SuperAdmin', 'super', 'admin', 'admin@unlocked.v2', 'system_admin', 1);

-- +goose StatementEnd
-- +goose Down
-- +goose StatementBegin

DROP TRIGGER IF EXISTS sql_trigger_program_classes_update ON public.program_classes;
DROP TRIGGER IF EXISTS sql_trigger_programs_update ON public.programs;

DROP FUNCTION IF EXISTS public.check_milestone_completion() CASCADE;
DROP FUNCTION IF EXISTS public.log_program_classes_updates() CASCADE;
DROP PROCEDURE IF EXISTS public.insert_daily_activity_brightspace(INTEGER, INTEGER, CHARACTER VARYING, INTEGER, CHARACTER VARYING, TIMESTAMP);
DROP PROCEDURE IF EXISTS public.insert_daily_activity_canvas(INTEGER, INTEGER, CHARACTER VARYING, INTEGER, CHARACTER VARYING, TIMESTAMP);
DROP PROCEDURE IF EXISTS public.insert_daily_activity_kolibri(INTEGER, INTEGER, CHARACTER VARYING, INTEGER, CHARACTER VARYING, TIMESTAMP);

DROP TABLE IF EXISTS
  public.activities,
  public.courses,
  public.cron_jobs,
  public.daily_program_facilities_history,
  public.daily_program_facility_history,
  public.daily_programs_facilities_history,
  public.facilities,
  public.facilities_programs,
  public.facility_visibility_statuses,
  public.faq_click_metrics,
  public.faqs,
  public.feature_flags,
  public.helpful_links,
  public.libraries,
  public.login_activity,
  public.login_metrics,
  public.milestones,
  public.oidc_clients,
  public.open_content_activities,
  public.open_content_favorites,
  public.open_content_providers,
  public.open_content_tags,
  public.open_content_urls,
  public.outcomes,
  public.program_class_enrollments,
  public.program_class_event_attendance,
  public.program_class_event_overrides,
  public.program_class_events,
  public.program_classes,
  public.program_classes_history,
  public.program_completions,
  public.program_credit_types,
  public.tags,
  public.video_download_attempts,
  public.videos
CASCADE;

DROP TYPE IF EXISTS
  public.credit_type,
  public.feature,
  public.funding_type,
  public.program_type,
  public.section_status,
  public.video_availability;
-- +goose StatementEnd
