import { createContext, useContext, useMemo, useState } from 'react';
import { Step } from 'react-joyride';

interface TourContextType {
    tourState: TourState;
    setTourState: React.Dispatch<React.SetStateAction<TourState>>;
}

export const initialTourState: TourState = {
    run: false,
    stepIndex: 0,
    steps: [
        {
            target: '#resident-home',
            content:
                "Welcome to UnlockEd, a place for you to access and explore educational content. Let's take a quick tour to show you how things work.",
            disableBeacon: true,
            showSkipButton: true,
            placement: 'center',
            showProgress: true
        },
        {
            target: '#visit-knowledge-center',
            content:
                'Click on Knowledge Center to access a variety of resources. Try it now!',
            disableOverlayClose: true,
            disableBeacon: true,
            spotlightClicks: true,
            hideCloseButton: true,
            hideFooter: true
        },
        {
            target: '#knowledge-center-landing',
            content:
                'Welcome to the Knowledge Center. Here, you can find a range of resources in both written and video format, as well as helpful links.',
            disableBeacon: true,
            disableOverlayClose: true,
            placement: 'center',
            showProgress: true
        },
        {
            target: '#knowledge-center-tabs',
            content:
                'Use these tabs to switch between different types of resources.',
            disableBeacon: true,
            disableOverlayClose: true,
            showProgress: true
        },
        {
            target: '#knowledge-center-search',
            content:
                'To find something specific, you could type in a word or a title into the search bar.',
            disableBeacon: true,
            disableOverlayClose: true,
            showProgress: true
        },
        {
            target: '#knowledge-center-filters',
            content:
                'Too many results? You could use filters to see content by category.',
            disableBeacon: true,
            spotlightClicks: true,
            disableOverlayClose: true,
            placement: 'left',
            showProgress: true
        },
        {
            target: '#knowledge-center-search-lib',
            content:
                "If you'd like to search within a specific library, you could use the magnifying glass.",
            disableBeacon: true,
            disableOverlayClose: true,
            showProgress: true
        },
        {
            target: '#knowledge-center-fav-lib',
            content:
                'The star allows you to favorite the library for easy access later. Try favoriting a library to save it for later!',
            disableBeacon: true,
            spotlightClicks: true,
            disableOverlayClose: true,
            showProgress: true
        },
        {
            target: '#knowledge-center-enter-library',
            content:
                "Click on a library to open it and see what's inside. Try it now!",
            disableBeacon: true,
            spotlightClicks: true,
            hideFooter: true
        },
        {
            target: '#library-viewer-sub-page',
            content: 'Here, you can see everything inside the library.',
            disableBeacon: true,
            disableOverlayClose: true,
            placement: 'center',
            showProgress: true
        },
        {
            target: '#library-viewer-favorite',
            content:
                "If you're liking a page and want to return to it later, you could favorite it by giving it a name. Try it now!",
            disableBeacon: true,
            spotlightClicks: true,
            disableOverlayClose: true,
            showProgress: true
        },
        {
            target: '#navigate-homepage',
            content:
                'You can always return to the homepage by clicking Home. Try it now!',
            disableBeacon: true,
            disableOverlayClose: true,
            spotlightClicks: true,
            hideFooter: true,
            placement: 'right',
            disableScrolling: true
        },
        {
            target: '#top-content',
            content:
                'Your top content shows the libraries and videos you visit the most.',
            disableBeacon: true,
            disableOverlayClose: true,
            placement: 'top',
            showProgress: true
        },
        {
            target: '#popular-content',
            content:
                'Find new content to explore based on what others in your facility are using!',
            disableBeacon: true,
            disableOverlayClose: true,
            placement: 'top',
            showProgress: true
        },
        {
            target: '#end-tour',
            content:
                'That\'s it! You\'re now ready to use UnlockEd. If you need help, revisit this tour anytime by clicking "Get Help".',
            disableBeacon: true,
            disableOverlayClose: true,
            placement: 'center'
        }
    ],
    tourActive: false,
    target: ''
};

interface TourState {
    run: boolean;
    stepIndex: number;
    steps: Step[];
    tourActive: boolean;
    target: string;
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

    return {
        tourState: context.tourState,
        setTourState: setState
    };
}
