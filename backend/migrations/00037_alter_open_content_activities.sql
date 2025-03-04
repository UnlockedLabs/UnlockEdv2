-- +goose Up
-- +goose StatementBegin
ALTER TABLE public.open_content_activities DROP CONSTRAINT unique_user_facility_library_url_timestamp;
ALTER TABLE public.open_content_activities ADD CONSTRAINT unique_user_facility_library_url_timestamp UNIQUE (user_id, facility_id, open_content_provider_id, content_id, open_content_url_id, request_ts);
ALTER TABLE public.open_content_activities 
ADD COLUMN stop_ts TIMESTAMP(0) WITHOUT TIME ZONE NULL,
ADD COLUMN duration INTERVAL GENERATED ALWAYS AS (stop_ts - request_ts) STORED;

CREATE TABLE public.user_session_tracking (
    id SERIAL NOT NULL,
    user_id integer NOT NULL,
    session_id character varying(255),
    session_start_ts timestamp with time zone,
    session_end_ts timestamp with time zone NULL,
    session_duration INTERVAL GENERATED ALWAYS AS (session_end_ts - session_start_ts) STORED,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_user_session_tracking_user_id ON public.user_session_tracking USING btree (user_id);
CREATE INDEX idx_user_session_tracking_user_session_start ON public.user_session_tracking USING btree (user_id, session_id, session_start_ts DESC);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE public.open_content_activities DROP CONSTRAINT unique_user_facility_library_url_timestamp;
ALTER TABLE public.open_content_activities ADD CONSTRAINT unique_user_facility_library_url_timestamp UNIQUE (user_id, facility_id, content_id, open_content_url_id, request_ts);
ALTER TABLE public.open_content_activities 
drop COLUMN duration,
drop COLUMN stop_ts;

DROP TABLE IF EXISTS public.user_session_tracking CASCADE;
-- +goose StatementEnd
