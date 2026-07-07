-- +goose Up
-- +goose StatementBegin
CREATE TEMP TABLE hl_canonical AS
SELECT url, MIN(id) AS keep_id
FROM public.helpful_links
WHERE deleted_at IS NULL
GROUP BY url;

-- Remap favorites and activities from duplicate-url rows to the canonical row.
-- Links were unique per (facility, url) and users belong to one facility, so
-- remapped favorites cannot collide.
UPDATE public.open_content_favorites f
SET content_id = c.keep_id
FROM public.helpful_links hl
JOIN hl_canonical c ON c.url = hl.url
WHERE f.content_id = hl.id
  AND f.open_content_provider_id = hl.open_content_provider_id
  AND hl.deleted_at IS NULL
  AND hl.id <> c.keep_id;

UPDATE public.open_content_activities a
SET content_id = c.keep_id
FROM public.helpful_links hl
JOIN hl_canonical c ON c.url = hl.url
WHERE a.content_id = hl.id
  AND a.open_content_provider_id = hl.open_content_provider_id
  AND hl.deleted_at IS NULL
  AND hl.id <> c.keep_id;

-- Preserve each facility's current visibility as a per-facility row.
INSERT INTO public.facility_visibility_statuses AS fvs (facility_id, open_content_provider_id, content_id, visibility_status)
SELECT hl.facility_id, hl.open_content_provider_id, c.keep_id, hl.visibility_status
FROM public.helpful_links hl
JOIN hl_canonical c ON c.url = hl.url
JOIN public.facilities fac ON fac.id = hl.facility_id
WHERE hl.deleted_at IS NULL
ON CONFLICT (facility_id, open_content_provider_id, content_id)
DO UPDATE SET visibility_status = fvs.visibility_status OR EXCLUDED.visibility_status;

-- Soft-delete merged duplicates, then drop the per-facility columns.
UPDATE public.helpful_links hl
SET deleted_at = NOW()
FROM hl_canonical c
WHERE hl.url = c.url
  AND hl.deleted_at IS NULL
  AND hl.id <> c.keep_id;

ALTER TABLE public.helpful_links
  DROP COLUMN facility_id,
  DROP COLUMN visibility_status;

CREATE UNIQUE INDEX idx_helpful_links_url ON public.helpful_links (url) WHERE deleted_at IS NULL;

DROP TABLE hl_canonical;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP INDEX IF EXISTS idx_helpful_links_url;

ALTER TABLE public.helpful_links
  ADD COLUMN facility_id INTEGER,
  ADD COLUMN visibility_status BOOLEAN DEFAULT TRUE;

-- Best-effort restore: assign each link to the first facility that had a
-- visibility row for it. Merged duplicates are not resurrected.
UPDATE public.helpful_links hl
SET facility_id = fvs.facility_id,
    visibility_status = fvs.visibility_status
FROM (
    SELECT DISTINCT ON (content_id) content_id, facility_id, visibility_status
    FROM public.facility_visibility_statuses v
    JOIN public.open_content_providers ocp ON ocp.id = v.open_content_provider_id AND ocp.title = 'HelpfulLinks'
    ORDER BY content_id, facility_id
) fvs
WHERE fvs.content_id = hl.id;

DELETE FROM public.facility_visibility_statuses v
USING public.open_content_providers ocp
WHERE ocp.id = v.open_content_provider_id AND ocp.title = 'HelpfulLinks';
-- +goose StatementEnd
