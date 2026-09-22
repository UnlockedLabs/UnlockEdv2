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
 * Reads return null and writes are dropped when storage is unavailable. Every
 * caller already treats "nothing stored" as a valid state, so degrading to
 * in-memory-only is the correct behaviour: the feature quietly does less, and
 * nothing breaks.
 */

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
