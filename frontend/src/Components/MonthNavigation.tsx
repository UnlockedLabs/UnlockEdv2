import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import {
    getPreviousMonth,
    getNextMonth,
    formatMonthYear,
    getCurrentMonth
} from '@/Components/helperFunctions/formatting';

interface MonthNavigationProps {
    currentMonth: string;
    onMonthChange: (month: string) => void;
    showPrevious?: boolean;
    showNext?: boolean;
}

export default function MonthNavigation({
    currentMonth,
    onMonthChange,
    showPrevious = true,
    showNext = true
}: MonthNavigationProps) {
    const currentMonthYear = getCurrentMonth();
    const isCurrentMonth = currentMonth === currentMonthYear;

    const goToPreviousMonth = () => {
        if (showPrevious) {
            onMonthChange(getPreviousMonth(currentMonth));
        }
    };

    const goToNextMonth = () => {
        if (showNext) {
            onMonthChange(getNextMonth(currentMonth));
        }
    };

    const goToThisMonth = () => {
        onMonthChange(currentMonthYear);
    };

    return (
        <div className="flex items-center justify-between mb-6 py-3 px-4 border border-grey-1 rounded-lg bg-white shadow-sm">
            <button
                onClick={goToPreviousMonth}
                disabled={!showPrevious}
                className={`flex items-center gap-2 px-4 py-3 rounded-md transition-colors ${
                    showPrevious
                        ? 'text-teal-4 hover:bg-grey-1 cursor-pointer'
                        : 'text-grey-3 cursor-default'
                }`}
                aria-label="Previous month"
            >
                <ChevronLeftIcon className="h-5 w-5" />
                Previous
            </button>

            <h2 className="text-xl font-semibold text-teal-4 px-4 py-3 text-center flex-1 max-w-[300px]">
                {formatMonthYear(currentMonth)}
            </h2>

            <button
                onClick={goToNextMonth}
                disabled={!showNext}
                className={`flex items-center gap-2 px-4 py-3 rounded-md transition-colors ${
                    showNext
                        ? 'text-teal-4 hover:bg-grey-1 cursor-pointer'
                        : 'text-grey-3 cursor-default'
                }`}
                aria-label="Next month"
            >
                Next
                <ChevronRightIcon className="h-5 w-5" />
            </button>

            <button
                onClick={goToThisMonth}
                disabled={isCurrentMonth}
                className={`ml-4 px-4 py-3 rounded-md transition-colors border ${
                    isCurrentMonth
                        ? 'bg-grey-1 text-grey-3 border-grey-2 cursor-default'
                        : 'bg-teal-1 text-teal-4 border-teal-3 hover:bg-teal-2 cursor-pointer'
                }`}
            >
                This Month
            </button>
        </div>
    );
}
