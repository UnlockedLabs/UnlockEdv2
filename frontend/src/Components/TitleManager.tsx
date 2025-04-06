import { useMatches, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { RouteTitleHandler, TitleHandler } from '@/common';
import { resolveTitle } from '@/routeLoaders';

export function TitleManager() {
    const matches = useMatches();
    const location = useLocation();

    useEffect(() => {
        const updateTitle = () => {
            const isLibraryViewer =
                location.pathname.includes('/viewer/libraries/');

            if (isLibraryViewer) {
                setTimeout(() => {
                    const titleInterval = setInterval(() => {
                        const libraryViewer = document.getElementById(
                            'library-viewer-iframe'
                        ) as HTMLIFrameElement;
                        if (libraryViewer?.contentWindow?.document) {
                            const iframeTitle =
                                libraryViewer.contentWindow.document.title;
                            if (iframeTitle) {
                                document.title = iframeTitle + ' - UnlockEd';
                            }
                        }
                    }, 1000);

                    return () => clearInterval(titleInterval);
                }, 5000);
                return;
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
            document.title = title + ' - UnlockEd';
        };

        updateTitle();
    }, [matches, location.pathname]);

    return null;
}
