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
 *
 * Pass enabled=false to defer the started event until the flow is actually
 * actionable (e.g. after data loads and validity guards pass); it fires once
 * enabled flips true, so bad-route/error/unscheduled renders aren't counted.
 */
export function useFlowTimer(
    startedEvent: AnalyticsEvent | null,
    props?: AnalyticsProps,
    deps: unknown[] = [],
    enabled = true
): React.MutableRefObject<number> {
    const startMsRef = useRef(Date.now());
    useEffect(() => {
        if (!enabled) return;
        startMsRef.current = Date.now();
        if (startedEvent) captureEvent(startedEvent, props);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [...deps, enabled]);
    return startMsRef;
}
