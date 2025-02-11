-- +goose Up
-- +goose StatementBegin
ALTER TABLE public.open_content_activities DROP CONSTRAINT unique_user_facility_library_url_timestamp;
ALTER TABLE public.open_content_activities ADD CONSTRAINT unique_user_facility_library_url_timestamp UNIQUE (user_id, facility_id, open_content_provider_id, content_id, open_content_url_id, request_ts);
ALTER TABLE public.open_content_activities 
ADD COLUMN stop_ts TIMESTAMP(0) WITHOUT TIME ZONE NULL,
ADD COLUMN duration INTERVAL GENERATED ALWAYS AS (stop_ts - request_ts) STORED;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE public.open_content_activities DROP CONSTRAINT unique_user_facility_library_url_timestamp;
ALTER TABLE public.open_content_activities ADD CONSTRAINT unique_user_facility_library_url_timestamp UNIQUE unique_user_facility_library_url_timestamp UNIQUE (user_id, facility_id, content_id, open_content_url_id, request_ts);
ALTER TABLE public.open_content_activities 
drop COLUMN duration,
drop COLUMN stop_ts;
-- +goose StatementEnd
