import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import Error from '@/Pages/Error';
import API from '@/api/api';
import { Library, ServerResponseOne } from '@/common';
import { usePathValue } from '@/Context/PathValueCtx';

export default function LibraryViewer() {
    const { id: libraryId } = useParams();
    const [src, setSrc] = useState<string>('');
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [libraryTitle, setLibraryTitle] = useState<string>('');
    const { setPathVal } = usePathValue();

    useEffect(() => {
        const fetchLibraryData = async () => {
            setIsLoading(true);
            try {
                const resp = (await API.get(
                    `libraries/${libraryId}`
                )) as ServerResponseOne<Library>;
                if (resp.success) {
                    setLibraryTitle(resp.data.title);
                    setPathVal([
                        { path_id: ':library_name', value: resp.data.title }
                    ]);
                }
                const response = await fetch(
                    `/api/proxy/libraries/${libraryId}/`
                );
                if (response.ok) {
                    setSrc(response.url);
                } else if (response.status === 404) {
                    setError('Library not found');
                } else {
                    setError('Error loading library');
                }
            } catch {
                setError('Error loading library');
            } finally {
                setIsLoading(false);
            }
        };
        void fetchLibraryData();
        return () => {
            sessionStorage.removeItem('tag');
        };
    }, [libraryId]);

    return (
        <div>
            <div className="px-8 pb-4">
                <h1 className="text-2xl font-bold">{libraryTitle}</h1>
                <div className="w-full pt-4 justify-center">
                    {isLoading ? (
                        <div className="flex h-screen gap-4 justify-center content-center">
                            <span className="my-auto loading loading-spinner loading-lg"></span>
                            <p className="my-auto text-lg">Loading...</p>
                        </div>
                    ) : src != '' ? (
                        <iframe
                            sandbox="allow-scripts allow-same-origin allow-modals allow-popups"
                            className="w-full h-screen pt-4"
                            id="library-viewer-iframe"
                            src={src}
                        />
                    ) : (
                        error && <Error />
                    )}
                </div>
            </div>
        </div>
    );
}
