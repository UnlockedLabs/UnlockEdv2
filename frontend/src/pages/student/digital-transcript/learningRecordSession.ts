import { ANALYTICS_EVENTS, captureEvent } from '@/lib/events';
import {
    LEARNING_RECORD_SESSION_VERSION,
    getDigitalTranscriptStorageKeys
} from '@/types/digital-transcript';

/**
 * Session-scoped tracking for the Learning Record form (ID-830 follow-up).
 *
 * Why this is a module and not part of `LearningRecordTracker`: the tracker lives
 * in a ref inside `DigitalTranscriptWysiwygEntry`, and every list <-> entry
 * navigation is a route change that unmounts that component. A session that must
 * span a whole sitting therefore cannot live inside it — it was previously
 * re-based on every mount, so one sitting emitted several partial
 * `lr_session_ended` events, `entry_index_in_session` restarted at 1 on each
 * visit, and `seconds_since_session_start` measured from the mount rather than
 * from the sitting. Module scope fixes all three at once.
 *
 * A **session** is one sitting's worth of form visits: it opens when the form
 * first mounts, survives the gap while the resident is on the list page, and ends
 * when they leave for good (`pagehide`), when the resume window lapses, or when a
 * later visit recovers a session a reload interrupted.
 *
 * PRIVACY — same contract as `learningRecordAnalytics.ts`: every property here is
 * a count, a duration in whole seconds, or a fixed enum. Deliberately no session
 * id; the stitching happens here, so no correlation key needs to reach PostHog.
 */

/** Why the session ended. Fixed enum — do not let this become free text. */
type EndedReason = 'navigated_away' | 'page_hidden' | 'recovered';

/**
 * How long a session survives with the form closed before it is treated as over.
 * Matches PostHog's own 30-minute inactivity boundary so the app's notion of a
 * session and PostHog's do not diverge. Doubles as the recovery grace period.
 */
const SESSION_IDLE_MS = 30 * 60 * 1000;

/**
 * How long a silent-but-focused form keeps accruing active time.
 *
 * Deliberately generous. A resident staring at a reflection question for ninety
 * seconds is doing the work, and `lr_question_left.duration_seconds` already runs
 * keystroke-to-last-keystroke and so already discards think time — if this cutoff
 * were also short, nothing in the dataset would show hesitation, which is the
 * friction signal these events exist to surface. Five minutes still caps the
 * pathological case: a form left open on a focused, unattended screen, where
 * `visibilitychange` never fires.
 */
const ACTIVE_IDLE_MS = 5 * 60 * 1000;

const PERSIST_DEBOUNCE_MS = 2000;

/** Scroll does not bubble, so activity listeners run in the capture phase. */
const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'scroll'] as const;

interface SessionState {
    startedMs: number;
    /** 0 until the form has been left at least once. */
    lastFormCloseMs: number;
    lastActivityMs: number;
    activeMs: number;
    /** Start of the open active run, or null when time is not accruing. */
    activeRunOpenMs: number | null;
    entriesStarted: number;
    entriesCompleted: number;
    formVisits: number;
}

let state: SessionState | null = null;
/** Mounted editors. Guards against a stray double `leaveForm`. */
let mountCount = 0;
let resumeTimer: number | null = null;
let persistTimer: number | null = null;
let listenersAttached = false;
/** Registered once and never removed — see `handlePageShow`. */
let pageShowAttached = false;

/**
 * Whole seconds between two stamps. `flowTimerSeconds` only measures to *now*,
 * which is wrong for a session that ended when the form closed rather than when
 * the resume window later lapsed.
 */
