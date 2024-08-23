-- +goose Up
-- +goose StatementBegin
CREATE FUNCTION public.check_milestone_completion() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    total_milestones INT;
    user_milestones INT;
BEGIN
    SELECT total_progress_milestones
    INTO total_milestones
    FROM programs
    WHERE id = NEW.program_id;

    SELECT COUNT(*)
    INTO user_milestones
    FROM milestones
    WHERE program_id = NEW.program_id AND user_id = NEW.user_id;

    IF user_milestones = total_milestones THEN
        INSERT INTO outcomes (type, program_id, user_id, value)
        VALUES ('progress_completion', NEW.program_id, NEW.user_id, '100');
    END IF;

    RETURN NEW;
END;
$$;

CREATE FUNCTION public.insert_daily_activity(_user_id integer, _program_id integer, _type character varying, _total_time integer, _external_id character varying) RETURNS void
    LANGUAGE plpgsql
    AS $$
    DECLARE
        prev_total_time INT;
    BEGIN
        SELECT total_time INTO prev_total_time FROM activities
        WHERE user_id = _user_id AND program_id = _program_id
        ORDER BY created_at DESC LIMIT 1;

        IF prev_total_time IS NULL THEN
            prev_total_time := 0;
        END IF;
        INSERT INTO activities (user_id, program_id, type, total_time, time_delta, external_id, created_at, updated_at)
        VALUES (_user_id, _program_id, _type, _total_time, _total_time - prev_total_time, _external_id, NOW(), NOW());
    END;
$$;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP FUNCTION IF EXISTS public.check_milestone_completion();
DROP FUNCTION IF EXISTS public.insert_daily_activity(integer, integer, character varying, integer, character varying);
-- +goose StatementEnd
