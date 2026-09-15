-- +goose Up
-- +goose NO TRANSACTION
ALTER TYPE feature ADD VALUE IF NOT EXISTS 'ai_tutor';

INSERT INTO public.feature_flags (name, enabled)
VALUES ('ai_tutor', FALSE)
ON CONFLICT (name) DO NOTHING;

-- +goose Down
-- goose's NO TRANSACTION under Up applies to the whole file, not just that
-- block, so this runs unwrapped too — a multi-statement enum rename/recreate/
-- cast/drop here would leave two enum types and partially-migrated columns if
-- any statement failed partway through, with no rollback and no way to just
-- rerun. An unused 'ai_tutor' label left in the enum is harmless (nothing
-- selects it), so we don't recreate the type to remove it.
DELETE FROM public.facility_feature_flags WHERE feature = 'ai_tutor';
DELETE FROM public.feature_flags WHERE name = 'ai_tutor';
