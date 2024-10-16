import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import Error from './Error';

export default function LibraryViewer() {
    const { id: libraryId } = useParams();
    const [src, setSrc] = useState<string>('');
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);

    useEffect(() => {
        const fetchLibraryData = async () => {
            setIsLoading(true);
            try {
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
            } catch (error) {
                setError('Error loading library');
            } finally {
                setIsLoading(false);
            }
        };
        fetchLibraryData();
    }, [libraryId]);

    return (
        <AuthenticatedLayout title="Library Viewer" path={['Library Viewer']}>
            <div className="px-8 pb-4">
                <h1>Library Viewer</h1>
                <div className="w-full pt-4 justify-center">
                    {isLoading ? (
                        <div className="flex h-screen gap-4 justify-center content-center">
                            <span className="my-auto loading loading-spinner loading-lg"></span>
                            <p className="my-auto text-lg">Loading...</p>
                        </div>
                    ) : src != '' ? (
                        <iframe
                            sandbox="allow-scripts allow-same-origin"
                            className="w-full h-screen pt-4"
                            id="library-viewer"
                            src={src}
                        />
                    ) : (
                        error && <Error />
                    )}
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
