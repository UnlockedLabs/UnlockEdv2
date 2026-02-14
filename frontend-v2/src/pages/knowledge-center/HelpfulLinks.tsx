import { useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import useSWR from 'swr';
import {
    HelpfulLink,
    HelpfulLinkAndSort,
    ServerResponseOne,
    UserRole,
    ViewType
} from '@/types';
import { useUrlPagination } from '@/hooks/useUrlPagination';
import { HelpfulLinkCard } from '@/components/knowledge-center';
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
import { Link as LinkIcon } from 'lucide-react';

interface OutletContextType {
    activeView: ViewType;
    searchQuery: string;
    sortQuery: string;
}

export default function HelpfulLinks() {
    const { activeView, searchQuery, sortQuery } =
        useOutletContext<OutletContextType>();
    const { page, perPage, setPage } = useUrlPagination(1, 20);

    const { data, mutate, isLoading, error } = useSWR<
        ServerResponseOne<HelpfulLinkAndSort>
    >(
        `/api/helpful-links?page=${page}&per_page=${perPage}&search=${searchQuery}${sortQuery}&visibility=true`
    );

    const helpfulLinks = data?.data?.helpful_links ?? [];
    const meta = data?.data?.meta ?? {
        total: 0,
        per_page: 20,
        current_page: 1,
        last_page: 1
    };
    const totalPages = meta.last_page;

    useEffect(() => {
        setPage(1);
    }, [searchQuery]);

    if (isLoading) {
        return (
            <div className="grid grid-cols-4 gap-4">
                {Array.from({ length: 8 }).map((_, i) => (
                    <Skeleton key={i} className="h-44 w-full rounded-lg" />
                ))}
            </div>
        );
    }

    return (
        <>
            {helpfulLinks.length === 0 ? (
                <EmptyState
                    icon={
                        <LinkIcon className="size-6 text-muted-foreground" />
                    }
                    title="No helpful links available"
                    description="Check back later for new resources"
                />
            ) : (
                <div
                    className={
                        activeView === ViewType.Grid
                            ? 'grid grid-cols-4 gap-4'
                            : 'space-y-3'
                    }
                >
                    {helpfulLinks.map((link: HelpfulLink) => (
                        <HelpfulLinkCard
                            key={link.id}
                            link={link}
                            mutate={() => void mutate()}
                            role={UserRole.Student}
                            view={activeView}
                        />
                    ))}
                </div>
            )}

            {error && (
                <p className="text-center text-destructive">
                    Failed to load helpful links.
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
