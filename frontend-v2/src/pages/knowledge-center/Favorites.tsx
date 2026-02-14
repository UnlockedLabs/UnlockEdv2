import { useOutletContext } from 'react-router-dom';
import useSWR from 'swr';
import { OpenContentItem, ServerResponseMany, ViewType } from '@/types';
import { isAdministrator, useAuth } from '@/auth/useAuth';
import { useUrlPagination } from '@/hooks/useUrlPagination';
import { FavoriteCard } from '@/components/knowledge-center';
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
import { Star } from 'lucide-react';

interface OutletContextType {
    activeView: ViewType;
    searchQuery: string;
    sortQuery: string;
}

export default function Favorites() {
    const { user } = useAuth();
    const { activeView, searchQuery, sortQuery } =
        useOutletContext<OutletContextType>();
    const { page, perPage, setPage } = useUrlPagination(1, 20);

    const { data, error, mutate, isLoading } = useSWR<
        ServerResponseMany<OpenContentItem>
    >(
        user
            ? `/api/open-content/favorites?page=${page}&per_page=${perPage}&search=${searchQuery}&order_by=${sortQuery}`
            : null,
        { shouldRetryOnError: false }
    );

    const favorites = data?.data ?? [];
    const meta = data?.meta;
    const totalPages = meta?.last_page ?? 1;

    if (isLoading) {
        return (
            <div className="grid grid-cols-4 gap-4">
                {Array.from({ length: 8 }).map((_, i) => (
                    <Skeleton key={i} className="h-36 w-full rounded-lg" />
                ))}
            </div>
        );
    }

    return (
        <>
            {favorites.length === 0 ? (
                <EmptyState
                    icon={<Star className="size-6 text-muted-foreground" />}
                    title="No favorites yet"
                    description="Favorite libraries, videos, and links to see them here"
                />
            ) : (
                <div
                    className={
                        activeView === ViewType.Grid
                            ? 'grid grid-cols-4 gap-4'
                            : 'space-y-3'
                    }
                >
                    {favorites.map((favorite) => (
                        <FavoriteCard
                            key={`${favorite.open_content_provider_id}-${favorite.content_id}-${favorite.title}`}
                            favorite={favorite}
                            mutate={mutate}
                            isAdminInStudentView={isAdministrator(user)}
                            view={activeView}
                        />
                    ))}
                </div>
            )}

            {error && (
                <p className="text-center text-destructive">
                    Failed to load favorites.
                </p>
            )}

            {!error && totalPages > 1 && (
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
        </>
    );
}
