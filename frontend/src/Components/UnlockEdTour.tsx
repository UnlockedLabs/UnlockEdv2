import { ThemeContext } from '@/Context/ThemeContext';
import { initialTourState, useTourContext } from '@/Context/TourContext';
import { useContext } from 'react';
import Joyride, { CallBackProps, EVENTS } from 'react-joyride';
import { useNavigate } from 'react-router-dom';

export const targetToStepIndexMap = {
    '#resident-home': 0,
    '#visit-knowledge-center': 1,
    '#knowledge-center-landing': 2,
    '#knowledge-center-tabs': 3,
    '#knowledge-center-search': 4,
    '#knowledge-center-filters': 5,
    '#knowledge-center-search-lib': 6,
    '#knowledge-center-fav-lib': 7,
    '#knowledge-center-enter-library': 8,
    '#library-viewer-sub-page': 9,
    '#library-viewer-favorite': 10,
    '#navigate-homepage': 11,
    '#top-content': 12,
    '#popular-content': 13,
    '#end-tour': 14
};

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

    const handleCallback = (data: CallBackProps) => {
        const { action, index, type, step } = data;
        const currentTarget = step.target;
        if (
            action === 'close' ||
            action === 'skip' ||
            type === EVENTS.TOUR_END
        ) {
            setTourState(initialTourState);
        }
        if (type === EVENTS.STEP_AFTER || type === EVENTS.TARGET_NOT_FOUND) {
            if (action === 'next') {
                if (currentTarget === '#end-tour') {
                    setTourState(initialTourState);
                }
                const nextTarget = steps[index + 1]?.target as string;
                if (nextTarget) {
                    setTourState({
                        stepIndex:
                            targetToStepIndexMap[
                                nextTarget as keyof typeof targetToStepIndexMap
                            ],
                        target: nextTarget
                    });
                }
            } else if (action === 'prev') {
                const prevTarget = steps[index - 1]?.target as string;
                switch (currentTarget) {
                    case '#knowledge-center-landing':
                        setTourState({
                            stepIndex: targetToStepIndexMap['#resident-home'],
                            target: '#resident-home'
                        });
                        navigate('/home');
                        return;
                    case '#library-viewer-sub-page':
                        navigate('/knowledge-center/libraries');
                        return;
                    case '#top-content':
                        navigate('/viewer/libraries/1');
                        return;
                    default:
                        setTourState({
                            stepIndex:
                                targetToStepIndexMap[
                                    prevTarget as keyof typeof targetToStepIndexMap
                                ],
                            target: prevTarget
                        });
                        break;
                }
            }
        }
    };

    return (
        <>
            <Joyride
                steps={steps}
                locale={{
                    nextLabelWithProgress: 'Next ({step} of {steps})',
                    last: 'Done'
                }}
                continuous
                stepIndex={stepIndex}
                run={run}
                callback={handleCallback}
                styles={style}
            ></Joyride>
        </>
    );
}
