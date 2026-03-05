import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
    currentPage: number;
    totalItems: number;
    itemsPerPage: number;
    onPageChange: (page: number) => void;
    onItemsPerPageChange: (itemsPerPage: number) => void;
    itemLabel?: string;
}

function getPageNumbers(currentPage: number, totalPages: number) {
    const pages: (number | string)[] = [];

    if (totalPages <= 7) {
        for (let i = 1; i <= totalPages; i++) pages.push(i);
        return pages;
    }

    pages.push(1);
    if (currentPage > 3) pages.push('...');

    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);
    for (let i = start; i <= end; i++) pages.push(i);

    if (currentPage < totalPages - 2) pages.push('...');
    pages.push(totalPages);

    return pages;
}

export function Pagination({
    currentPage,
    totalItems,
    itemsPerPage,
    onPageChange,
    onItemsPerPageChange,
    itemLabel = 'items'
}: PaginationProps) {
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const startItem = totalItems === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
    const endItem = Math.min(currentPage * itemsPerPage, totalItems);

    return (
        <div className="bg-white dark:bg-[#171717] border-t border-gray-200 dark:border-[#262626] px-6 py-4 rounded-b-lg">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-6">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                        Showing{' '}
                        <span className="font-medium text-gray-900 dark:text-white">
                            {startItem}-{endItem}
                        </span>{' '}
                        of{' '}
                        <span className="font-medium text-gray-900 dark:text-white">
                            {totalItems}
                        </span>{' '}
                        {itemLabel}
                    </p>
                    <div className="flex items-center gap-2">
                        <label
                            htmlFor="items-per-page"
                            className="text-sm text-gray-600 dark:text-gray-400"
                        >
                            Items per page:
                        </label>
                        <select
                            id="items-per-page"
                            value={itemsPerPage}
                            onChange={(e) => {
                                onItemsPerPageChange(Number(e.target.value));
                                onPageChange(1);
                            }}
                            className="bg-white dark:bg-[#262626] text-gray-900 dark:text-white px-3 py-1.5 rounded border border-gray-200 dark:border-[#404040] text-sm focus:outline-none focus:ring-2 focus:ring-[#556830] dark:focus:ring-[#8fb55e]"
                        >
                            <option value={10}>10</option>
                            <option value={20}>20</option>
                            <option value={40}>40</option>
                            <option value={80}>80</option>
                        </select>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => onPageChange(currentPage - 1)}
                        disabled={currentPage <= 1}
                        className="p-2 rounded-lg border border-gray-200 dark:border-[#404040] text-gray-600 dark:text-gray-400 hover:bg-[#E2E7EA] dark:hover:bg-[#262626] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        aria-label="Previous page"
                    >
                        <ChevronLeft className="size-5" />
                    </button>

                    <div className="flex items-center gap-1">
                        {getPageNumbers(currentPage, totalPages).map(
                            (page, index) => {
                                if (page === '...') {
                                    return (
                                        <span
                                            key={`ellipsis-${index}`}
                                            className="px-3 py-2 text-gray-600 dark:text-gray-400"
                                        >
                                            ...
                                        </span>
                                    );
                                }
                                const num = page as number;
                                return (
                                    <button
                                        key={num}
                                        onClick={() => onPageChange(num)}
                                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                                            num === currentPage
                                                ? 'bg-[#556830] text-white'
                                                : 'text-gray-600 dark:text-gray-400 hover:bg-[#E2E7EA] dark:hover:bg-[#262626]'
                                        }`}
                                    >
                                        {num}
                                    </button>
                                );
                            }
                        )}
                    </div>

                    <button
                        onClick={() => onPageChange(currentPage + 1)}
                        disabled={currentPage >= totalPages}
                        className="p-2 rounded-lg border border-gray-200 dark:border-[#404040] text-gray-600 dark:text-gray-400 hover:bg-[#E2E7EA] dark:hover:bg-[#262626] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        aria-label="Next page"
                    >
                        <ChevronRight className="size-5" />
                    </button>
                </div>
            </div>
        </div>
    );
}
