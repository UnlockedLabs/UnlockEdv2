import useSWR from 'swr';
import type { LearningRecordFacility } from '@/api/learningRecord';
import type { ServerResponseMany } from '@/types/server';

/**
 * Facilities for the achievement location dropdown. SWR dedupes the request
 * across every mounted form row, so this fetches once rather than once per row.
 *
 * A failed load must never be cached as an empty list: residents would silently
 * lose the real facility list for the rest of the session and could only pick
 * "Other", turning a structured facility_id into free text. SWR keeps `data`
 * undefined on error, so the next mount refetches.
 */
export function useLearningRecordFacilities(): {
    facilities: LearningRecordFacility[];
    loaded: boolean;
    failed: boolean;
} {
    const { data, error, isLoading } = useSWR<
        ServerResponseMany<LearningRecordFacility>,
        Error
    >('/api/learning-record/facilities');

    return {
        facilities: data?.data ?? [],
        loaded: !isLoading,
        failed: !!error
    };
}
