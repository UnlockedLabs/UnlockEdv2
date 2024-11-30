-- +goose Up
-- +goose StatementBegin
CREATE TABLE public.login_metrics (
     user_id INTEGER NOT NULL PRIMARY KEY,
	 total BIGINT NOT NULL DEFAULT 1,
	 last_login timestamp with time zone DEFAULT now(),
	 FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX user_login_metrics_user_id_idx ON public.login_metrics(user_id);
CREATE INDEX user_login_metrics_login_count_idx ON public.login_metrics(total);
CREATE INDEX user_login_metrics_last_login_idx ON public.login_metrics(last_login);

CREATE TABLE public.login_activity (
    time_interval TIMESTAMP NOT NULL,
    facility_id INT,
    total_logins BIGINT DEFAULT 1,
	FOREIGN KEY (facility_id) REFERENCES public.facilities(id) ON DELETE CASCADE ON UPDATE CASCADE,
    PRIMARY KEY (time_interval, facility_id)
);
CREATE INDEX login_activity_time_interval_idx ON public.login_activity(time_interval);
CREATE INDEX login_activity_facility_id_idx ON public.login_activity(facility_id);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE public.login_metrics CASCADE;
DROP TABLE public.login_activity CASCADE;
-- +goose StatementEnd
