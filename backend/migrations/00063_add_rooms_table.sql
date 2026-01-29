-- +goose Up
-- +goose StatementBegin
CREATE TABLE public.rooms (
    id SERIAL PRIMARY KEY,
    facility_id INTEGER NOT NULL,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
    create_user_id INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
    update_user_id INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
    FOREIGN KEY (facility_id) REFERENCES public.facilities(id) ON UPDATE CASCADE ON DELETE CASCADE
);
CREATE INDEX idx_rooms_create_user_id ON public.rooms(create_user_id);
CREATE INDEX idx_rooms_update_user_id ON public.rooms(update_user_id);
CREATE INDEX idx_rooms_facility_id ON public.rooms(facility_id);
CREATE INDEX idx_rooms_deleted_at ON public.rooms(deleted_at);
CREATE UNIQUE INDEX idx_rooms_facility_name ON public.rooms(facility_id, name) WHERE deleted_at IS NULL;

ALTER TABLE public.program_class_events ADD COLUMN room_id INTEGER;
ALTER TABLE public.program_class_events
    ADD CONSTRAINT fk_pce_room_id FOREIGN KEY (room_id) REFERENCES public.rooms(id) ON UPDATE CASCADE ON DELETE SET NULL;
CREATE INDEX idx_pce_room_id ON public.program_class_events(room_id);

ALTER TABLE public.program_class_event_overrides ADD COLUMN room_id INTEGER;
ALTER TABLE public.program_class_event_overrides
    ADD CONSTRAINT fk_pceo_room_id FOREIGN KEY (room_id) REFERENCES public.rooms(id) ON UPDATE CASCADE ON DELETE SET NULL;
CREATE INDEX idx_pceo_room_id ON public.program_class_event_overrides(room_id);

-- migrate existing room text values to normalized rooms table
INSERT INTO public.rooms (facility_id, name, created_at, updated_at)
SELECT DISTINCT
    c.facility_id,
    COALESCE(NULLIF(TRIM(e.room), ''), 'TBD') as name,
    NOW(), NOW()
FROM public.program_class_events e
JOIN public.program_classes c ON c.id = e.class_id
WHERE e.deleted_at IS NULL
ON CONFLICT DO NOTHING;

UPDATE public.program_class_events e
SET room_id = r.id
FROM public.program_classes c, public.rooms r
WHERE c.id = e.class_id
  AND r.facility_id = c.facility_id
  AND r.name = COALESCE(NULLIF(TRIM(e.room), ''), 'TBD')
  AND r.deleted_at IS NULL;

INSERT INTO public.rooms (facility_id, name, created_at, updated_at)
SELECT DISTINCT
    c.facility_id,
    TRIM(ov.room) as name,
    NOW(), NOW()
FROM public.program_class_event_overrides ov
JOIN public.program_class_events e ON e.id = ov.event_id
JOIN public.program_classes c ON c.id = e.class_id
WHERE ov.deleted_at IS NULL
  AND ov.room IS NOT NULL AND TRIM(ov.room) != ''
ON CONFLICT DO NOTHING;

UPDATE public.program_class_event_overrides ov
SET room_id = r.id
FROM public.program_class_events e, public.program_classes c, public.rooms r
WHERE e.id = ov.event_id
  AND c.id = e.class_id
  AND r.facility_id = c.facility_id
  AND r.name = TRIM(ov.room)
  AND r.deleted_at IS NULL
  AND ov.room IS NOT NULL AND TRIM(ov.room) != '';

ALTER TABLE public.program_class_events ALTER COLUMN room_id SET NOT NULL;
ALTER TABLE public.program_class_events DROP COLUMN room;
ALTER TABLE public.program_class_event_overrides DROP COLUMN room;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE public.program_class_events
    ADD COLUMN room VARCHAR(255) DEFAULT 'TBD',
    ALTER COLUMN room_id DROP NOT NULL;
ALTER TABLE public.program_class_event_overrides ADD COLUMN room VARCHAR(255);

UPDATE public.program_class_events e
SET room = r.name
FROM public.rooms r
WHERE e.room_id = r.id;

UPDATE public.program_class_event_overrides ov
SET room = r.name
FROM public.rooms r
WHERE ov.room_id = r.id;

ALTER TABLE public.program_class_event_overrides DROP CONSTRAINT IF EXISTS fk_pceo_room_id;
ALTER TABLE public.program_class_event_overrides DROP COLUMN IF EXISTS room_id;
ALTER TABLE public.program_class_events DROP CONSTRAINT IF EXISTS fk_pce_room_id;
ALTER TABLE public.program_class_events DROP COLUMN IF EXISTS room_id;
DROP TABLE IF EXISTS public.rooms;
-- +goose StatementEnd
