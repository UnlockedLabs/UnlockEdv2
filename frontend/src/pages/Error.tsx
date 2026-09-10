import { useEffect, useRef } from 'react';
import { Link, useRouteError } from 'react-router-dom';
import { ErrorType } from '@/types';
import { describeError, reportClientError } from '@/api/reportClientError';

/**
 * The app's only error page. It renders two ways:
 *   - as a route `errorElement`, where react-router hands it whatever was thrown
 *     during render, in an effect, or by a loader;
 *   - as a plain element with a `type`, for /404 and /unauthorized.
 *
 * It used to ignore `useRouteError()` entirely, so the exception died here and the
 * deployment logs showed nothing — the reason ID-846 could not be diagnosed from
 * Maine's logs. It now logs and reports the error, and shows the resident a
 * reference they can quote when they report it.
 */
export default function Error({
    type,
    back
}: {
    type?: ErrorType;
    back?: boolean;
}) {
    // Safe for the prop-driven uses too: every <Error /> in this app is a route
    // element inside the data router, and this returns undefined when the route is
    // not currently an error boundary.
    const routeError: unknown = useRouteError();
    // An errorElement can re-render; the report itself is also deduped, but this
    // keeps the effect honest about firing once per mount.
    const reportedRef = useRef(false);

    useEffect(() => {
        if (!routeError || reportedRef.current) return;
        reportedRef.current = true;
        reportClientError(routeError, 'errorElement');
    }, [routeError]);

    const getMessage = () => {
        switch (type) {
            case 'not-found':
                return { title: '404', description: 'Page not found' };
            case 'unauthorized':
                return {
                    title: '403',
                    description: 'You are not authorized to view this page'
                };
            default:
                return {
                    title: 'Error',
                    description: 'Something went wrong'
                };
        }
    };

    const { title, description } = getMessage();
    // Shown only for a real crash, and only enough for staff to match the page a
    // resident saw to a log line. The message itself stays out of the UI.
    const reference = routeError
        ? new Date().toISOString().replace(/\.\d+Z$/, 'Z')
        : null;

    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
            <h1 className="text-4xl font-bold">{title}</h1>
            <p className="text-muted-foreground">{description}</p>
            {reference ? (
                <p
                    className="text-xs text-muted-foreground"
                    data-slot="error-reference"
                >
                    Reference: {reference}
                </p>
            ) : null}
            {import.meta.env.DEV && routeError ? (
                <pre className="max-w-2xl overflow-x-auto whitespace-pre-wrap text-xs text-destructive">
                    {describeError(routeError).name}:{' '}
                    {describeError(routeError).message}
                </pre>
            ) : null}
            {back ? (
                <button
                    onClick={() => window.history.back()}
                    className="text-primary underline"
                >
                    Go back
                </button>
            ) : (
                <Link to="/" className="text-primary underline">
                    Return home
                </Link>
            )}
        </div>
    );
}
