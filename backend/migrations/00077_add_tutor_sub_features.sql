-- +goose Up
-- +goose NO TRANSACTION
-- A newly added enum value cannot be referenced inside the transaction that adds
-- it, so this migration runs unwrapped and the INSERTs below autocommit separately.
ALTER TYPE feature ADD VALUE IF NOT EXISTS 'hiset_tutor';
ALTER TYPE feature ADD VALUE IF NOT EXISTS 'curriculum_builder';

-- ai_tutor becomes a container for two capabilities rather than a product of its
-- own: the HiSET tutor residents talk to, and admin-built curriculum they only
-- read. Sub-features so the existing parent cascade applies — neither can be
-- effective where ai_tutor is off.
INSERT INTO public.page_feature_flags (feature_flag_id, page_feature, enabled, created_at)
SELECT id, 'hiset_tutor', TRUE, now()
FROM public.feature_flags WHERE name = 'ai_tutor'
ON CONFLICT (page_feature) DO NOTHING;

-- Off statewide: curriculum is new, and generating it spends money.
INSERT INTO public.page_feature_flags (feature_flag_id, page_feature, enabled, created_at)
SELECT id, 'curriculum_builder', FALSE, now()
FROM public.feature_flags WHERE name = 'ai_tutor'
ON CONFLICT (page_feature) DO NOTHING;

-- Backfill, and it is load-bearing rather than tidy-up.
--
-- GetFeatureAccess only emits page features whose parent is enabled STATEWIDE,
-- and ai_tutor is statewide FALSE (00075). Every facility running the tutor today
-- therefore does so through a facility_feature_flags override, which the statewide
-- default above cannot see. Without this, resolveFeatures hands those facilities
-- hiset_tutor = false on deploy and the tutor goes dark for all of them.
--
-- So: give an explicit hiset_tutor override to every facility whose *effective*
-- ai_tutor is on, reproducing the same override-wins-over-statewide resolution
-- GetFacilityFeatureAccess uses.
INSERT INTO public.facility_feature_flags (facility_id, feature, enabled, created_at, updated_at)
SELECT f.id, 'hiset_tutor', TRUE, now(), now()
FROM public.facilities f
WHERE COALESCE(
    (SELECT ff.enabled FROM public.facility_feature_flags ff
      WHERE ff.facility_id = f.id AND ff.feature = 'ai_tutor'),
    (SELECT fl.enabled FROM public.feature_flags fl WHERE fl.name = 'ai_tutor'),
    FALSE)
ON CONFLICT (facility_id, feature) DO NOTHING;

-- +goose Down
-- goose's NO TRANSACTION under Up applies to the whole file, not just that
-- block, so this runs unwrapped regardless of the line below — a multi-statement
-- enum rename/recreate/cast/drop here would leave two enum types and
-- partially-migrated columns if any statement failed partway through, with no
-- rollback and no way to just rerun. Unused 'hiset_tutor'/'curriculum_builder'
-- labels left in the enum are harmless (nothing selects them), so we don't
-- recreate the type to remove them.
DELETE FROM public.facility_feature_flags WHERE feature IN ('hiset_tutor', 'curriculum_builder');
DELETE FROM public.page_feature_flags WHERE page_feature IN ('hiset_tutor', 'curriculum_builder');