function spanSeconds(fromMs: number, toMs: number): number {
    return Math.max(0, Math.round((toMs - fromMs) / 1000));
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function numField(source: Record<string, unknown>, key: string): number {
    const raw = source[key];
    return typeof raw === 'number' && Number.isFinite(raw) ? raw : 0;
}

/**
 * The session record lives in **`sessionStorage`**, unlike every other
 * `unlockEd_digital_transcript_*` key, which uses `localStorage`.
 *
 * That is deliberate, and the difference is the point. Draft content *should*
 * follow a resident across tabs; a clock must not. `localStorage` is shared per
 * profile, so a second tab opening the form would read the first tab's record,
 * resume it, and both documents would then emit on their own exit — overlapping,
 * double-counted sittings. `sessionStorage` is per tab, which makes each tab its
 * own sitting.
 *
 * It costs nothing that matters: `sessionStorage` survives a reload in the same
 * tab, which is the case reload recovery exists for. What it gives up is
 * recovering a sitting after a browser crash into a *fresh* tab — an acceptable
 * trade against silently double counting.
 */
function storageKey(): string {
    return getDigitalTranscriptStorageKeys().session;
}

function persistNow(): void {
    if (!state || typeof sessionStorage === 'undefined') return;
    try {
        sessionStorage.setItem(
            storageKey(),
            JSON.stringify({
                version: LEARNING_RECORD_SESSION_VERSION,
                ...state
            })
        );
    } catch {
        // Quota, or private-mode Safari. The session degrades to in-memory only:
        // it still emits, it just cannot survive a reload.
    }
}

function persistSoon(): void {
    if (typeof window === 'undefined') return;
    if (persistTimer !== null) return;
    persistTimer = window.setTimeout(() => {
        persistTimer = null;
        persistNow();
    }, PERSIST_DEBOUNCE_MS);
}

function clearPersistTimer(): void {
    if (persistTimer === null || typeof window === 'undefined') return;
    window.clearTimeout(persistTimer);
    persistTimer = null;
}

function clearPersisted(): void {
    if (typeof sessionStorage === 'undefined') return;
    try {
        sessionStorage.removeItem(storageKey());
    } catch {
        /* noop */
    }
}

/** Version-gated, field-coerced read — same discipline as the entry session. */
function readPersisted(): SessionState | null {
    if (typeof sessionStorage === 'undefined') return null;
    try {
        const raw = sessionStorage.getItem(storageKey());
        if (!raw) return null;
        const parsed: unknown = JSON.parse(raw);
        if (!isRecord(parsed)) return null;
        if (parsed.version !== LEARNING_RECORD_SESSION_VERSION) return null;
        const startedMs = numField(parsed, 'startedMs');
        if (startedMs <= 0) return null;
        return {
            startedMs,
            lastFormCloseMs: numField(parsed, 'lastFormCloseMs'),
            lastActivityMs: numField(parsed, 'lastActivityMs') || startedMs,
            activeMs: numField(parsed, 'activeMs'),
            // Never resume an open run across a reload — the stamp predates the
            // gap, so charging it would bill time the resident spent elsewhere.
            activeRunOpenMs: null,
            entriesStarted: numField(parsed, 'entriesStarted'),
            entriesCompleted: numField(parsed, 'entriesCompleted'),
            formVisits: numField(parsed, 'formVisits')
        };
    } catch {
        return null;
    }
}

function openActiveRun(): void {
    if (!state) return;
    if (state.activeRunOpenMs !== null) return;
    if (typeof document !== 'undefined' && document.hidden) return;
    state.activeRunOpenMs = Date.now();
}

/**
 * Bank the open run. A run that died of idleness stops accruing at the cutoff,
 * not at now, so walking away mid-entry does not inflate `active_seconds`.
 */
function closeActiveRun(): void {
    if (!state) return;
    if (state.activeRunOpenMs === null) return;
    const end = Math.min(Date.now(), state.lastActivityMs + ACTIVE_IDLE_MS);
    state.activeMs += Math.max(0, end - state.activeRunOpenMs);
    state.activeRunOpenMs = null;
}

function clearResumeTimer(): void {
    if (resumeTimer === null || typeof window === 'undefined') return;
    window.clearTimeout(resumeTimer);
    resumeTimer = null;
}

function armResumeTimer(): void {
    if (typeof window === 'undefined') return;
    clearResumeTimer();
    resumeTimer = window.setTimeout(() => {
        resumeTimer = null;
        endSession('navigated_away');
    }, SESSION_IDLE_MS);
}

function handleVisibilityChange(): void {
    if (!state) return;
    if (document.hidden) {
        closeActiveRun();
        persistNow();
        return;
    }
    if (mountCount > 0) {
        // Re-base activity so the hidden stretch is not also charged as idle.
        state.lastActivityMs = Date.now();
        openActiveRun();
    }
}

function handlePageHide(): void {
    endSession('page_hidden');
}

/**
 * Restart after a bfcache restore.
 *
 * `pagehide` has to report — the page may never come back, and a frozen page's
 * timers are frozen with it, so waiting for the resume window would lose the
 * event. But when the page *does* come back, the editor never remounted, so
 * `enterForm` will not be called again. Without this, every achievement the
 * resident goes on to save is unattributed and no further session is ever
 * reported.
 *
 * The restored page is a new sitting rather than a continuation: the previous one
 * was already emitted and its clock stopped at the freeze. The guards make this a
 * no-op on an ordinary load, where `mountCount` is still 0.
 */
function handlePageShow(): void {
    if (mountCount === 0 || state) return;
    state = freshState();
    state.formVisits = 1;
    openActiveRun();
    attachListeners();
    persistSoon();
}

/**
 * Listeners belong to the session, not to a component. The previous
 * implementation registered `pagehide` inside the editor's effect, so it was
 * removed the moment the editor unmounted — a resident who returned to the list
 * and *then* closed the tab would produce no event at all now that leaving the
 * form no longer emits.
 */
function attachListeners(): void {
    if (typeof document === 'undefined') return;
    // Outlives the session on purpose: it is what notices a bfcache restore
    // after `endSession` has already torn everything else down.
    if (!pageShowAttached) {
        pageShowAttached = true;
        window.addEventListener('pageshow', handlePageShow);
    }
    if (listenersAttached) return;
    listenersAttached = true;
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handlePageHide);
    for (const type of ACTIVITY_EVENTS) {
        document.addEventListener(type, noteActivity, {
            passive: true,
            capture: true
        });
    }
}

