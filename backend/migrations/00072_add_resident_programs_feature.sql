-- +goose Up
-- +goose NO TRANSACTION
-- A newly added enum value cannot be referenced inside the transaction that adds
-- it, so this migration runs unwrapped and the INSERT below autocommits separately.
ALTER TYPE feature ADD VALUE IF NOT EXISTS 'resident_programs';

-- Resident-facing visibility of the Programs page is ON by default: once program
-- tracking is enabled, residents keep access to their own program information
-- unless an admin explicitly turns it off for their facility.
INSERT INTO public.page_feature_flags (feature_flag_id, page_feature, enabled, created_at)
SELECT id, 'resident_programs', TRUE, now()
FROM public.feature_flags WHERE name = 'program_management'
ON CONFLICT (page_feature) DO NOTHING;

-- +goose Down
-- goose's NO TRANSACTION under Up applies to the whole file, not just that
-- block, so this runs unwrapped regardless of the line below — a multi-statement
-- enum rename/recreate/cast/drop here would leave two enum types and
-- partially-migrated columns if any statement failed partway through, with no
-- rollback and no way to just rerun. An unused 'resident_programs' label left
-- in the enum is harmless (nothing selects it), so we don't recreate the type
-- to remove it.
DELETE FROM public.facility_feature_flags WHERE feature = 'resident_programs';
DELETE FROM public.page_feature_flags WHERE page_feature = 'resident_programs';
