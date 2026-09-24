/**
 * `sessionStorage` that cannot throw.
 *
 * When a browser is configured to block site data for the origin, touching
 * `window.sessionStorage` throws `SecurityError` — it does not return null and
 * it does not return a dead-but-usable store. That matters here because
 * UnlockEd runs on managed facility devices, where a locked-down browser policy
 * is ordinary rather than exotic.
 *
 * The failure this exists to prevent: `tabSession.hasLocalSession()` is called
 * from `checkExistingFlow`, which is a react-router *loader* (auth/useAuth.ts).
 * A throw inside a loader goes straight to the route's `errorElement`, so the
 * login page never mounts at all — the resident sees the generic error page with
 * no form and no way forward, and unlike ID-846's crash a refresh does not help.
 *
 * Note what does NOT work as a guard:
 *
 *     if (typeof sessionStorage === 'undefined') return;   // still throws
 *
 * `typeof` only suppresses `ReferenceError` for an *undeclared identifier*. When
 * the identifier resolves to a property whose getter throws, `typeof` invokes
 * that getter and throws right along with it. Several call sites read as guarded
 * but were not, which is why every access now goes through here instead.
 *
 * Reads return null and writes are dropped when storage is unavailable. For
 * most callers "nothing stored" is a valid state, so the feature quietly does
 * less and nothing breaks. The tab-session flag is the exception: without it no
 * tab can ever hold a session. So /login calls isSessionStorageAvailable() up
 * front and tells the resident why they can't sign in, instead of letting them
 * submit credentials that can never stick (EN-80).
 */

const PROBE_KEY = '__unlocked_storage_probe__';

/**
 * Whether this tab can store a value in sessionStorage and read it back. It
 * writes and removes a probe key, because that round trip is what the
 * tab-session flag depends on. Checking that the property exists is not enough.
 */
export function isSessionStorageAvailable(): boolean {
    try {
        sessionStorage.setItem(PROBE_KEY, PROBE_KEY);
        const readBack = sessionStorage.getItem(PROBE_KEY);
        sessionStorage.removeItem(PROBE_KEY);
        return readBack === PROBE_KEY;
    } catch {
        return false;
    }
}

export function getSessionItem(key: string): string | null {
    try {
        return sessionStorage.getItem(key);
    } catch {
        return null;
    }
}

export function setSessionItem(key: string, value: string): void {
    try {
        sessionStorage.setItem(key, value);
    } catch {
        // Blocked, or over quota in private-mode Safari. Nothing to do: the
        // caller's state stays in memory for this page session.
    }
}

export function removeSessionItem(key: string): void {
    try {
        sessionStorage.removeItem(key);
    } catch {
        /* nothing stored means nothing to remove */
    }
}
