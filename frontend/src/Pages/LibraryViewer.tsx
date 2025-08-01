import { MouseEvent, useEffect, useState, useRef } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { SubmitHandler, FieldValues } from 'react-hook-form';
import API from '@/api/api';
import {
    Library,
    ServerResponseOne,
    ToastState,
    WsMsg,
    WsEventType
} from '@/common';
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
import { useTourContext } from '@/Context/TourContext';
import { targetToStepIndexMap } from '@/Components/UnlockEdTour';
interface UrlNavState {
    url?: string;
}

export default function LibraryViewer() {
    const { user } = useAuth();
    const { id: libraryId } = useParams();
    const [src, setSrc] = useState<string>('');
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const { toaster } = useToast();
    const navigate = useNavigate();
    const [bookmarked, setBookmarked] = useState<boolean>(false);
    const [providerID, setProviderID] = useState<number>();
    const favoriteModalRef = useRef<HTMLDialogElement>(null);
    const [searchPlaceholder, setSearchPlaceholder] = useState<string>('');
    const [searchTerm, setSearchTerm] = useState('');
    const modalRef = useRef<HTMLDialogElement>(null);
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const location = useLocation() as { state: UrlNavState };
    const { url } = location.state || {};
    const { setPageTitle: setAuthLayoutPageTitle } = usePageTitle();
    const { tourState, setTourState } = useTourContext();

    const syncHeight = () => {
        const iframe = iframeRef.current;
        if (!iframe) return;

        try {
            const doc =
                iframe.contentDocument ?? iframe.contentWindow?.document;
            if (doc) {
                iframe.style.height = doc.documentElement.scrollHeight + 'px';
            }
        } catch {
            // cross-origin iframe, can't access the document content
        }
    };

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
        const iframe = iframeRef.current;
        if (!iframe) return;

        let resizeObserver: ResizeObserver | null = null;

        const setupHeightSync = () => {
            syncHeight();

            try {
                const doc =
                    iframe.contentDocument ?? iframe.contentWindow?.document;
                if (doc?.documentElement) {
                    resizeObserver = new ResizeObserver(() => {
                        syncHeight();
                    });
                    resizeObserver.observe(doc.documentElement);
                }
            } catch {
                // cross-origin iframe, can't access the document content
            }

            return () => {
                if (resizeObserver) {
                    resizeObserver.disconnect();
                }
            };
        };

        // Setup height sync when iframe loads
        iframe.addEventListener('load', setupHeightSync);

        return () => {
            iframe.removeEventListener('load', setupHeightSync);
            if (resizeObserver) {
                resizeObserver.disconnect();
            }
        };
    }, [src]);

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
                    navigate('/404');
                } else {
                    navigate('/error');
                }
            } catch {
                navigate('/404');
            } finally {
                setIsLoading(false);
            }
        };
        void fetchLibraryData();
        return () => {
            sessionStorage.removeItem('tag');
        };
    }, [libraryId, url, setAuthLayoutPageTitle]);

    useEffect(() => {
        window.websocket?.setMsgHandler((wsmsg: Partial<WsMsg>) => {
            if (wsmsg.event_type === WsEventType.BookmarkEvent) {
                setBookmarked(wsmsg.msg?.msg === 'true');
            }
        });
        return () => {
            window.websocket?.resetMsgHandler();
            window.websocket?.notifyOpenContentActivity(true);
        };
    }, []);

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

    useEffect(() => {
        if (tourState.tourActive) {
            if (tourState.target === '#top-content') {
                setTourState({
                    stepIndex: targetToStepIndexMap['#library-viewer-favorite'],
                    target: '#library-viewer-favorite'
                });
            } else {
                setTourState({
                    stepIndex: targetToStepIndexMap['#library-viewer-sub-page'],
                    target: '#library-viewer-sub-page'
                });
            }
        }
    }, []);

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
        <div className="flex flex-col h-full">
            <div className="px-5 pt-4">
                <div
                    className="flex items-center gap-4 mb-4"
                    id="library-viewer-sub-page"
                >
                    <h1>Library Viewer</h1>
                    {user && !isAdministrator(user) && (
                        <div
                            id="library-viewer-favorite"
                            className={
                                tourState.target === '#library-viewer-favorite'
                                    ? 'animate-pulse border border-2 border-primary-yellow rounded-xl'
                                    : ''
                            }
                        >
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
                        </div>
                    )}
                    <div onClick={openModal}>
                        <LibrarySearchBar
                            searchPlaceholder={searchPlaceholder}
                            searchTerm={searchTerm}
                            onSearchClick={handleSearch}
                            changeCallback={setSearchTerm}
                            isSearchValid={searchTerm.trim() !== ''}
                        />
                    </div>
                    <LibrarySearchResultsModal
                        key={libraryId}
                        libraryId={Number(libraryId)}
                        ref={modalRef}
                        onModalClose={closeModal}
                    />
                </div>
            </div>
            <div className="flex-1 px-5 pb-4 min-h-0">
                {isLoading ? (
                    <div className="flex h-full gap-4 justify-center items-center">
                        <span className="my-auto loading loading-spinner loading-lg"></span>
                        <p className="my-auto text-lg">Loading...</p>
                    </div>
                ) : src !== '' ? (
                    <iframe
                        ref={iframeRef}
                        sandbox="allow-scripts allow-same-origin allow-modals allow-popups"
                        className="w-full h-full"
                        id="library-viewer-iframe"
                        src={src}
                        style={{
                            border: 'none',
                            minHeight: '600px'
                        }}
                    />
                ) : (
                    <div />
                )}
            </div>
            <FormModal
                title="Favorite Page"
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
    );
}
