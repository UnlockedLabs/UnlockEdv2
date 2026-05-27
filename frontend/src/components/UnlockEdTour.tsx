import { initialTourState, targetToStepIndexMap } from '@/contexts/tourState';
import { useTourContext } from '@/contexts/useTourContext';
import { useTheme } from 'next-themes';
import Joyride, { CallBackProps, EVENTS } from 'react-joyride';
import { useNavigate } from 'react-router-dom';
import { BRAND, BRAND_DARK } from '@/lib/brand';

export default function UnlockEdTour() {
    const {
        tourState: { run, stepIndex, steps },
        setTourState
    } = useTourContext();
    const { resolvedTheme } = useTheme();
    const navigate = useNavigate();

    const style =
        resolvedTheme === 'dark'
            ? {
                  options: {
                      arrowColor: BRAND_DARK,
                      backgroundColor: BRAND_DARK,
                      primaryColor: BRAND,
                      textColor: '#EEEEEE'
                  }
              }
            : {
                  options: {
                      arrowColor: '#FFFFFF',
                      backgroundColor: '#FFFFFF',
                      primaryColor: BRAND_DARK,
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
                        setTourState({
                            stepIndex:
                                targetToStepIndexMap[
                                    '#knowledge-center-enter-library'
                                ],
                            target: '#knowledge-center-enter-library'
                        });
                        navigate('/knowledge-center');
                        return;
                    case '#top-content':
                        setTourState({
                            stepIndex:
                                targetToStepIndexMap['#navigate-homepage'],
                            target: '#navigate-homepage'
                        });
                        navigate(-1);
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
        />
    );
}
