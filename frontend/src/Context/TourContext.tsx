import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Step } from 'react-joyride';

interface TourState {
    run: boolean;
    stepIndex: number;
    steps: Step[];
    tourActive: boolean;
}

const initialTourState: TourState = {
    run: false,
    stepIndex: 0,
    steps: [],
    tourActive: false
};

export const TourContext = createContext<{
    tourState: TourState;
    setTourState: React.Dispatch<React.SetStateAction<TourState>>;
}>({
    tourState: initialTourState,
    setTourState: () => void {}
});

export function TourProvider(props: { children: React.ReactNode }) {
    const [tourState, setTourState] = useState<TourState>(initialTourState);

    const value = useMemo(
        () => ({
            tourState,
            setTourState
        }),
        [setTourState, tourState]
    );

    return <TourContext.Provider value={value} {...props} />;
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
        console.log('Setting state with partialState:', partialState);
        context.setTourState((prevState) => {
            const newState = {
                ...prevState,
                ...partialState
            };
            console.log('New state:', newState);
            return newState;
        });
    };

    useEffect(() => {
        console.log('Tour state updated:', context.tourState);
    }, [context.tourState]);

    return {
        tourState: context.tourState,
        setTourState: setState
    };
}
