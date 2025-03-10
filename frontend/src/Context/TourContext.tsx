import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Step } from 'react-joyride';

interface TourContextType {
    tourState: TourState;
    setTourState: React.Dispatch<React.SetStateAction<TourState>>;
}

const initialTourState: TourState = {
    run: false,
    stepIndex: 0,
    steps: [],
    tourActive: false
};

interface TourState {
    run: boolean;
    stepIndex: number;
    steps: Step[];
    tourActive: boolean;
}

export const TourContext = createContext<TourContextType | undefined>(
    undefined
);

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
            const newState = {
                ...prevState,
                ...partialState
            };
            return newState;
        });
    };

    useEffect(() => {
        console.log(context.tourState.stepIndex);
    }, [context.tourState.stepIndex]);

    return {
        tourState: context.tourState,
        setTourState: setState
    };
}
