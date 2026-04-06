import { useEffect, useState, useRef } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { ArrowLeft, Loader2 } from 'lucide-react';
import {
    Library,
    ServerResponseOne,
    ToastState
} from '@/types';
import { useAuth, isAdministrator } from '@/auth/useAuth';
import { useToast } from '@/contexts/ToastContext';
import Breadcrumbs from '@/components/navigation/Breadcrumbs';
import { FormModal } from '@/components/shared/FormModal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import API from '@/api/api';
import { useTourContext } from '@/contexts/TourContext';
import { targetToStepIndexMap } from '@/components/UnlockEdTour';

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
    const { tourState, setTourState } = useTourContext();

    const [src, setSrc] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [iframeLoading, setIframeLoading] = useState(false);
    const [iframeError, setIframeError] = useState(false);
    const [providerID, setProviderID] = useState<number>();
    const [libraryTitle, setLibraryTitle] = useState('');
    const [bookmarkModalOpen, setBookmarkModalOpen] = useState(false);
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const loadingTimeoutRef = useRef<number | null>(null);
    const bookmarkForm = useForm<BookmarkFormData>();
    const isAdmin = user ? isAdministrator(user) : false;
    const [libraryData, setLibraryData] = useState<Library | null>(null);

    const backPath = isAdmin
        ? '/knowledge-center-management'
        : '/knowledge-center';

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
                    setLibraryData(resp.data);
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
    }, [libraryId, url]);

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

    const handleBookmarkSubmit = async (data: BookmarkFormData) => {
        const response = await API.put(
            `open-content/${libraryId}/bookmark`,
            {
                name: data.favoriteName,
                open_content_provider_id: providerID
            }
        );
        if (response.success) {
            toaster('Library added to favorites', ToastState.success);
        } else {
            toaster(response.message, ToastState.error);
        }
        setBookmarkModalOpen(false);
        bookmarkForm.reset();
        if (tourState.tourActive) {
            setTourState({
                stepIndex: targetToStepIndexMap['#navigate-homepage'],
                target: '#navigate-homepage'
            });
        }
    };

    return (
        <div className="flex flex-col h-full">
            <div className="px-6 py-3 border-b border-gray-200 bg-white" id="library-viewer-sub-page">
                <div className="flex items-center justify-between">
                    <Breadcrumbs
                        items={[
                            { label: 'Knowledge Center', href: backPath },
                            { label: libraryTitle || 'Library' }
                        ]}
                    />
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(backPath)}
                    >
                        <ArrowLeft className="size-4 mr-2" />
                        Back
                    </Button>
                </div>
                <div className="flex items-start justify-between mt-2">
                    <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                            <h2 className="text-xl font-semibold text-[#203622]">
                                {libraryTitle}
                            </h2>
                            {isAdmin && libraryData && (
                                <>
                                    <Badge
                                        variant="outline"
                                        className={
                                            libraryData.visibility_status
                                                ? 'bg-green-50 text-[#556830] border-green-200 text-xs'
                                                : 'bg-gray-50 text-gray-600 border-gray-200 text-xs'
                                        }
                                    >
                                        {libraryData.visibility_status
                                            ? 'Visible'
                                            : 'Hidden'}
                                    </Badge>
                                    {libraryData.is_favorited && (
                                        <Badge
                                            variant="outline"
                                            className="bg-amber-50 text-amber-700 border-amber-200 text-xs"
                                        >
                                            Featured
                                        </Badge>
                                    )}
                                </>
                            )}
                        </div>
                        <p className="text-sm text-gray-600 line-clamp-1">
                            {libraryData?.description}
                        </p>
                    </div>
                </div>
            </div>

            <div className="flex-1 bg-[#E2E7EA]">
                {isLoading ? (
                    <div className="flex h-full items-center justify-center">
                        <Skeleton className="w-full h-[600px]" />
                    </div>
                ) : src !== '' ? (
                    <div className="relative w-full h-full">
                        <iframe
                            ref={iframeRef}
                            sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            className="w-full h-full"
                            src={src}
                            title={libraryTitle}
                            onLoad={handleIframeLoad}
                            onError={handleIframeError}
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
                    onSubmit={(e) => {
                        void bookmarkForm.handleSubmit((d) =>
                            void handleBookmarkSubmit(d)
                        )(e);
                    }}
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
