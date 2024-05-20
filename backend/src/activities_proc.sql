CREATE OR REPLACE FUNCTION public.insert_daily_activity(
    _user_id INT,
    _program_id INT,
    _type VARCHAR,
    _total_time INT,
    _external_id VARCHAR)
RETURNS VOID AS $$
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
$$ LANGUAGE plpgsql;
