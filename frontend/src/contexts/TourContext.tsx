import { useMemo, useState } from 'react';
import { initialTourState, TourState } from '@/contexts/tourState';
import { TourContext } from '@/contexts/useTourContext';

export function TourProvider({ children }: { children: React.ReactNode }) {
    const [tourState, setTourState] = useState<TourState>(initialTourState);

    const value = useMemo(
        () => ({
            tourState,
            setTourState
        }),
        [tourState, setTourState]
    );

    return (
        <TourContext.Provider value={value}>{children}</TourContext.Provider>
    );
}
