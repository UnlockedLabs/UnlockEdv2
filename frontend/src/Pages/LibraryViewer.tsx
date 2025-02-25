import { MouseEvent, useEffect, useState, useRef } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { SubmitHandler, FieldValues } from 'react-hook-form';
import Error from '@/Pages/Error';
import API from '@/api/api';
import { Library, ServerResponseOne, ToastState } from '@/common';
import { StarIcon } from '@heroicons/react/24/solid';
import { StarIcon as StarIconOutline } from '@heroicons/react/24/outline';
import { usePageTitle } from '@/Context/AuthLayoutPageTitleContext';
import { LibrarySearchBar } from '@/Components/inputs';
import LibrarySearchResultsModal from '@/Components/LibrarySearchResultsModal';
import { useToast } from '@/Context/ToastCtx';
import { isAdministrator } from '@/useAuth';
import { useAuth } from '@/useAuth';
import { FormModal } from '@/Components/modals/FormModal';
import { FormInputTypes } from '@/Components/modals';
interface UrlNavState {
    url?: string;
}

export default function LibraryViewer() {
    const { user } = useAuth();
    const { id: libraryId } = useParams();
    const [src, setSrc] = useState<string>('');
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const { toaster } = useToast();
    const [bookmarked, setBookmarked] = useState<boolean>(false);
    const [providerID, setProviderID] = useState<number>();
    const favoriteModalRef = useRef<HTMLDialogElement>(null);
    const [searchPlaceholder, setSearchPlaceholder] = useState<string>('');
    const [searchTerm, setSearchTerm] = useState('');
    const modalRef = useRef<HTMLDialogElement>(null);
    const navigate = useNavigate();
    const location = useLocation() as { state: UrlNavState };
    const { url } = location.state || {};
    const { setPageTitle: setAuthLayoutPageTitle } = usePageTitle();

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

    const navToLibraryViewer = (
        _kind: string,
        url: string,
        title: string,
        id: number
    ) => {
        navigate(`/viewer/libraries/${id}`, {
            state: { url: url, title: title }
        });
        closeModal();
        return;
    };

    const handleSearch = () => {
        if (modalRef.current) {
            if (!modalRef.current.open) {
                openModal();
            }
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
                const resp = (await API.get(
                    `libraries/${libraryId}`
                )) as ServerResponseOne<Library>;
                if (resp.success) {
                    const title = resp.data.title;
                    setAuthLayoutPageTitle(title);
                    setSearchPlaceholder('Search ' + title);
                    setProviderID(resp.data.open_content_provider_id);
                }
                const response = await fetch(
                    `/api/proxy/libraries/${libraryId}/`
                );
                if (response.ok) {
                    if (url && url !== '' && url.includes('/api/proxy/')) {
                        setSrc(url);
                    } else {
                        setSrc(response.url);
                    }
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
    }, [libraryId, url, setAuthLayoutPageTitle]);

    const socketRef = useRef<WebSocket | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    useEffect(() => {
        //websocket effect
        const protocol =
            window.location.protocol === 'https:' ? 'wss://' : 'ws://';
        const host = window.location.hostname;
        const socket = new WebSocket(`${protocol}${host}/api/ws/listen`);
        // Handle incoming messages
        socketRef.current = socket;
        socket.onopen = () => {
            setIsConnected(true);
            console.log('WebSocket connected');
        };
        socket.onmessage = (event) => {
            try {
                setBookmarked(event.data === 'true');
            } catch (error) {
                console.error('Error parsing WebSocket message:', error);
            }
        };
        socket.onclose = () => {
            console.log('WebSocket closed');
            setIsConnected(false);
        };
        //send message to let server know the user?
        return () => {
            if (socketRef.current && isConnected) {
                socketRef.current.close();
            }
        };
    }, [src, isConnected]);

    const toggleBookmark = (e: MouseEvent) => {
        e.preventDefault();
        if (!src) {
            toaster('Please wait for the library to load', ToastState.error);
            return;
        }
        if (bookmarked) {
            void handleUnbookmark();
        } else {
            favoriteModalRef.current?.showModal();
        }
    };
    const handleUnbookmark = async () => {
        try {
            if (!src) {
                toaster(
                    'Please wait for the library to load',
                    ToastState.error
                );
                return;
            }
            let relativeUrl = src;
            if (src.startsWith('http://') || src.startsWith('https://')) {
                relativeUrl = new URL(src).pathname;
            } else if (!src.startsWith('/')) {
                relativeUrl = '/' + src;
            }
            console.log('Unbookmarking with relative URL:', relativeUrl);
            const response = await API.put(
                `open-content/${libraryId}/bookmark`,
                {
                    open_content_provider_id: providerID,
                    content_url: relativeUrl
                }
            );
            if (response.success) {
                setBookmarked(false);
                toaster('Library removed from bookmarks', ToastState.success);
            } else {
                toaster(response.message, ToastState.error);
            }
        } catch (error: unknown) {
            toaster('Error updating bookmark status', ToastState.error);
            console.error('Unbookmark error:', error);
        }
    };

    const handleBookmarkSubmit: SubmitHandler<FieldValues> = async (data) => {
        try {
            const response = await API.put(
                `open-content/${libraryId}/bookmark`,
                {
                    name: data?.favoriteName as string,
                    open_content_provider_id: providerID
                }
            );
            if (response.success) {
                setBookmarked(true);
                toaster('Library added to favorites', ToastState.success);
            } else {
                toaster(response.message, ToastState.error);
            }
        } catch (error) {
            toaster('Error updating favorite status', ToastState.error);
            console.error(error);
        } finally {
            favoriteModalRef.current?.close();
        }
    };

    return (
        <div>
            <div className="px-5 pb-4">
                <div className="flex items-center gap-4 mb-4">
                    <h1>Library Viewer</h1>
                    {user && !isAdministrator(user) && !isLoading && (
                        <>
                            {bookmarked ? (
                                <StarIcon
                                    className="w-6 text-yellow-500 cursor-pointer"
                                    onClick={toggleBookmark}
                                />
                            ) : (
                                <StarIconOutline
                                    className="w-6 text-header-text cursor-pointer"
                                    onClick={toggleBookmark}
                                />
                            )}
                        </>
                    )}
                    <LibrarySearchBar
                        searchPlaceholder={searchPlaceholder}
                        searchTerm={searchTerm}
                        onSearchClick={handleSearch}
                        changeCallback={setSearchTerm}
                        isSearchValid={searchTerm.trim() !== ''}
                    />
                    <LibrarySearchResultsModal
                        key={libraryId}
                        onItemClick={navToLibraryViewer}
                        libraryId={Number(libraryId)}
                        ref={modalRef}
                        onModalClose={closeModal}
                    />
                </div>
                <div className="w-full pt-4 justify-center">
                    {isLoading ? (
                        <div className="flex h-screen gap-4 justify-center content-center">
                            <span className="my-auto loading loading-spinner loading-lg"></span>
                            <p className="my-auto text-lg">Loading...</p>
                        </div>
                    ) : src !== '' ? (
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
                <FormModal
                    title="Favorite Library"
                    inputs={[
                        {
                            type: FormInputTypes.Text,
                            label: 'Favorite Name',
                            interfaceRef: 'favoriteName',
                            required: true,
                            length: 100
                        }
                    ]}
                    ref={favoriteModalRef}
                    onSubmit={handleBookmarkSubmit}
                />
            </div>
        </div>
    );
}
