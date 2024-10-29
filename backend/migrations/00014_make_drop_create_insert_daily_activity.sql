-- +goose Up
-- +goose StatementBegin
drop function if exists
    public.insert_daily_activity(
       integer, integer, character varying, integer, character varying
);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
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
'
    DECLARE prev_total_time INT;
    DECLARE provider_type CHAR ( 100 );
    BEGIN
        select p.type INTO provider_type from activities a 
        inner join courses c on c.id = a.course_id 
                and c.deleted_at IS NULL
        inner join provider_platforms p on p.id = c.provider_platform_id
                and p.deleted_at IS NULL
        where a.user_id = _user_id AND a.course_id = _course_id
        LIMIT 1;
        SELECT total_time INTO prev_total_time FROM activities
        WHERE user_id = _user_id AND course_id = _course_id
        ORDER BY created_at DESC LIMIT 1;
        IF prev_total_time IS NULL THEN
            prev_total_time := 0;
        END IF;
        --kolibri total_time is the delta and total_time 
        --is required to be added to previous_total_time 
        IF provider_type = ''kolibri'' THEN
                INSERT INTO activities (user_id, course_id, type, total_time, time_delta, external_id, created_at, updated_at)
                VALUES (_user_id, _course_id, _type, _total_time + prev_total_time, _total_time, _external_id, NOW(), NOW());
        ELSE
                INSERT INTO activities (user_id, course_id, type, total_time, time_delta, external_id, created_at, updated_at)
                VALUES (_user_id, _course_id, _type, _total_time, _total_time - prev_total_time, _external_id, NOW(), NOW());
        END IF;
    END;
'
;
-- +goose StatementEnd
