import { createContext, useContext } from 'react';
import { TourState } from '@/contexts/tourState';

interface TourContextType {
    tourState: TourState;
    setTourState: React.Dispatch<React.SetStateAction<TourState>>;
}

export const TourContext = createContext<TourContextType | undefined>(
    undefined
);

export function useTourContext(): {
    tourState: TourState;
    setTourState: (partialState: Partial<TourState>) => void;
} {
    const context = useContext(TourContext);

    if (!context) {
        throw new Error('useTourContext must be used within a TourProvider');
    }

    const setState = (partialState: Partial<TourState>) => {
        context.setTourState((prevState) => {
            return {
                ...prevState,
                ...partialState
            };
        });
    };

    return {
        tourState: context.tourState,
        setTourState: setState
    };
}