function detachListeners(): void {
    if (!listenersAttached || typeof document === 'undefined') return;
    listenersAttached = false;
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    window.removeEventListener('pagehide', handlePageHide);
    for (const type of ACTIVITY_EVENTS) {
        document.removeEventListener(type, noteActivity, { capture: true });
    }
}

function freshState(): SessionState {
    const now = Date.now();
    return {
        startedMs: now,
        lastFormCloseMs: 0,
        lastActivityMs: now,
        activeMs: 0,
        activeRunOpenMs: null,
        entriesStarted: 0,
        entriesCompleted: 0,
        formVisits: 0
    };
}

/**
 * Resume a stored session, or report it and start clean.
 *
 * Runs before `mountCount` is incremented, so a recovered session is stamped
 * with its own stored close time rather than with now.
 */
function resumeOrStart(): void {
    const stored = readPersisted();
    if (!stored) {
        state = freshState();
        return;
    }
    const referenceMs = stored.lastFormCloseMs || stored.lastActivityMs;
    if (Date.now() - referenceMs < SESSION_IDLE_MS) {
        state = stored;
        return;
    }
    // Older than the window: a reload or crash orphaned it. Report it rather
    // than dropping it, then begin a genuinely new session.
    state = stored;
    endSession('recovered');
    state = freshState();
}

/** Called when the form mounts. Opens or resumes the sitting. */
export function enterForm(): void {
    clearResumeTimer();
    if (!state) resumeOrStart();
    mountCount += 1;
    if (!state) return;
    state.formVisits += 1;
    state.lastActivityMs = Date.now();
    openActiveRun();
    attachListeners();
    persistSoon();
}

/**
 * Called when the form unmounts — every list <-> entry navigation, Finish
 * included, plus `isFunnel` flipping and StrictMode's discarded first mount.
 *
 * Deliberately does **not** emit. Active time stops accruing here, which is what
 * keeps the measure form-only, and the resume timer decides later whether the
 * sitting is actually over.
 */
export function leaveForm(): void {
    // Already closed. Without this guard a second call re-stamps
    // `lastFormCloseMs` to now and re-arms the resume window, inflating
    // `duration_seconds` by however long the resident had been away.
    if (mountCount === 0) return;
    mountCount -= 1;
    if (mountCount > 0 || !state) return;
    closeActiveRun();
    state.lastFormCloseMs = Date.now();
    clearPersistTimer();
    persistNow();
    armResumeTimer();
}

/** Any resident interaction. Reopens accrual if the idle cutoff closed it. */
export function noteActivity(): void {
    if (!state) return;
    const now = Date.now();
    const idleFor = now - state.lastActivityMs;
    if (state.activeRunOpenMs !== null && idleFor > ACTIVE_IDLE_MS) {
        // Bank the run capped at the cutoff, then start a new one from now, so
        // the dead stretch in between is charged to neither.
        closeActiveRun();
        state.lastActivityMs = now;
        openActiveRun();
        persistSoon();
        return;
    }
    state.lastActivityMs = now;
    if (state.activeRunOpenMs === null && mountCount > 0) openActiveRun();
    persistSoon();
}

/** Start of the sitting, for `seconds_since_session_start`. */
export function sessionStartMs(): number {
    return state?.startedMs ?? Date.now();
}

/**
 * An entry was opened for editing. Returns its index **within the sitting**, so
 * the count no longer restarts when the resident goes back to the list.
 */
export function noteEntryStarted(): number {
    if (!state) return 1;
    state.entriesStarted += 1;
    persistSoon();
    return state.entriesCompleted + 1;
}

/** An entry was saved. */
export function noteEntryCompleted(): void {
    if (!state) return;
    state.entriesCompleted += 1;
    persistSoon();
}

/**
 * Emit `lr_session_ended` and tear the session down. Nulling `state` first is
 * the one-shot: `pagehide` and the resume timer can both fire, and only the
 * first does anything.
 */
export function endSession(reason: EndedReason): void {
    if (!state) return;
    const finished = state;
    // Mounted means the resident is still in the form (a live `pagehide`), so
    // now is the close. Otherwise use the recorded close, falling back to last
    // activity for a session that was orphaned while open.
    const closedMs =
        mountCount > 0
            ? Date.now()
            : finished.lastFormCloseMs || finished.lastActivityMs;
    closeActiveRun();
    state = null;
    clearResumeTimer();
    clearPersistTimer();
    detachListeners();
    clearPersisted();
    captureEvent(ANALYTICS_EVENTS.LrSessionEnded, {
        duration_seconds: spanSeconds(finished.startedMs, closedMs),
        active_seconds: Math.round(finished.activeMs / 1000),
        entries_started: finished.entriesStarted,
        entries_completed: finished.entriesCompleted,
        form_visits: finished.formVisits,
        ended_reason: reason
    });
}
