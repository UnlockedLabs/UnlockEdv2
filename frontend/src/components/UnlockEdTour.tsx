import { useEffect } from 'react';
import {
    initialTourState,
    isTourRoute,
    targetToStepIndexMap
} from '@/contexts/tourState';
import { useTourContext } from '@/contexts/useTourContext';
import { consumeFirstLoginTourPending } from '@/contexts/firstLoginTour';
import { useTheme } from 'next-themes';
import Joyride, { CallBackProps, EVENTS } from 'react-joyride';
import { useLocation, useNavigate } from 'react-router-dom';
import { BRAND, BRAND_DARK } from '@/lib/brand';

export default function UnlockEdTour() {
    const {
        tourState: { run, stepIndex, steps, tourActive },
        setTourState
    } = useTourContext();
    const { resolvedTheme } = useTheme();
    const navigate = useNavigate();
    const { pathname } = useLocation();
    const onTourRoute = isTourRoute(pathname);

    // Leaving the tour's own flow ends the tour. Safe to depend on an unstable
    // setTourState: after the first reset both flags are false, so the condition
    // stops firing.
    useEffect(() => {
        if (!onTourRoute && (run || tourActive)) {
            setTourState(initialTourState);
        }
    }, [onTourRoute, run, tourActive, setTourState]);

    // Start the tour for a first login that crossed a hard navigation to get here
    // — see contexts/firstLoginTour.ts.
    //
    // This has to be picked up here, inside the router, and not once at boot in
    // TourProvider: the backend sends every login to `/authcallback`, a loader-only
    // route that redirects onward on the client. A provider above the router mounts
    // there, off any tour route, and never mounts again — so the flag would sit
    // unconsumed while the resident lands on a /home that has all the tour's
    // targets. Keying on `onTourRoute` instead waits for a page the tour can
    // actually run on, however many client-side hops that takes.
    //
    // Idempotent by construction: the flag is cleared as it is read, so
    // StrictMode's double-invoked effect and every later route change are no-ops.
    useEffect(() => {
        if (!onTourRoute) return;
        if (consumeFirstLoginTourPending()) {
            setTourState({ tourActive: true });
        }
    }, [onTourRoute, setTourState]);

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
        // Joyride merges a default step, but a callback can still arrive without
        // one; the tour is over either way and nothing below can be resolved.
        if (!step) {
            setTourState(initialTourState);
            return;
        }
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
                    // An unmapped target used to write `stepIndex: undefined`
                    // into a *controlled* Joyride, which silently drops it out of
                    // controlled mode. Always store a number.
                    const mapped =
                        targetToStepIndexMap[
                            nextTarget as keyof typeof targetToStepIndexMap
                        ];
                    setTourState({
                        stepIndex:
                            typeof mapped === 'number' ? mapped : index + 1,
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
                    case '#popular-content':
                        setTourState({
                            stepIndex:
                                targetToStepIndexMap['#navigate-homepage'],
                            target: '#navigate-homepage'
                        });
                        navigate(-1);
                        return;
                    default: {
                        const mapped =
                            targetToStepIndexMap[
                                prevTarget as keyof typeof targetToStepIndexMap
                            ];
                        setTourState({
                            stepIndex:
                                typeof mapped === 'number'
                                    ? mapped
                                    : Math.max(0, index - 1),
                            target: prevTarget
                        });
                        break;
                    }
                }
            }
        }
    };

    // Never mount Joyride off the tour's own routes — see TOUR_ROUTE_PREFIXES
    // in tourState.ts.
    if (!onTourRoute) {
        return null;
    }

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
