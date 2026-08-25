// import useSWR from 'swr';
import type { LearningRecordFacility } from '@/api/learningRecord';
// import type { ServerResponseMany } from '@/types/server';

/**
 * TEMPORARY (pilot): the Maine women's facilities, hardcoded.
 *
 * The pilot is specific to SMWRC, which houses only women, so the dropdown must
 * not offer every facility in the tool — men's facilities are not valid answers
 * here. Until the tool can distinguish men's from women's facilities, these are
 * the only two listed; anything else goes under "Other (not listed)".
 *
 * The ids are the real facility ids, so entries still save a structured
 * facility_id and the backend join keeps working unchanged.
 *
 * The `GET /api/learning-record/facilities` route stays in place and is only
 * commented out below — restore the SWR fetch to undo this.
 */
const SMWRC: LearningRecordFacility = { id: 2, name: 'SMWRC' };
const WOMENS_CENTER_MCC: LearningRecordFacility = {
    id: 3,
    name: "Women's Center (MCC)"
};

const PILOT_FACILITIES: LearningRecordFacility[] = [SMWRC, WOMENS_CENTER_MCC];

/**
 * TEMPORARY (pilot): prefilled as the location on new achievements, since the
 * pilot runs at SMWRC. Replaces the resident's own facility as the default —
 * see the commented-out derivation in DigitalTranscriptWysiwygEntry.
 */
export const PILOT_DEFAULT_FACILITY: LearningRecordFacility = SMWRC;

/**
 * Facilities for the achievement location dropdown.
 *
 * While the pilot list is hardcoded there is nothing to load and nothing that
 * can fail, so `loaded` is always true and `failed` always false. The shape is
 * unchanged from the fetching version so restoring the fetch touches only this
 * file.
 */
export function useLearningRecordFacilities(): {
    facilities: LearningRecordFacility[];
    loaded: boolean;
    failed: boolean;
} {
    return {
        facilities: PILOT_FACILITIES,
        loaded: true,
        failed: false
    };
}

/*
 * Pre-pilot implementation — restore this (and the imports above) once the
 * facility list can be filtered server-side.
 *
 * SWR dedupes the request across every mounted form row, so this fetches once
 * rather than once per row.
 *
 * A failed load must never be cached as an empty list: residents would silently
 * lose the real facility list for the rest of the session and could only pick
 * "Other", turning a structured facility_id into free text. SWR keeps `data`
 * undefined on error, so the next mount refetches.
 *
 * export function useLearningRecordFacilities(): {
 *     facilities: LearningRecordFacility[];
 *     loaded: boolean;
 *     failed: boolean;
 * } {
 *     const { data, error, isLoading } = useSWR<
 *         ServerResponseMany<LearningRecordFacility>,
 *         Error
 *     >('/api/learning-record/facilities');
 *
 *     return {
 *         facilities: data?.data ?? [],
 *         loaded: !isLoading,
 *         failed: !!error
 *     };
 * }
 */
