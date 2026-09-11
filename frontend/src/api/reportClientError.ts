import API from '@/api/api';

/**
 * Client-side crash reporting.
 *
 * The app's only error boundary is react-router's `errorElement`, and the page it
 * renders (`pages/Error.tsx`) used to discard the exception — so a resident saw
 * "Something went wrong" while the deployment logs stayed silent. That is what made
 * ID-846 undiagnosable from the Maine logs. Everything here exists to get the
 * exception into `POST /api/client-errors`, which logs it server-side with the
 * resident's user_id and facility_id attached.
 *
 * PRIVACY: only the error's own name/message/stack, the route path, and the user
 * agent are sent. Never form content, and never the query string — `?edit=<id>` and
 * friends are stripped by `routeOf()`.
 */

interface ClientErrorReport {
    name: string;
    message: string;
    stack: string;
    route: string;
    source: string;
    user_agent: string;
}

/**
 * These only keep the request small — the server caps again, at
 * clientErrorStackMax (2048) and clientErrorFieldMax (512) in
 * client_error_handler.go.
 *
 * Both MUST stay above their server counterpart, so the server is the single
 * place that truncates and the only place that marks it. When FIELD_MAX was 500
 * — below the server's 512 — `clamp` silently cut a long message here with no
 * marker and the server's `…(truncated)` never fired, so a truncated message was
 * indistinguishable from a complete one in the log. Marking in both places
 * instead would double-mark, which is why the caps are ordered rather than the
 * marker duplicated.
 */
const STACK_MAX = 4000;
const FIELD_MAX = 1024;

/**
 * One report per distinct error per page session. Without this a boundary that
 * re-renders, or an error thrown in a loop, would hammer the endpoint — and the
 * global handlers below can see the same throw twice.
 */
const alreadyReported = new Set<string>();

function clamp(value: string, max: number): string {
    return value.length > max ? value.slice(0, max) : value;
}

/** Pull name/message/stack off anything that can be thrown, including non-Errors. */
export function describeError(error: unknown): {
    name: string;
    message: string;
    stack: string;
} {
    if (error instanceof Error) {
        return {
            name: error.name,
            message: error.message,
            stack: error.stack ?? ''
        };
    }
    // A router `throw new Response(...)` or a thrown string/object.
    if (error instanceof Response) {
        return {
            name: 'Response',
            message: `${error.status} ${error.statusText}`,
            stack: ''
        };
    }
    if (typeof error === 'string') {
        return { name: 'thrown string', message: error, stack: '' };
    }
    let message: string;
    try {
        message = JSON.stringify(error) ?? String(error);
    } catch {
        message = String(error);
    }
    return { name: 'unknown', message, stack: '' };
}

/** Path only — the query string can carry entry ids, so it is dropped. */
function routeOf(): string {
    try {
        return window.location.pathname;
    } catch {
        return '';
    }
}

/**
 * Report a crash. Fire-and-forget by design: it must never throw, and must never be
 * awaited on a path that is already failing.
 *
 * `source` says which channel caught it — `errorElement`, `window.onerror`,
 * `unhandledrejection`, or a named call site.
 */
export function reportClientError(error: unknown, source: string): void {
    try {
        const { name, message, stack } = describeError(error);
        const route = routeOf();
        const key = `${source}|${name}|${message}|${route}`;
        if (alreadyReported.has(key)) return;
        alreadyReported.add(key);

        // Local visibility first: this is what a repro run reads, and it happens
        // even if the POST never lands (an unauthenticated or password_reset
        // session cannot report). The one deliberate exception to the project's
        // no-console rule: this is the diagnostic channel, so it has to print.
        // eslint-disable-next-line no-console
        console.error(
            `[client-error] ${source} at ${route}: ${name}: ${message}`,
            error
        );

        const report: ClientErrorReport = {
            name: clamp(name, FIELD_MAX),
            message: clamp(message, FIELD_MAX),
            stack: clamp(stack, STACK_MAX),
            route: clamp(route, FIELD_MAX),
            source: clamp(source, FIELD_MAX),
            user_agent: clamp(navigator.userAgent ?? '', FIELD_MAX)
        };
        // API.post resolves rather than throwing on any status, so nothing here can
        // turn a report into a second failure.
        void API.post<null, ClientErrorReport>('client-errors', report);
    } catch {
        /* reporting must never be the thing that breaks the page */
    }
}

/**
 * Catch what the error boundary cannot see: throws outside React's tree and
 * un-`catch`ed promise rejections (the LR entry page's hydrate effect being the one
 * that matters — it strands the page on "Loading your editor…" with no trace).
 */
export function installGlobalErrorReporting(): void {
    window.addEventListener('error', (event: ErrorEvent) => {
        reportClientError(event.error ?? event.message, 'window.onerror');
    });
    window.addEventListener(
        'unhandledrejection',
        (event: PromiseRejectionEvent) => {
            reportClientError(event.reason, 'unhandledrejection');
        }
    );
}
