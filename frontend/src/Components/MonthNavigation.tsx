import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';

interface MonthNavigationProps {
    currentMonth: string; // YYYY-MM format
    onMonthChange: (month: string) => void;
    hasEarlierClasses?: boolean; // Whether earlier months have classes
    hasLaterClasses?: boolean; // Whether later months have classes
}

export default function MonthNavigation({
    currentMonth,
    onMonthChange,
    hasEarlierClasses = true, // Default to true for backward compatibility
    hasLaterClasses = true // Default to true for backward compatibility
}: MonthNavigationProps) {
    const [year, month] = currentMonth.split('-').map(Number);

    const currentMonthYear = new Date().toISOString().substring(0, 7);
    const isCurrentMonth = currentMonth === currentMonthYear;

    const formatMonthYear = (dateStr: string): string => {
        const [y, m] = dateStr.split('-').map(Number);
        const date = new Date(y, m - 1);
        return date.toLocaleDateString('en-US', {
            month: 'long',
            year: 'numeric'
        });
    };

    const getPreviousMonth = (): string => {
        const prevDate = new Date(year, month - 2); // month - 2 because JS months are 0-indexed
        return `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
    };

    const getNextMonth = (): string => {
        const nextDate = new Date(year, month); // month is already correct for next month
        return `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`;
    };

    const goToPreviousMonth = () => {
        if (hasEarlierClasses) {
            onMonthChange(getPreviousMonth());
        }
    };

    const goToNextMonth = () => {
        if (hasLaterClasses) {
            onMonthChange(getNextMonth());
        }
    };

    const goToThisMonth = () => {
        onMonthChange(currentMonthYear);
    };

    return (
        <div className="flex items-center justify-between mb-6 p-4 bg-grey-1 rounded-lg">
            <div className="flex items-center gap-4">
                <button
                    onClick={goToPreviousMonth}
                    disabled={!hasEarlierClasses}
                    className={`flex items-center gap-2 px-3 py-2 rounded-md transition-colors ${
                        hasEarlierClasses
                            ? 'text-teal-4 hover:bg-grey-2 cursor-pointer'
                            : 'text-grey-3 cursor-not-allowed'
                    }`}
                    aria-label="Previous month"
                >
                    <ChevronLeftIcon className="h-5 w-5" />
                    Previous
                </button>

                <h2 className="text-xl font-semibold text-teal-4 min-w-[200px] text-center">
                    {formatMonthYear(currentMonth)}
                </h2>

                <button
                    onClick={goToNextMonth}
                    disabled={!hasLaterClasses}
                    className={`flex items-center gap-2 px-3 py-2 rounded-md transition-colors ${
                        hasLaterClasses
                            ? 'text-teal-4 hover:bg-grey-2 cursor-pointer'
                            : 'text-grey-3 cursor-not-allowed'
                    }`}
                    aria-label="Next month"
                >
                    Next
                    <ChevronRightIcon className="h-5 w-5" />
                </button>
            </div>

            {!isCurrentMonth && (
                <button
                    onClick={goToThisMonth}
                    className="px-4 py-2 bg-teal-4 text-white rounded-md hover:bg-teal-5 transition-colors"
                >
                    This Month
                </button>
            )}
        </div>
    );
}
