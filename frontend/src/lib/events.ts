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
    // Learning Record form behavior (ID-806). Question-level timing and
    // interaction rates. Properties are counts and enums only — never answer
    // content — because the resident consent language promises anonymized
    // aggregate data. See learningRecordAnalytics.ts for the single mapper.
    LrEntryStarted: 'lr_entry_started',
    LrQuestionLeft: 'lr_question_left',
    LrStepCompleted: 'lr_step_completed',
    LrEntryCompleted: 'lr_entry_completed',
    // Errors & friction
    ApiError: 'api_error'
} as const;

export type AnalyticsEvent =
    (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS];

type AnalyticsValue = string | number | boolean | null | undefined;
export type AnalyticsProps = Record<string, AnalyticsValue>;

/**
 * Which deployment these events came from. Registered as super properties so
 * they ride on *every* event, including autocaptured `$pageview`/`$exception` —
 * without them, staging traffic and real facility traffic are indistinguishable
 * in the pilot dashboard (both serve from real hostnames, so PostHog's built-in
 * localhost/127.0.0.1 internal-user tagging doesn't separate them).
 */
function deploymentProps(): AnalyticsProps {
    return {
        deployment: import.meta.env.VITE_DEPLOYMENT,
        state: stateTag()
    };
}

/** Deployment identity, or `unknown` if a deployment shipped without one. */
function stateTag(): string {
    return import.meta.env.VITE_STATE || 'unknown';
}

/**
 * Namespace a user id to its deployment for use as PostHog's `distinct_id`.
 *
 * `user.id` is a per-database autoincrement, so it is unique within a deployment
 * and *not* across them. With only staging reporting there was one id space and
 * the bare id was safe; now that every state deployment reports, user 1 at
 * stlouis and user 1 at maine would otherwise resolve to a single PostHog person.
 * That would make person properties (`role`, `facility_id`, `features`)
 * last-write-wins between facilities, and would undercount weekly-active-users —
 * the pilot's headline metric — by collapsing distinct people into one.
 */
function analyticsDistinctId(userId: number): string {
    return `${stateTag()}:${userId}`;
}

/**
 * Initialize PostHog, or deliberately don't. Never throws.
 *
 * Analytics is enabled only when the key looks like a real PostHog project key
 * (they are always `phc_`-prefixed) AND a deployment is named. That single rule:
 *   - rejects the CI `placeholder_for_other_deployments` value used by builds
 *     that shouldn't report,
 *   - rejects the `.env.example` sample value,
 *   - fails closed on forks, where the repo secret resolves to an empty string,
 *   - and keeps a developer who pastes a real key into `.env` from silently
 *     sending until they also set VITE_DEPLOYMENT, at which point their events
 *     are tagged and filterable rather than anonymous noise.
 */
export function initAnalytics(): void {
    try {
        const key = import.meta.env.VITE_PUBLIC_POSTHOG_KEY;
        if (!key?.startsWith('phc_') || !import.meta.env.VITE_DEPLOYMENT) {
            return;
        }
        posthog.init(key, {
            api_host: import.meta.env.VITE_PUBLIC_POSTHOG_HOST,
            defaults: '2026-01-30',
            capture_exceptions: true,
            // Autocapture stays on for the ambient click signal, but its element
            // text is stripped. Unmasked, `$el_text` sends the text of whatever
            // was clicked — on resident-facing screens that means names rendered
            // in tables and links. No insight consumes autocapture text, so this
            // costs nothing.
            mask_all_text: true
        });
        posthog.register(deploymentProps());
    } catch {
        // Missing/invalid config — the app runs without analytics.
    }
}

/**
 * Split a request path into analytics-safe props.
 *
 * `url` drops the query string: it carried resident search terms into PostHog,
 * and it fragmented the "errors by endpoint" breakdown into one row per typed
 * character. `endpoint` additionally collapses ids so the breakdown groups by
 * route rather than by resource.
 *
 * Both call sites are normalized to the same absolute shape — `api.ts` passes
 * paths relative to `/api/` while SWR keys are already absolute — so one
 * breakdown covers every failure in the app.
 */
export function analyticsUrl(rawUrl: string): AnalyticsProps {
    const path = rawUrl.split('?')[0].split('#')[0];
    const url = path.startsWith('/') ? path : `/api/${path}`;
    const endpoint = url
        .split('/')
        .map((segment) =>
            /^\d+$/.test(segment) ||
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
                segment
            )
                ? ':id'
                : segment
        )
        .join('/');
    return { url, endpoint };
}

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
 * Sends id/role/facility/features only — no names, usernames or emails — to keep
 * staff PII out of PostHog in the corrections context. `features` is the sorted
 * comma-joined feature_access list rather than a raw array so PostHog breakdowns
 * on it are usable; it lets pilot metrics be segmented by which flags a facility
 * actually has enabled.
 *
 * The identity is deployment-namespaced — see `analyticsDistinctId`.
 */
export function identifyUser(
    user: Pick<User, 'id' | 'role' | 'facility_id' | 'feature_access'>
): void {
    try {
        posthog.identify(analyticsDistinctId(user.id), {
            role: user.role,
            facility_id: user.facility_id,
            features: [...(user.feature_access ?? [])].sort().join(',')
        });
        // Also register facility as a super property. As a person property alone
        // it is invisible to event-property filters (the pilot dashboard's
        // facility filter silently matches nothing) and it is last-write-wins,
        // so an admin switching facilities retroactively re-attributes their
        // whole history. On the event, it records where the action happened.
        posthog.register({ facility_id: user.facility_id });
    } catch {
        /* noop */
    }
}

/**
 * Clear the identified user. Critical for shared facility workstations so the
 * next staff member isn't attributed to the previous one.
 *
 * `reset()` also clears registered super properties, so the deployment tags are
 * re-registered immediately — otherwise every event after the first logout would
 * be missing `deployment`/`state` until the page reloaded.
 */
export function resetAnalytics(): void {
    try {
        posthog.reset();
        posthog.register(deploymentProps());
    } catch {
        /* noop */
    }
}

/** Whole-second elapsed time since `startMs`, for *_completed duration props. */
export function flowTimerSeconds(startMs: number): number {
    return Math.max(0, Math.round((Date.now() - startMs) / 1000));
}
