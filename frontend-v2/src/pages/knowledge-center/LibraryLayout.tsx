import { useEffect } from 'react';
import { useLocation, useOutletContext } from 'react-router-dom';
import useSWR from 'swr';
import { Library, ServerResponseMany, UserRole, ViewType } from '@/types';
import { useAuth, isAdministrator } from '@/auth/useAuth';
import { useUrlPagination } from '@/hooks/useUrlPagination';
import { LibraryCard } from '@/components/knowledge-center';
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
import { BookOpen } from 'lucide-react';

interface OutletContextType {
    activeView: ViewType;
    searchQuery: string;
    filterVisibilityAdmin: string;
    categoryQueryString: string;
}

export default function LibraryLayout({
    studentView
}: {
    studentView?: boolean;
}) {
    const { user } = useAuth();
    if (!user) return null;

    const { activeView, searchQuery, filterVisibilityAdmin, categoryQueryString } =
        useOutletContext<OutletContextType>();

    const route = useLocation();
    const adminWithStudentView =
        !route.pathname.includes('management') && isAdministrator(user);

    let role = user.role;
    if (studentView) role = UserRole.Student;

    const { page, perPage, setPage, setPerPage } = useUrlPagination(1, 20);

    const visibility =
        isAdministrator(user) && !adminWithStudentView
            ? filterVisibilityAdmin
            : 'visible';

    const { data, mutate, error, isLoading } = useSWR<
        ServerResponseMany<Library>
    >(
        `/api/libraries?page=${page}&per_page=${perPage}&order_by=title&order=asc&visibility=${visibility}&search=${searchQuery}&${categoryQueryString}`
    );

    const libraries = data?.data ?? [];
    const meta = data?.meta;
    const totalPages = meta?.last_page ?? 1;

    useEffect(() => {
        setPage(1, { replace: true });
    }, [filterVisibilityAdmin, searchQuery, categoryQueryString]);

    if (isLoading) {
        return (
            <div className="grid grid-cols-4 gap-4">
                {Array.from({ length: 8 }).map((_, i) => (
                    <Skeleton key={i} className="h-48 w-full rounded-lg" />
                ))}
            </div>
        );
    }

    if (!isLoading && libraries.length === 0) {
        return (
            <EmptyState
                icon={<BookOpen className="size-6 text-muted-foreground" />}
                title="No libraries found"
                description="Try adjusting your search or filters"
            />
        );
    }

    return (
        <>
            <div
                className={
                    activeView === ViewType.Grid
                        ? 'grid grid-cols-4 gap-4'
                        : 'space-y-3'
                }
            >
                {libraries.map((library) => (
                    <LibraryCard
                        key={library.id}
                        library={library}
                        mutate={() => void mutate()}
                        role={adminWithStudentView ? UserRole.Student : role}
                        view={activeView}
                    />
                ))}
            </div>

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
