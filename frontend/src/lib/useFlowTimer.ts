import { useRef, useEffect } from 'react';
import {
    type AnalyticsEvent,
    type AnalyticsProps,
    captureEvent
} from './analytics';

/**
 * Starts a flow timer and fires a *_started analytics event on mount (or when
 * deps change). Returns a ref holding the start timestamp so callers can pass
 * it to flowTimerSeconds() when firing the matching *_completed event.
 *
 * Pass null for startedEvent to skip the started event (edit flows).
 */
export function useFlowTimer(
    startedEvent: AnalyticsEvent | null,
    props?: AnalyticsProps,
    deps: unknown[] = []
): React.MutableRefObject<number> {
    const startMsRef = useRef(Date.now());
    useEffect(() => {
        startMsRef.current = Date.now();
        if (startedEvent) captureEvent(startedEvent, props);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, deps);
    return startMsRef;
}
