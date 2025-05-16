-- +goose Up
-- +goose StatementBegin
ALTER TABLE cron_jobs ADD COLUMN category INTEGER DEFAULT 0;
UPDATE cron_jobs SET category = 1 WHERE name IN ('get_milestones', 'get_courses', 'get_activity');
UPDATE cron_jobs SET category = 2 WHERE name IN ('scrape_kiwix', 'retry_video_downloads', 'sync_video_metadata');
UPDATE cron_jobs SET category = 3 WHERE name IN ('daily_prog_history');
-- +goose StatementEnd

-- +goose Down                                   
-- +goose StatementBegin
ALTER TABLE cron_jobs DROP COLUMN IF EXISTS job_category;
-- +goose StatementEnd
