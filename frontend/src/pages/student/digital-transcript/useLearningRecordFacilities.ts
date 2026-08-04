import { useEffect, useState } from 'react';
import {
    apiGetLearningRecordFacilities,
    type LearningRecordFacility
} from '@/api/learningRecord';

/**
 * Module-level cache so the achievement location dropdown fetches once per
 * session rather than once per mounted form row.
 */
let cached: LearningRecordFacility[] | null = null;
let inFlight: Promise<LearningRecordFacility[]> | null = null;

function loadFacilities(): Promise<LearningRecordFacility[]> {
    if (cached) return Promise.resolve(cached);
    inFlight ??= apiGetLearningRecordFacilities()
        .then((facilities) => {
            cached = facilities;
            return facilities;
        })
        .finally(() => {
            inFlight = null;
        });
    return inFlight;
}

export function useLearningRecordFacilities(): {
    facilities: LearningRecordFacility[];
    loaded: boolean;
} {
    const [facilities, setFacilities] = useState<LearningRecordFacility[]>(
        cached ?? []
    );
    const [loaded, setLoaded] = useState(cached !== null);

    useEffect(() => {
        if (cached) return;
        let cancelled = false;
        void loadFacilities().then((result) => {
            if (cancelled) return;
            setFacilities(result);
            setLoaded(true);
        });
        return () => {
            cancelled = true;
        };
    }, []);

    return { facilities, loaded };
}
