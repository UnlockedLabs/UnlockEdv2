import { ReactNode } from 'react';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@/components/ui/table';
import {
    Pagination,
    PaginationContent,
    PaginationItem,
    PaginationLink,
    PaginationNext,
    PaginationPrevious
} from '@/components/ui/pagination';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export interface Column<T> {
    key: string;
    header: string;
    render: (item: T) => ReactNode;
    className?: string;
    headerClassName?: string;
}

interface DataTableProps<T> {
    columns: Column<T>[];
    data: T[];
    keyExtractor: (item: T) => string | number;
    isLoading?: boolean;
    emptyMessage?: string;
    onRowClick?: (item: T) => void;
    page?: number;
    totalPages?: number;
    onPageChange?: (page: number) => void;
    className?: string;
}

export function DataTable<T>({
    columns,
    data,
    keyExtractor,
    isLoading,
    emptyMessage = 'No data found.',
    onRowClick,
    page,
    totalPages,
    onPageChange,
    className
}: DataTableProps<T>) {
    if (isLoading) {
        return (
            <div className={cn('bg-white rounded-lg border border-gray-200', className)}>
                <div className="p-4 space-y-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <Skeleton key={i} className="h-10 w-full" />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className={cn('bg-white rounded-lg border border-gray-200', className)}>
            <Table>
                <TableHeader>
                    <TableRow className="border-b border-gray-100 hover:bg-transparent">
                        {columns.map((col) => (
                            <TableHead
                                key={col.key}
                                className={cn(
                                    'text-gray-500 font-medium',
                                    col.headerClassName
                                )}
                            >
                                {col.header}
                            </TableHead>
                        ))}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {data.length === 0 ? (
                        <TableRow>
                            <TableCell
                                colSpan={columns.length}
                                className="text-center text-muted-foreground py-8"
                            >
                                {emptyMessage}
                            </TableCell>
                        </TableRow>
                    ) : (
                        data.map((item) => (
                            <TableRow
                                key={keyExtractor(item)}
                                onClick={
                                    onRowClick
                                        ? () => onRowClick(item)
                                        : undefined
                                }
                                className={cn(
                                    'border-b border-gray-50 last:border-0',
                                    onRowClick && 'cursor-pointer'
                                )}
                            >
                                {columns.map((col) => (
                                    <TableCell
                                        key={col.key}
                                        className={col.className}
                                    >
                                        {col.render(item)}
                                    </TableCell>
                                ))}
                            </TableRow>
                        ))
                    )}
                </TableBody>
            </Table>

            {totalPages && totalPages > 1 && page && onPageChange && (
                <div className="border-t border-gray-100 px-4 py-3">
                    <Pagination>
                        <PaginationContent>
                            <PaginationItem>
                                <PaginationPrevious
                                    onClick={() =>
                                        page > 1 && onPageChange(page - 1)
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
                                    if (totalPages <= 5) {
                                        pageNum = i + 1;
                                    } else if (page <= 3) {
                                        pageNum = i + 1;
                                    } else if (page >= totalPages - 2) {
                                        pageNum = totalPages - 4 + i;
                                    } else {
                                        pageNum = page - 2 + i;
                                    }
                                    return (
                                        <PaginationItem key={pageNum}>
                                            <PaginationLink
                                                onClick={() =>
                                                    onPageChange(pageNum)
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
                                        onPageChange(page + 1)
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
        </div>
    );
}
