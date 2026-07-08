import posthog from 'posthog-js';
import type { User } from '@/types';

/**
 * Central analytics layer for PostHog custom events.
 *
 * Import this module rather than calling `posthog.capture` directly so event
 * names stay typed/stable for PostHog insights and so a missing/blocked
 * analytics client can never break a user flow.
 */
export const ANALYTICS_EVENTS = {
    // Time & Efficiency
    AttendanceSessionStarted: 'attendance_session_started',
    AttendanceSessionCompleted: 'attendance_session_completed',
    ProgramCreationStarted: 'program_creation_started',
    ProgramCreationCompleted: 'program_creation_completed',
    ClassCreationStarted: 'class_creation_started',
    ClassCreationCompleted: 'class_creation_completed',
    // Enrollment funnel
    EnrollModalOpened: 'enroll_modal_opened',
    EnrollResidentsSelected: 'enroll_residents_selected',
    EnrollCompleted: 'enroll_completed',
    // Errors & friction
    ApiError: 'api_error'
} as const;

export type AnalyticsEvent =
    (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS];

type AnalyticsValue = string | number | boolean | null | undefined;
export type AnalyticsProps = Record<string, AnalyticsValue>;

/** Fire a custom event. Never throws. */
export function captureEvent(
    event: AnalyticsEvent,
    props?: AnalyticsProps
): void {
    try {
        posthog.capture(event, props);
    } catch {
        // Analytics must never interrupt a user flow.
    }
}

/**
 * Tie subsequent events to a stable per-user identity so login frequency,
 * weekly-active-users and new-user metrics attribute correctly.
 *
 * Sends id/role/facility only — no names, usernames or emails — to keep staff
 * PII out of PostHog in the corrections context.
 */
export function identifyUser(
    user: Pick<User, 'id' | 'role' | 'facility_id'>
): void {
    try {
        posthog.identify(String(user.id), {
            role: user.role,
            facility_id: user.facility_id
        });
    } catch {
        /* noop */
    }
}

/**
 * Clear the identified user. Critical for shared facility workstations so the
 * next staff member isn't attributed to the previous one.
 */
export function resetAnalytics(): void {
    try {
        posthog.reset();
    } catch {
        /* noop */
    }
}

/** Whole-second elapsed time since `startMs`, for *_completed duration props. */
export function flowTimerSeconds(startMs: number): number {
    return Math.max(0, Math.round((Date.now() - startMs) / 1000));
}
