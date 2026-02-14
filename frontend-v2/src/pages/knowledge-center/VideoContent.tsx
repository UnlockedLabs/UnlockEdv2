import { useOutletContext } from 'react-router-dom';
import useSWR from 'swr';
import { Video, ServerResponseMany, UserRole, ViewType } from '@/types';
import { useAuth } from '@/auth/useAuth';
import { useUrlPagination } from '@/hooks/useUrlPagination';
import { VideoCard } from '@/components/knowledge-center';
import { EmptyState } from '@/components/shared/EmptyState';
import {
    Pagination,
    PaginationContent,
    PaginationItem,
    PaginationLink,
    PaginationNext,
    PaginationPrevious
} from '@/components/ui/pagination';
import { Skeleton } from '@/components/ui/skeleton';
import { Video as VideoIcon } from 'lucide-react';
import { videoIsAvailable } from '@/lib/formatters';

interface OutletContextType {
    activeView: ViewType;
    searchQuery: string;
    sortQuery: string;
}

export default function VideoContent() {
    const { user } = useAuth();
    const { activeView, searchQuery, sortQuery } =
        useOutletContext<OutletContextType>();
    const { page, perPage, setPage } = useUrlPagination(1, 20);

    const { data, mutate, error, isLoading } = useSWR<
        ServerResponseMany<Video>
    >(
        `/api/videos?search=${searchQuery}&page=${page}&per_page=${perPage}&${sortQuery}&visibility=visible`
    );

    const videoData =
        data?.data.filter(
            (vid) => videoIsAvailable(vid) && vid.visibility_status
        ) ?? [];
    const meta = data?.meta;
    const totalPages = meta?.last_page ?? 1;

    if (!user) return null;

    if (isLoading) {
        return (
            <div className="grid grid-cols-4 gap-4">
                {Array.from({ length: 8 }).map((_, i) => (
                    <Skeleton key={i} className="h-56 w-full rounded-lg" />
                ))}
            </div>
        );
    }

    return (
        <>
            {videoData.length === 0 ? (
                <EmptyState
                    icon={
                        <VideoIcon className="size-6 text-muted-foreground" />
                    }
                    title="No videos available"
                    description="Check back later for new content"
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
                            role={UserRole.Student}
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
        </>
    );
}
