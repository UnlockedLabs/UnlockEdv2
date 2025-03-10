import { useTourContext } from '@/Context/TourContext';
import { useEffect } from 'react';
import Joyride from 'react-joyride';

export default function UnlockEdTour() {
    const {
        tourState: { run, stepIndex, steps },
        setTourState
    } = useTourContext();

    useEffect(() => {
        console.log('Setting initial steps');
        setTourState({
            steps: [
                {
                    target: '#resident-home',
                    content:
                        'Welcome to UnlockEd, a portal for you to access and explore educational content. This tour will guide you through some features of the platform.'
                },
                {
                    target: '#visit-knowledge-center',
                    content:
                        'Click here to visit the Knowledge Center, where you can access libraries, videos, and helpful links.',
                    disableOverlayClose: true,
                    disableBeacon: true,
                    spotlightClicks: true
                },
                {
                    target: '#knowledge-center-landing',
                    content:
                        'Here you can find libraries, videos, and helpful links. Click on a library to view its contents.'
                }
            ]
        });
    }, []);

    const startTour = () => {
        console.log('Starting tour');
        setTourState({ run: true });
    };

    useEffect(() => {
        console.log('Step index changed:', stepIndex);
    }, [stepIndex]);

    return (
        <>
            <button onClick={startTour}>Start Tour</button>
            <Joyride
                steps={steps}
                continuous={true}
                stepIndex={stepIndex}
                run={run}
            ></Joyride>
        </>
    );
}
