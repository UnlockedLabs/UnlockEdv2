import { Filter } from 'lucide-react';
import type { StatusFilter, TimeFilter } from './useSessionFilters';

interface FilterStats {
    completed: number;
    missing: number;
    upcoming: number;
    cancelled: number;
}

interface SessionsTabFilterBarProps {
    statusFilter: StatusFilter;
    timeFilter: TimeFilter;
    stats: FilterStats;
    hideTimeFilter: boolean;
    onStatusChange: (newStatus: StatusFilter) => void;
    onTimeChange: (newTime: TimeFilter) => void;
}

function FilterButton({
    active,
    onClick,
    children,
    disabled
}: {
    active: boolean;
    onClick: () => void;
    children: React.ReactNode;
    disabled?: boolean;
}) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={`text-sm px-3 py-1.5 rounded-md transition-colors ${
                disabled
                    ? 'bg-gray-50 text-gray-300 cursor-not-allowed'
                    : active
                      ? 'bg-[#556830] text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
        >
            {children}
        </button>
    );
}

function StatButton({
    active,
    onClick,
    colorClass,
    children
}: {
    active: boolean;
    onClick: () => void;
    colorClass: string;
    children: React.ReactNode;
}) {
    return (
        <button
            onClick={onClick}
            className={`text-xs px-3 py-1.5 rounded-md transition-colors ${
                active
                    ? `${colorClass} font-medium`
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
        >
            {children}
        </button>
    );
}

export function SessionsTabFilterBar({
    statusFilter,
    timeFilter,
    stats,
    hideTimeFilter,
    onStatusChange,
    onTimeChange
}: SessionsTabFilterBarProps) {
    return (
        <div className="border-b border-gray-200 px-6 py-4">
            <div className="flex items-center justify-between mb-3">
                <div>
                    <h3 className="text-[#203622]">Session Management</h3>
                    <p className="text-sm text-gray-600 mt-1">
                        View, cancel, or reschedule individual sessions
                    </p>
                </div>
                <div className="flex gap-2">
                    <StatButton
                        active={statusFilter === 'completed'}
                        onClick={() =>
                            onStatusChange(
                                statusFilter === 'completed'
                                    ? 'all'
                                    : 'completed'
                            )
                        }
                        colorClass="bg-green-100 text-[#556830]"
                    >
                        {stats.completed} Completed
                    </StatButton>
                    <StatButton
                        active={statusFilter === 'missing'}
                        onClick={() =>
                            onStatusChange(
                                statusFilter === 'missing'
                                    ? 'all'
                                    : 'missing'
                            )
                        }
                        colorClass="bg-amber-100 text-amber-700"
                    >
                        {stats.missing} Missing
                    </StatButton>
                    <StatButton
                        active={statusFilter === 'upcoming'}
                        onClick={() =>
                            onStatusChange(
                                statusFilter === 'upcoming'
                                    ? 'all'
                                    : 'upcoming'
                            )
                        }
                        colorClass="bg-blue-100 text-blue-700"
                    >
                        {stats.upcoming} Upcoming
                    </StatButton>
                    <StatButton
                        active={statusFilter === 'cancelled'}
                        onClick={() =>
                            onStatusChange(
                                statusFilter === 'cancelled'
                                    ? 'all'
                                    : 'cancelled'
                            )
                        }
                        colorClass="bg-gray-100 text-gray-700"
                    >
                        {stats.cancelled} Cancelled
                    </StatButton>
                </div>
            </div>

            <div className="flex items-center gap-3">
                <Filter className="size-4 text-gray-400" />
                <div className="flex gap-2 flex-1">
                    <FilterButton
                        active={statusFilter === 'all'}
                        onClick={() => onStatusChange('all')}
                    >
                        All Sessions
                    </FilterButton>
                    <FilterButton
                        active={statusFilter === 'completed'}
                        onClick={() => onStatusChange('completed')}
                    >
                        Completed
                    </FilterButton>
                    <FilterButton
                        active={statusFilter === 'missing'}
                        onClick={() => onStatusChange('missing')}
                    >
                        Missing
                    </FilterButton>
                    <FilterButton
                        active={statusFilter === 'upcoming'}
                        onClick={() => onStatusChange('upcoming')}
                    >
                        Upcoming
                    </FilterButton>
                </div>
                <div className="h-6 w-px bg-gray-300" />
                <div className="flex gap-2">
                    <FilterButton
                        active={timeFilter === 'week'}
                        onClick={() => onTimeChange('week')}
                        disabled={hideTimeFilter}
                    >
                        Last Week
                    </FilterButton>
                    <FilterButton
                        active={timeFilter === '2weeks'}
                        onClick={() => onTimeChange('2weeks')}
                        disabled={hideTimeFilter}
                    >
                        Last 2 Weeks
                    </FilterButton>
                    <FilterButton
                        active={timeFilter === 'month'}
                        onClick={() => onTimeChange('month')}
                        disabled={hideTimeFilter}
                    >
                        Last Month
                    </FilterButton>
                    <FilterButton
                        active={timeFilter === 'all'}
                        onClick={() => onTimeChange('all')}
                        disabled={hideTimeFilter}
                    >
                        All Time
                    </FilterButton>
                </div>
            </div>
        </div>
    );
}
