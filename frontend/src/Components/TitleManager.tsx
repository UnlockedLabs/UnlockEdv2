import { useMatches, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { TitleHandler } from '@/common';

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

            const activeHandle = matches
                .filter((match) =>
                    Boolean((match.handle as TitleHandler)?.title)
                )
                .pop();
            const title =
                (activeHandle?.handle as TitleHandler)?.title ?? 'UnlockEd';
            document.title = title + ' - UnlockEd';
        };

        updateTitle();
    }, [matches, location.pathname]);

    return null;
}
