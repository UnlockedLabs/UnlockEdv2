import { useEffect, useRef, useState } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import Error from '@/Pages/Error';
import API from '@/api/api';
import { Library, ServerResponseOne } from '@/common';
import { usePathValue } from '@/Context/PathValueCtx';
import { LibrarySearchBar } from '@/Components/inputs';
import LibrarySearchResultsModal from '@/Components/LibrarySearchResultsModal';
import { useOutletContext } from 'react-router-dom';

interface UrlNavState {
    url?: string;
}
interface OutletContextType {
    setGlobalPageTitle: React.Dispatch<React.SetStateAction<string>>;
}
export default function LibraryViewer() {
    const { id: libraryId } = useParams();
    const [src, setSrc] = useState<string>('');
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const { setPathVal } = usePathValue();
    const [searchPlaceholder, setSearchPlaceholder] = useState<string>('');
    const [searchTerm, setSearchTerm] = useState('');
    const modalRef = useRef<HTMLDialogElement>(null);
    const navigate = useNavigate();
    const location = useLocation() as { state: UrlNavState };
    const { url } = location.state || {};
    const { setGlobalPageTitle } = useOutletContext<OutletContextType>();
    const openModal = () => {
        if (modalRef.current) {
            modalRef.current.style.visibility = 'visible';
            modalRef.current.showModal();
        }
    };
    const closeModal = () => {
        if (modalRef.current) {
            modalRef.current.style.visibility = 'hidden';
            modalRef.current.close();
        }
    };
    const handleSearchResultClick = (
        url: string,
        title: string,
        libId?: number
    ) => {
        if (Number(libraryId) === libId) {
            setSrc(url);
        } else {
            navigate(
                `/viewer/libraries/${libId}`,

                {
                    state: { url: url, title: title },
                    replace: true
                }
            );
        }
        setSearchPlaceholder('Search ' + title);
        closeModal();
    };
    const handleSearch = () => {
        if (modalRef.current) {
            if (!modalRef.current.open) {
                openModal();
            }
            //needed a way to call
            modalRef.current.dispatchEvent(
                new CustomEvent('executeHandleSearch', {
                    detail: {
                        searchTerm: searchTerm,
                        page: 1,
                        perPage: 10
                    }
                })
            );
        }
    };

    useEffect(() => {
        const fetchLibraryData = async () => {
            setIsLoading(true);
            try {
                console.log('Fetching library data...');
                const resp = (await API.get(
                    `libraries/${libraryId}`
                )) as ServerResponseOne<Library>;

                console.log('Response:', resp);

                if (resp.success) {
                    const title = resp.data.title;
                    setGlobalPageTitle(title); // <-- This line sets the global page title after fetching data
                    setSearchPlaceholder('Search ' + title);
                    setPathVal([{ path_id: ':library_name', value: title }]);
                }

                const response = await fetch(
                    `/api/proxy/libraries/${libraryId}/`
                );
                if (response.ok) {
                    if (url && url !== '') {
                        setSrc(url);
                    } else {
                        setSrc(response.url);
                    }
                } else if (response.status === 404) {
                    setError('Library not found');
                } else {
                    setError('Error loading library');
                }
            } catch (err) {
                console.error('Error fetching library data:', err);
                setError('Error loading library');
            } finally {
                setIsLoading(false);
            }
        };

        void fetchLibraryData(); // <-- Triggering the library data fetch when component mounts
        return () => {
            sessionStorage.removeItem('tag');
        };
    }, [libraryId, setGlobalPageTitle]); // <-- Added setGlobalPageTitle to dependency array

    return (
        <div>
            <div className="px-5 pb-4">
                <div className="flex items-center gap-4 mb-4">
                    <h1>Library Viewer</h1>
                    <LibrarySearchBar
                        searchPlaceholder={searchPlaceholder}
                        searchTerm={searchTerm}
                        onSearchClick={handleSearch}
                        changeCallback={setSearchTerm}
                        isSearchValid={searchTerm.trim() !== ''}
                    />
                    <LibrarySearchResultsModal
                        key={libraryId}
                        onItemClick={handleSearchResultClick}
                        libraryId={Number(libraryId)}
                        ref={modalRef}
                        onModalClose={closeModal}
                    ></LibrarySearchResultsModal>
                </div>
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
