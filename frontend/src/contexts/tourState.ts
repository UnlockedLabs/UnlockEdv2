import { Step } from 'react-joyride';

export const targetToStepIndexMap = {
    '#resident-home': 0,
    '#visit-knowledge-center': 1,
    '#knowledge-center-landing': 2,
    '#knowledge-center-tabs': 3,
    '#knowledge-center-search': 4,
    '#knowledge-center-filters': 5,
    '#knowledge-center-search-lib': 6,
    '#knowledge-center-fav-lib': 7,
    '#knowledge-center-enter-library': 8,
    '#library-viewer-sub-page': 9,
    '#library-viewer-favorite': 10,
    '#navigate-homepage': 11,
    '#top-content': 12,
    '#popular-content': 13,
    '#end-tour': 14
};

export interface TourState {
    run: boolean;
    stepIndex: number;
    steps: Step[];
    tourActive: boolean;
    target: string;
}

export const initialTourState: TourState = {
    run: false,
    stepIndex: 0,
    steps: [
        {
            target: '#resident-home',
            content:
                "Welcome to UnlockEd, a place for you to access and explore educational content. Let's take a quick tour to show you how things work.",
            disableBeacon: true,
            showSkipButton: true,
            placement: 'center',
            showProgress: true
        },
        {
            target: '#visit-knowledge-center',
            content:
                'Click on Knowledge Center to access a variety of resources. Try it now!',
            disableOverlayClose: true,
            disableBeacon: true,
            spotlightClicks: true,
            hideCloseButton: true,
            hideFooter: true
        },
        {
            target: '#knowledge-center-landing',
            content:
                'Welcome to the Knowledge Center. Here, you can find a range of resources in both written and video format, as well as helpful links.',
            disableBeacon: true,
            disableOverlayClose: true,
            placement: 'center',
            showProgress: true
        },
        {
            target: '#knowledge-center-tabs',
            content:
                'Use these tabs to switch between different types of resources.',
            disableBeacon: true,
            disableOverlayClose: true,
            showProgress: true
        },
        {
            target: '#knowledge-center-search',
            content:
                'To find something specific, you could type in a word or a title into the search bar.',
            disableBeacon: true,
            disableOverlayClose: true,
            showProgress: true
        },
        {
            target: '#knowledge-center-filters',
            content:
                'Too many results? You could use filters to see content by category.',
            disableBeacon: true,
            spotlightClicks: true,
            disableOverlayClose: true,
            placement: 'left',
            showProgress: true
        },
        {
            target: '#knowledge-center-search-lib',
            content:
                "If you'd like to search within a specific library, you could use the magnifying glass.",
            disableBeacon: true,
            disableOverlayClose: true,
            showProgress: true
        },
        {
            target: '#knowledge-center-fav-lib',
            content:
                'The star allows you to favorite the library for easy access later. Try favoriting a library to save it for later!',
            disableBeacon: true,
            spotlightClicks: true,
            disableOverlayClose: true,
            showProgress: true
        },
        {
            target: '#knowledge-center-enter-library',
            content:
                "Click on a library to open it and see what's inside. Try it now!",
            disableBeacon: true,
            spotlightClicks: true,
            hideFooter: true
        },
        {
            target: '#library-viewer-sub-page',
            content: 'Here, you can see everything inside the library.',
            disableBeacon: true,
            disableOverlayClose: true,
            placement: 'center',
            showProgress: true
        },
        {
            target: '#library-viewer-favorite',
            content:
                "If you're liking a page and want to return to it later, you could favorite it by giving it a name. Try it now!",
            disableBeacon: true,
            spotlightClicks: true,
            disableOverlayClose: true,
            showProgress: true
        },
        {
            target: '#navigate-homepage',
            content:
                'You can always return to the homepage by clicking Home. Try it now!',
            disableBeacon: true,
            disableOverlayClose: true,
            spotlightClicks: true,
            hideFooter: true,
            placement: 'right',
            disableScrolling: true
        },
        {
            target: '#top-content',
            content:
                'Your top content shows the libraries and videos you visit the most.',
            disableBeacon: true,
            disableOverlayClose: true,
            placement: 'top',
            showProgress: true
        },
        {
            target: '#popular-content',
            content:
                'Find new content to explore based on what others in your facility are using!',
            disableBeacon: true,
            disableOverlayClose: true,
            placement: 'top',
            showProgress: true
        },
        {
            target: '#end-tour',
            content:
                'That\'s it! You\'re now ready to use UnlockEd. If you need help, revisit this tour anytime by clicking "Get Help".',
            disableBeacon: true,
            disableOverlayClose: true,
            placement: 'center'
        }
    ],
    tourActive: false,
    target: ''
};

