-- +goose Up
-- +goose StatementBegin
ALTER TABLE public.program_class_enrollments
ADD COLUMN enrolled_at TIMESTAMP,
ADD COLUMN enrollment_ended_at TIMESTAMP;

-- Backfill timestamps for enrolled_at and enrollment_ended_at
UPDATE public.program_class_enrollments pce
SET enrolled_at = pce.created_at
FROM program_classes pc
WHERE pce.class_id = pc.id
  AND pc.status IN ('Active', 'Paused','Completed')
  AND pce.enrollment_status IN (
    'Enrolled',
    'Completed',
    'Incomplete: Withdrawn',
    'Incomplete: Dropped',
    'Incomplete: Inactive',
    'Incomplete: Failed to Complete',
    'Incomplete: Transfered',
    'Incomplete: Segregated'
  )
  AND pce.enrolled_at IS NULL;

UPDATE public.program_class_enrollments pce
SET enrollment_ended_at = pce.updated_at
FROM program_classes pc
WHERE pce.class_id = pc.id
  AND pc.status IN ('Active', 'Completed')
  AND pce.enrollment_status IN (
    'Completed',
    'Incomplete: Withdrawn',
    'Incomplete: Dropped',
    'Incomplete: Inactive',
    'Incomplete: Failed to Complete',
    'Incomplete: Transfered',
    'Incomplete: Segregated'
  )
  AND pce.enrollment_ended_at IS NULL;
-- +goose StatementEnd


-- +goose Down
-- +goose StatementBegin
ALTER TABLE public.program_class_enrollments
DROP COLUMN IF EXISTS enrolled_at,
DROP COLUMN IF EXISTS enrollment_ended_at;
-- +goose StatementEnd
