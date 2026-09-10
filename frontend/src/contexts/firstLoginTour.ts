/**
 * The first-login tour flag, carried across a hard navigation.
 *
 * `tourActive` lives in `TourProvider`, mounted *above* `RouterProvider` in
 * `main.tsx`. That means it survives every client-side navigation and only a page
 * load clears it — the carrier behind ID-846. Both first-login hops are hard
 * navigations now (`ChangePasswordForm` since 8faf7977, `LoginForm` as of this
 * change), which retires that whole class of stale state.
 *
 * It also means `setTourState({ tourActive: true })` at login time is wiped before
 * the resident ever reaches `/home` — which is why the product tour has been
 * silently dead for every resident whose first login goes through a password reset.
 * This flag is what survives the hop instead.
 *
 * `sessionStorage` is the right store: it survives a reload, is scoped to the one
 * tab that logged in, and is discarded when that tab closes. `UnlockEdTour` consumes
 * the flag on the first route the tour can actually run on, so it crosses
 * `login` -> `reset-password` -> `/authcallback` -> `/home` — two hard navigations
 * and a client-side hop — and starts the tour exactly once.
 *
 * Every access is guarded — `sessionStorage` throws outright when a browser is set
 * to block site data, and a dead tour must never break a login.
 */
const FIRST_LOGIN_TOUR_KEY = 'first_login_tour_pending';

/** Called at login when the backend reports `first_login`. */
export function markFirstLoginTourPending(): void {
    try {
        sessionStorage.setItem(FIRST_LOGIN_TOUR_KEY, 'true');
    } catch {
        // No session storage: the resident just doesn't get the tour.
    }
}

/**
 * Reads and clears the flag. Returns true at most once per login — callers may
 * invoke it more than once (React StrictMode double-invokes mount effects), so it
 * must be safe to call repeatedly and only the first call may report pending.
 */
export function consumeFirstLoginTourPending(): boolean {
    try {
        if (sessionStorage.getItem(FIRST_LOGIN_TOUR_KEY) !== 'true') {
            return false;
        }
        sessionStorage.removeItem(FIRST_LOGIN_TOUR_KEY);
        return true;
    } catch {
        return false;
    }
}
