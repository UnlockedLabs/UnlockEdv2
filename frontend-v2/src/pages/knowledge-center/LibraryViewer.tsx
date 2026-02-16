import { useEffect, useState, useRef } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Star, StarOff, ChevronLeft, Loader2 } from 'lucide-react';
import {
    Library,
    ServerResponseOne,
    ToastState
} from '@/types';
import { useAuth, isAdministrator } from '@/auth/useAuth';
import { useToast } from '@/contexts/ToastContext';
import { FormModal } from '@/components/shared/FormModal';
import { SearchInput } from '@/components/shared/SearchInput';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import API from '@/api/api';

interface UrlNavState {
    url?: string;
}

interface BookmarkFormData {
    favoriteName: string;
}

export default function LibraryViewer() {
    const { user } = useAuth();
    const { id: libraryId } = useParams();
    const navigate = useNavigate();
    const location = useLocation() as { state: UrlNavState };
    const { url } = location.state || {};
    const { toaster } = useToast();

    const [src, setSrc] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [iframeLoading, setIframeLoading] = useState(false);
    const [iframeError, setIframeError] = useState(false);
    const [bookmarked, setBookmarked] = useState(false);
    const [providerID, setProviderID] = useState<number>();
    const [libraryTitle, setLibraryTitle] = useState('');
    const [bookmarkModalOpen, setBookmarkModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [viewerRefreshKey, setViewerRefreshKey] = useState(0);

    const iframeRef = useRef<HTMLIFrameElement>(null);
    const loadingTimeoutRef = useRef<number | null>(null);
    const bookmarkForm = useForm<BookmarkFormData>();

    const forceViewerRefresh = () =>
        setViewerRefreshKey((key) => key + 1);

    const handleIframeLoad = () => {
        setIframeError(false);
        if (loadingTimeoutRef.current) {
            clearTimeout(loadingTimeoutRef.current);
            loadingTimeoutRef.current = null;
        }
        setTimeout(() => setIframeLoading(false), 500);
    };

    const handleIframeError = () => {
        setIframeLoading(false);
        setIframeError(true);
        if (loadingTimeoutRef.current) {
            clearTimeout(loadingTimeoutRef.current);
            loadingTimeoutRef.current = null;
        }
    };

    const retryIframeLoad = () => {
        setIframeError(false);
        setIframeLoading(true);
        const currentSrc = src;
        setSrc('');
        setTimeout(() => setSrc(currentSrc), 100);
    };

    useEffect(() => {
        const fetchLibraryData = async () => {
            setIsLoading(true);
            try {
                const resp = (await API.get(
                    `libraries/${libraryId}`
                )) as ServerResponseOne<Library>;
                if (resp.success) {
                    setLibraryTitle(resp.data.title);
                    setProviderID(resp.data.open_content_provider_id);
                }
                const response = await fetch(
                    `/api/proxy/libraries/${libraryId}/`
                );
                if (response.ok) {
                    setIframeLoading(true);
                    loadingTimeoutRef.current = window.setTimeout(() => {
                        setIframeLoading(false);
                    }, 10000);
                    if (url && url !== '' && url.includes('/api/proxy/')) {
                        setSrc(url);
                    } else {
                        setSrc(response.url);
                    }
                } else if (response.status === 404) {
                    navigate('/404', { replace: true });
                } else {
                    navigate('/error', { replace: true });
                }
            } catch {
                navigate('/404', { replace: true });
            } finally {
                setIsLoading(false);
            }
        };
        void fetchLibraryData();
        return () => {
            sessionStorage.removeItem('tag');
        };
    }, [libraryId, url, viewerRefreshKey]);

    const toggleBookmark = () => {
        if (!src) {
            toaster('Please wait for the library to load', ToastState.error);
            return;
        }
        if (bookmarked) {
            void handleUnbookmark();
        } else {
            setBookmarkModalOpen(true);
        }
    };

    const handleUnbookmark = async () => {
        if (!src) {
            toaster('Please wait for the library to load', ToastState.error);
            return;
        }
        let relativeUrl = src;
        if (src.startsWith('http://') || src.startsWith('https://')) {
            relativeUrl = new URL(src).pathname;
        } else if (!src.startsWith('/')) {
            relativeUrl = '/' + src;
        }
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
    };

    const handleBookmarkSubmit = async (data: BookmarkFormData) => {
        const response = await API.put(
            `open-content/${libraryId}/bookmark`,
            {
                name: data.favoriteName,
                open_content_provider_id: providerID
            }
        );
        if (response.success) {
            setBookmarked(true);
            toaster('Library added to favorites', ToastState.success);
        } else {
            toaster(response.message, ToastState.error);
        }
        setBookmarkModalOpen(false);
        bookmarkForm.reset();
    };

    return (
        <div className="flex flex-col h-full">
            <div className="flex items-center gap-3 mb-4">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                        setSrc(`/api/proxy/libraries/${libraryId}/`);
                        navigate('', { replace: true });
                        forceViewerRefresh();
                    }}
                >
                    <ChevronLeft className="size-4" />
                    Library Home
                </Button>

                {user && !isAdministrator(user) && (
                    <button onClick={toggleBookmark}>
                        {bookmarked ? (
                            <Star className="size-5 fill-[#F1B51C] text-[#F1B51C]" />
                        ) : (
                            <StarOff className="size-5 text-muted-foreground" />
                        )}
                    </button>
                )}

                <SearchInput
                    value={searchTerm}
                    onChange={setSearchTerm}
                    placeholder={`Search ${libraryTitle}`}
                    className="w-64"
                />
            </div>

            <div className="flex-1 min-h-0">
                {isLoading ? (
                    <div className="flex h-full items-center justify-center">
                        <Skeleton className="w-full h-[600px]" />
                    </div>
                ) : src !== '' ? (
                    <div className="relative w-full h-full">
                        <iframe
                            ref={iframeRef}
                            sandbox="allow-scripts allow-same-origin allow-modals allow-popups"
                            className="w-full h-full"
                            src={src}
                            onLoad={handleIframeLoad}
                            onError={handleIframeError}
                            style={{
                                border: 'none',
                                minHeight: '600px'
                            }}
                        />
                        {iframeLoading && (
                            <div className="absolute inset-0 bg-muted/90 flex items-center justify-center z-10">
                                <div className="flex items-center gap-3">
                                    <Loader2 className="size-6 animate-spin text-foreground" />
                                    <span className="text-sm text-foreground">
                                        Loading library content...
                                    </span>
                                </div>
                            </div>
                        )}
                        {iframeError && (
                            <div className="absolute inset-0 bg-muted/90 flex items-center justify-center z-10">
                                <div className="text-center space-y-4">
                                    <p className="text-sm text-destructive">
                                        Failed to load library content
                                    </p>
                                    <Button onClick={retryIframeLoad}>
                                        Try Again
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                ) : null}
            </div>

            <FormModal
                open={bookmarkModalOpen}
                onOpenChange={setBookmarkModalOpen}
                title="Favorite Page"
            >
                <form
                    onSubmit={bookmarkForm.handleSubmit((d) =>
                        void handleBookmarkSubmit(d)
                    )}
                    className="space-y-4"
                >
                    <div className="space-y-2">
                        <Label htmlFor="fav-name">Favorite Name</Label>
                        <Input
                            id="fav-name"
                            maxLength={100}
                            {...bookmarkForm.register('favoriteName', {
                                required: true
                            })}
                        />
                    </div>
                    <div className="flex justify-end gap-2 pt-4">
                        <Button
                            variant="outline"
                            type="button"
                            onClick={() => setBookmarkModalOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            className="bg-[#203622] text-white hover:bg-[#203622]/90"
                        >
                            Save
                        </Button>
                    </div>
                </form>
            </FormModal>
        </div>
    );
}
