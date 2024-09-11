-- +goose Up
-- +goose StatementBegin
create function public.check_milestone_completion()
returns trigger
language plpgsql
as $$
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
$$
;

create function
    public.insert_daily_activity(
        _user_id integer,
        _course_id integer,
        _type character varying,
        _total_time integer,
        _external_id character varying
    )
returns void
language plpgsql
as
    $$
    DECLARE
        prev_total_time INT;
    BEGIN
        SELECT total_time INTO prev_total_time FROM activities
        WHERE user_id = _user_id AND course_id = _course_id
        ORDER BY created_at DESC LIMIT 1;

        IF prev_total_time IS NULL THEN
            prev_total_time := 0;
        END IF;
        INSERT INTO activities (user_id, course_id, type, total_time, time_delta, external_id, created_at, updated_at)
        VALUES (_user_id, _course_id, _type, _total_time, _total_time - prev_total_time, _external_id, NOW(), NOW());
    END;
$$
;
-- +goose StatementEnd
-- +goose Down
-- +goose StatementBegin
drop function if exists public.check_milestone_completion()
;
drop function if exists
    public.insert_daily_activity(
        integer, integer, character varying, integer, character varying
    )
;
-- +goose StatementEnd


