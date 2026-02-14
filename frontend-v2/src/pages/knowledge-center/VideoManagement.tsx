import { useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import useSWR from 'swr';
import { useForm } from 'react-hook-form';
import {
    Video,
    ServerResponseMany,
    UserRole,
    ToastState,
    ViewType,
    VideoAdminVisibility,
    FeatureAccess,
    MAX_DOWNLOAD_ATTEMPTS
} from '@/types';
import { hasFeature, useAuth } from '@/auth/useAuth';
import { useToast } from '@/contexts/ToastContext';
import { useUrlPagination } from '@/hooks/useUrlPagination';
import { VideoCard } from '@/components/knowledge-center';
import { EmptyState } from '@/components/shared/EmptyState';
import { FormModal } from '@/components/shared/FormModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Pagination,
    PaginationContent,
    PaginationItem,
    PaginationLink,
    PaginationNext,
    PaginationPrevious
} from '@/components/ui/pagination';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Video as VideoIcon } from 'lucide-react';
import { getVideoErrorMessage } from '@/lib/formatters';
import API from '@/api/api';

interface AddVideoFormData {
    url: string;
}

interface OutletContextType {
    activeView: ViewType;
    sortQuery: string;
    filterVisibilityAdmin: VideoAdminVisibility;
}

export default function VideoManagement() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { toaster } = useToast();
    const { page, perPage, setPage } = useUrlPagination(1, 20);

    const [addModalOpen, setAddModalOpen] = useState(false);
    const [targetVideo, setTargetVideo] = useState<Video | null>(null);
    const [statusDialogOpen, setStatusDialogOpen] = useState(false);
    const [polling, setPolling] = useState(false);

    const addForm = useForm<AddVideoFormData>();

    const { activeView, sortQuery, filterVisibilityAdmin } =
        useOutletContext<OutletContextType>();

    const visibilitySuffix =
        filterVisibilityAdmin === VideoAdminVisibility['All Videos']
            ? ''
            : `&visibility=${filterVisibilityAdmin}`;

    const { data, mutate, error, isLoading } = useSWR<
        ServerResponseMany<Video>
    >(
        `/api/videos?page=${page}&per_page=${perPage}&${sortQuery}${visibilitySuffix}`
    );

    const videoData = data?.data ?? [];
    const meta = data?.meta;
    const totalPages = meta?.last_page ?? 1;

    if (!user) return null;
    if (user.role === UserRole.Student) {
        navigate('/knowledge-center/videos', { replace: true });
        return null;
    }

    const pollVideos = (delay: number) => {
        if (!polling) return;
        void mutate().then(() => {
            if (delay > 10000) {
                setPolling(false);
                return;
            }
            delay *= 2;
            setTimeout(() => pollVideos(delay), delay);
        });
    };

    const handleRetryVideo = async (video: Video) => {
        const response = await API.put<null, object>(
            `videos/${video.id}/retry`,
            {}
        );
        if (response.success) {
            toaster('Video uploaded successfully', ToastState.success);
            setPolling(true);
            setTimeout(() => pollVideos(1000), 1000);
        } else {
            toaster('Error uploading video', ToastState.error);
        }
    };

    const handleAddVideo = async (formData: AddVideoFormData) => {
        const response = await API.post<null, object>('videos', {
            url: formData.url
        });
        if (response.success) {
            toaster('Video added successfully', ToastState.success);
            setAddModalOpen(false);
            addForm.reset();
            setPolling(true);
            setTimeout(() => pollVideos(1000), 1000);
            void mutate();
        } else {
            toaster(
                response.message || 'Failed to add video',
                ToastState.error
            );
        }
    };

    const getStatusText = () => {
        if (!targetVideo) return '';
        return targetVideo.video_download_attempts.length >=
            MAX_DOWNLOAD_ATTEMPTS
            ? 'This video has reached the maximum download attempts. Please remove and try again.'
            : `Download is processing: ${getVideoErrorMessage(targetVideo) ?? ''}\nThe video download will be retried every 3 hours.`;
    };

    if (isLoading) {
        return (
            <div className="space-y-4">
                <div className="grid grid-cols-4 gap-4">
                    {Array.from({ length: 8 }).map((_, i) => (
                        <Skeleton key={i} className="h-56 w-full rounded-lg" />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <>
            {hasFeature(user, FeatureAccess.UploadVideoAccess) && (
                <div className="flex justify-end">
                    <Button
                        className="bg-[#F1B51C] text-[#203622] hover:bg-[#F1B51C]/90"
                        onClick={() => setAddModalOpen(true)}
                    >
                        <Plus className="size-4" />
                        Add Videos
                    </Button>
                </div>
            )}

            {videoData.length === 0 ? (
                <EmptyState
                    icon={
                        <VideoIcon className="size-6 text-muted-foreground" />
                    }
                    title="No videos found"
                    description="Add videos to get started"
                />
            ) : (
                <div
                    className={
                        activeView === ViewType.Grid
                            ? 'grid grid-cols-4 gap-4'
                            : 'space-y-3'
                    }
                >
                    {videoData.map((video) => (
                        <VideoCard
                            key={video.id}
                            video={video}
                            mutate={mutate}
                            role={user.role}
                            handleRetryVideo={async (v) => {
                                if (polling) {
                                    toaster(
                                        'Please wait several minutes before attempting to retry newly added videos',
                                        ToastState.error
                                    );
                                    return;
                                }
                                await handleRetryVideo(v);
                            }}
                            handleOpenInfo={() => {
                                setTargetVideo(video);
                                setStatusDialogOpen(true);
                            }}
                            view={activeView}
                        />
                    ))}
                </div>
            )}

            {!error && totalPages > 1 && videoData.length > 0 && (
                <div className="flex justify-center pt-4">
                    <Pagination>
                        <PaginationContent>
                            <PaginationItem>
                                <PaginationPrevious
                                    onClick={() =>
                                        page > 1 && setPage(page - 1)
                                    }
                                    className={
                                        page <= 1
                                            ? 'pointer-events-none opacity-50'
                                            : 'cursor-pointer'
                                    }
                                />
                            </PaginationItem>
                            {Array.from(
                                { length: Math.min(totalPages, 5) },
                                (_, i) => {
                                    let pageNum: number;
                                    if (totalPages <= 5) pageNum = i + 1;
                                    else if (page <= 3) pageNum = i + 1;
                                    else if (page >= totalPages - 2)
                                        pageNum = totalPages - 4 + i;
                                    else pageNum = page - 2 + i;
                                    return (
                                        <PaginationItem key={pageNum}>
                                            <PaginationLink
                                                onClick={() =>
                                                    setPage(pageNum)
                                                }
                                                isActive={pageNum === page}
                                                className="cursor-pointer"
                                            >
                                                {pageNum}
                                            </PaginationLink>
                                        </PaginationItem>
                                    );
                                }
                            )}
                            <PaginationItem>
                                <PaginationNext
                                    onClick={() =>
                                        page < totalPages &&
                                        setPage(page + 1)
                                    }
                                    className={
                                        page >= totalPages
                                            ? 'pointer-events-none opacity-50'
                                            : 'cursor-pointer'
                                    }
                                />
                            </PaginationItem>
                        </PaginationContent>
                    </Pagination>
                </div>
            )}

            {error && (
                <p className="text-center text-destructive">
                    Failed to load videos.
                </p>
            )}

            <FormModal
                open={addModalOpen}
                onOpenChange={setAddModalOpen}
                title="Add Video"
                description="Enter a video URL to download"
            >
                <form
                    onSubmit={addForm.handleSubmit((d) =>
                        void handleAddVideo(d)
                    )}
                    className="space-y-4"
                >
                    <div className="space-y-2">
                        <Label htmlFor="video-url">Video URL</Label>
                        <Input
                            id="video-url"
                            placeholder="https://..."
                            {...addForm.register('url', { required: true })}
                        />
                    </div>
                    <div className="flex justify-end gap-2 pt-4">
                        <Button
                            variant="outline"
                            type="button"
                            onClick={() => setAddModalOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            className="bg-[#203622] text-white hover:bg-[#203622]/90"
                        >
                            Add
                        </Button>
                    </div>
                </form>
            </FormModal>

            <Dialog
                open={statusDialogOpen}
                onOpenChange={setStatusDialogOpen}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Video Status</DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-muted-foreground whitespace-pre-line">
                        {getStatusText()}
                    </p>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => {
                                setStatusDialogOpen(false);
                                setTargetVideo(null);
                            }}
                        >
                            Close
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
