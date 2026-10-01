-- +goose Up
-- Blank/whitespace-only values in nullable text columns become NULL (EN-103).
-- Each UPDATE only touches the blank rows, so locks are short and row-scoped.
-- program_classes has an audit trigger (log_program_classes_updates), so any
-- cleaned rows there get a program_classes_history entry.
UPDATE public.users SET doc_id = NULL WHERE btrim(doc_id) = '';
UPDATE public.users SET kratos_id = NULL WHERE btrim(kratos_id) = '';

UPDATE public.courses SET description = NULL WHERE btrim(description) = '';
UPDATE public.courses SET thumbnail_url = NULL WHERE btrim(thumbnail_url) = '';
UPDATE public.courses SET external_url = NULL WHERE btrim(external_url) = '';
UPDATE public.courses SET alt_name = NULL WHERE btrim(alt_name) = '';
UPDATE public.courses SET outcome_types = NULL WHERE btrim(outcome_types) = '';

UPDATE public.user_enrollments SET external_id = NULL WHERE btrim(external_id) = '';

UPDATE public.provider_user_mappings SET external_login_id = NULL WHERE btrim(external_login_id) = '';

UPDATE public.videos SET description = NULL WHERE btrim(description) = '';
UPDATE public.videos SET thumbnail_url = NULL WHERE btrim(thumbnail_url) = '';

UPDATE public.video_download_attempts SET error_message = NULL WHERE btrim(error_message) = '';

UPDATE public.open_content_providers SET title = NULL WHERE btrim(title) = '';
UPDATE public.open_content_providers SET thumbnail_url = NULL WHERE btrim(thumbnail_url) = '';
UPDATE public.open_content_providers SET description = NULL WHERE btrim(description) = '';

UPDATE public.open_content_favorites SET name = NULL WHERE btrim(name) = '';

UPDATE public.helpful_links SET thumbnail_url = NULL WHERE btrim(thumbnail_url) = '';

UPDATE public.libraries SET external_id = NULL WHERE btrim(external_id) = '';
UPDATE public.libraries SET language = NULL WHERE btrim(language) = '';
UPDATE public.libraries SET description = NULL WHERE btrim(description) = '';
UPDATE public.libraries SET thumbnail_url = NULL WHERE btrim(thumbnail_url) = '';

UPDATE public.program_classes SET description = NULL WHERE btrim(description) = '';

UPDATE public.facilities_programs SET program_owner = NULL WHERE btrim(program_owner) = '';

UPDATE public.program_class_enrollments SET change_reason = NULL WHERE btrim(change_reason) = '';

UPDATE public.program_class_events SET reason = NULL WHERE btrim(reason) = '';

UPDATE public.program_class_event_overrides SET reason = NULL WHERE btrim(reason) = '';

UPDATE public.program_class_event_attendance SET note = NULL WHERE btrim(note) = '';
UPDATE public.program_class_event_attendance SET reason_category = NULL WHERE btrim(reason_category) = '';
ALTER TABLE public.program_class_event_attendance ALTER COLUMN reason_category DROP DEFAULT;

-- +goose Down
-- The cleaned blanks are not restored; NULL and '' are treated the same on read.
ALTER TABLE public.program_class_event_attendance ALTER COLUMN reason_category SET DEFAULT '';
