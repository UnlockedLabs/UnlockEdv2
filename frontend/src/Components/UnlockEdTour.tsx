import { ThemeContext } from '@/Context/ThemeContext';
import { useTourContext } from '@/Context/TourContext';
import { useContext, useEffect } from 'react';
import Joyride, { CallBackProps, EVENTS } from 'react-joyride';
import { useNavigate } from 'react-router-dom';

export default function UnlockEdTour() {
    const {
        tourState: { run, stepIndex, steps },
        setTourState
    } = useTourContext();
    const { theme } = useContext(ThemeContext);
    const navigate = useNavigate();

    const style =
        theme === 'dark'
            ? {
                  options: {
                      arrowColor: '#1A3F3B',
                      backgroundColor: '#1A3F3B',
                      primaryColor: '#14958A',
                      textColor: '#EEEEEE'
                  }
              }
            : {
                  options: {
                      arrowColor: '#FFFFFF',
                      backgroundColor: '#FFFFFF',
                      primaryColor: '#18ABA0',
                      textColor: '#222222'
                  }
              };

    useEffect(() => {
        setTourState({
            steps: [
                {
                    target: '#resident-home',
                    content:
                        "Welcome to UnlockEd, a place for you to access and explore educational content. Let's take a quick tour to show you how things work.",
                    disableBeacon: true,
                    showSkipButton: true,
                    placement: 'center'
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
                    placement: 'center'
                },
                {
                    target: '#knowledge-center-tabs',
                    content:
                        'Use these tabs to switch between different types of resources.',
                    disableBeacon: true,
                    disableOverlayClose: true
                },
                {
                    target: '#knowledge-center-search',
                    content:
                        'To find something specific, you could type in a word or a title into the search bar.',
                    disableBeacon: true,
                    disableOverlayClose: true
                },
                {
                    target: '#knowledge-center-filters',
                    content:
                        'Too many results? You could use filters to see content by category.',
                    disableBeacon: true,
                    spotlightClicks: true,
                    disableOverlayClose: true,
                    placement: 'left'
                },
                {
                    target: '#knowledge-center-search-lib',
                    content:
                        "If you'd like to search within a specific library, you could use the magnifying glass.",
                    disableBeacon: true,
                    disableOverlayClose: true
                },
                {
                    target: '#knowledge-center-fav-lib',
                    content:
                        'The star allows you to favorite the library for easy access later. Try favoriting a library to save it for later!',
                    disableBeacon: true,
                    spotlightClicks: true,
                    disableOverlayClose: true
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
                    placement: 'center'
                },
                {
                    target: '#library-viewer-favorite',
                    content:
                        "If you're liking a page and want to return to it later, you could favorite it by giving it a name. Try it now!",
                    disableBeacon: true,
                    spotlightClicks: true,
                    disableOverlayClose: true
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
                    placement: 'top'
                },
                {
                    target: '#popular-content',
                    content:
                        'Find new content to explore based on what others in your facility are using!',
                    disableBeacon: true,
                    disableOverlayClose: true,
                    placement: 'top'
                },
                {
                    target: '#end-tour',
                    content:
                        'That\'s it! You\'re now ready to use UnlockEd. If you need help, revisit this tour anytime by clicking "Get Help".',
                    disableBeacon: true,
                    disableOverlayClose: true,
                    placement: 'center'
                }
            ]
        });
    }, []);

    const handleCallback = (data: CallBackProps) => {
        const { action, index, type } = data;
        console.log(data);
        if (
            action === 'close' ||
            action === 'skip' ||
            type === EVENTS.TOUR_END
        ) {
            setTourState({ tourActive: false, run: false, stepIndex: 0 });
        }

        if (type === EVENTS.STEP_AFTER || type === EVENTS.TARGET_NOT_FOUND) {
            if (action === 'next') {
                setTourState({ stepIndex: index + 1 });
            } else if (action === 'prev') {
                if (stepIndex === 12) {
                    navigate('/viewer/libraries/1');
                } else {
                    setTourState({ stepIndex: index - 1 });
                }
            }
        }
    };

    return (
        <>
            <Joyride
                steps={steps}
                continuous
                stepIndex={stepIndex}
                run={run}
                callback={handleCallback}
                styles={style}
            ></Joyride>
        </>
    );
}
