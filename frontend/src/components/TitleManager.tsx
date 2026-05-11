import { useMatches, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { RouteTitleHandler, TitleHandler } from '@/types';
import { resolveTitle } from '@/loaders/routeLoaders';

export function TitleManager() {
    const matches = useMatches();
    const location = useLocation();

    useEffect(() => {
        const isLibraryViewer =
            location.pathname.includes('/viewer/libraries/');

        if (isLibraryViewer) {
            const timeout = setTimeout(() => {
                const titleInterval = setInterval(() => {
                    const libraryViewer = document.getElementById(
                        'library-viewer-iframe'
                    ) as HTMLIFrameElement;
                    try {
                        if (libraryViewer?.contentWindow?.document) {
                            const iframeTitle =
                                libraryViewer.contentWindow.document.title;
                            if (iframeTitle) {
                                document.title = iframeTitle + ' - UnlockEd';
                            }
                        }
                    } catch {
                        clearInterval(titleInterval);
                    }
                }, 1000);

                return () => clearInterval(titleInterval);
            }, 5000);

            return () => clearTimeout(timeout);
        }

        const activeMatch = [...matches]
            .filter(
                (match) =>
                    typeof match.handle === 'object' &&
                    match.handle !== null &&
                    'title' in match.handle
            )
            .pop();
        const title = resolveTitle(
            activeMatch?.handle as RouteTitleHandler<TitleHandler>,
            activeMatch?.data as TitleHandler
        );
        document.title = title ? title + ' - UnlockEd' : 'UnlockEd';
    }, [matches, location.pathname]);

    return null;
}