/**
 * The routes this tour's steps live on — every target in `initialTourState` is on
 * the resident homepage, the Knowledge Center, or a library viewer page.
 *
 * Off these routes the tour must not render at all (ID-846). react-joyride 2.9.3
 * mounts its floater's Popper against the current step's target inside a layout
 * effect and dereferences it with no null check
 * (Popper -> getReferenceOffsets -> getBoundingClientRect), so a running tour on a
 * page that has no such element throws
 * `TypeError: Cannot read properties of null (reading 'nodeName')` from
 * `componentDidMount`. React hands that to the nearest error boundary — the
 * router's root `errorElement` — so the entire shell is replaced by the generic
 * error page. That is what a resident hit by clicking the Learning Record CTA while
 * the first-login tour was still live, and why refreshing (which clears the
 * above-the-router tour state) made the next attempt work.
 */
export const TOUR_ROUTE_PREFIXES = ['/home', '/knowledge-center', '/viewer'];

/**
 * Matches on path segments, not raw string prefixes. A bare `startsWith` also
 * matched `/knowledge-center-management` — an AdminRoles route
 * (routes/knowledge-routes.tsx) — and `UnlockEdTour` is mounted in
 * `AuthenticatedLayout`, which wraps admin routes too. The visible cost was an
 * admin's first login consuming `first_login_tour_pending` on a page that has
 * none of the tour's targets; the latent one was permitting Joyride to mount
 * there at all, which is the same shape as the bug this file exists to fix.
 */
export function isTourRoute(pathname: string): boolean {
    return TOUR_ROUTE_PREFIXES.some(
        (prefix) => pathname === prefix || pathname.startsWith(prefix + '/')
    );
}

/**
 * Which of the routes above each step's target actually lives on.
 *
 * `isTourRoute` is not enough on its own. In react-joyride 2.9.3 the tooltip and the
 * overlay are siblings with different conditions: `JoyrideStep.render` bails out when
 * the target does not resolve, but the overlay is rendered from `steps[stepIndex]`
 * with no target check at all and is suppressed only on lifecycle (INIT, BEACON,
 * COMPLETE, ERROR). A route change never touches Joyride's store, so the lifecycle
 * survives one. A running tour holding a step whose target is not on the current page
 * therefore paints a full-screen scrim with no tooltip under it, and every step past
 * the first sets `disableOverlayClose` — nothing to click, and only a refresh clears
 * it. That is the ID-846 symptom one route short of ID-846.
 *
 * Defense in depth, not a fixed repro. Today each tour page re-seats the step when it
 * mounts, which covers the obvious ways in: ResidentHome resets to step 0 for any
 * step but 1, and LibraryViewer re-seats /viewer. Two attempts to strand an overlay
 * through history navigation did not manage it. But that cover is incidental and
 * uneven — ResidentKnowledgeCenter re-seats ONLY when the target is
 * `#visit-knowledge-center`, so /knowledge-center has none of it for any other step —
 * and it puts the invariant in three page components that each have to remember it,
 * rather than in the one component that mounts Joyride.
 *
 * The guard can only ever suppress a render that Joyride would have drawn without a
 * tooltip anyway: if the target is not on this route, there was no tooltip to lose.
 *
 * An empty array means the target is in the sidebar
 * (components/navigation/Sidebar.tsx), which AuthenticatedLayout renders on every
 * route, so no pathname rules it out.
 *
 * Typed against `targetToStepIndexMap` on purpose: adding a step there will not
 * compile until the new target is given its routes here.
 */
const TARGET_ROUTES: Record<
    keyof typeof targetToStepIndexMap,
    readonly string[]
> = {
    '#resident-home': ['/home'],
    '#visit-knowledge-center': [],
    '#knowledge-center-landing': ['/knowledge-center'],
    '#knowledge-center-tabs': ['/knowledge-center'],
    '#knowledge-center-search': ['/knowledge-center'],
    '#knowledge-center-filters': ['/knowledge-center'],
    // Rendered by components/knowledge-center/LibraryCard, which the resident
    // only ever sees on the Knowledge Center — ResidentHome has its own
    // FeaturedLibraryCard and carries neither id.
    '#knowledge-center-search-lib': ['/knowledge-center'],
    '#knowledge-center-fav-lib': ['/knowledge-center'],
    '#knowledge-center-enter-library': ['/knowledge-center'],
    '#library-viewer-sub-page': ['/viewer'],
    // No element in the app carries this id, so the step is skipped by
    // UnlockEdTour's TARGET_NOT_FOUND handling wherever it runs. Listed under the
    // route it was written for so this map does not become the reason it is
    // skipped — that is a separate content bug, and it should stay visible as one.
    '#library-viewer-favorite': ['/viewer'],
    '#navigate-homepage': [],
    '#top-content': ['/home'],
    '#popular-content': ['/home'],
    '#end-tour': ['/home']
};

/**
 * True when `pathname` can host `target`.
 *
 * Fails open for anything not in the map: this exists to hide a tour that is
 * provably on the wrong page, not to become a second registry a step has to appear
 * in before it will render at all.
 */
export function isTargetOnRoute(
    target: Step['target'] | undefined,
    pathname: string
): boolean {
    if (typeof target !== 'string') return true;
    const routes = TARGET_ROUTES[target as keyof typeof TARGET_ROUTES];
    if (!routes || routes.length === 0) return true;
    return routes.some(
        (prefix) => pathname === prefix || pathname.startsWith(prefix + '/')
    );
}
