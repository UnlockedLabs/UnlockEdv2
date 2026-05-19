import { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';

interface StatusFlags {
    isCancelled: boolean;
    isCancelledReschedule: boolean;
    isRescheduledFrom: boolean;
    isRescheduledTo: boolean;
    hasAttendance: boolean;
    isUpcoming: boolean;
    hideRescheduledBadge: boolean;
    showActiveBadge: boolean;
}

function getStatusBadge(flags: StatusFlags): ReactNode {
    const {
        isCancelled,
        isCancelledReschedule,
        isRescheduledFrom,
        isRescheduledTo,
        hasAttendance,
        isUpcoming,
        hideRescheduledBadge,
        showActiveBadge
    } = flags;

    if (isCancelled || isCancelledReschedule) {
        return (
            <Badge
                variant="outline"
                className="bg-gray-100 text-gray-700 border-gray-300"
            >
                Cancelled
            </Badge>
        );
    }
    if (isRescheduledFrom && !hideRescheduledBadge) {
        return (
            <Badge
                variant="outline"
                className="bg-gray-100 text-gray-600 border-gray-300"
            >
                Rescheduled
            </Badge>
        );
    }
    if (isRescheduledTo && !hideRescheduledBadge) {
        return (
            <Badge
                variant="outline"
                className="bg-blue-50 text-blue-700 border-blue-300"
            >
                Rescheduled Class
            </Badge>
        );
    }
    if (hasAttendance) {
        return (
            <Badge
                variant="outline"
                className="bg-green-50 text-[#556830] border-green-200"
            >
                Completed
            </Badge>
        );
    }
    if (showActiveBadge) {
        return (
            <Badge
                variant="outline"
                className="bg-green-50 text-[#556830] border-green-200"
            >
                Active
            </Badge>
        );
    }
    if (isUpcoming) {
        return (
            <Badge
                variant="outline"
                className="bg-gray-50 text-gray-600 border-gray-200"
            >
                Scheduled
            </Badge>
        );
    }
    return (
        <Badge
            variant="outline"
            className="bg-amber-50 text-amber-700 border-amber-200"
        >
            Missing Attendance
        </Badge>
    );
}

interface SessionDetailHeaderProps extends StatusFlags {
    dateLabel: string;
    isToday: boolean;
}

export function SessionDetailHeader(props: SessionDetailHeaderProps) {
    const {
        dateLabel,
        isToday,
        isCancelled,
        isRescheduledFrom,
        isCancelledReschedule
    } = props;
    return (
        <div className="border-b border-gray-200 px-6 py-4">
            <div>
                <h3
                    className={`text-[#203622] mb-2 ${isCancelled || isRescheduledFrom || isCancelledReschedule ? 'line-through' : ''}`}
                >
                    {dateLabel}
                </h3>
                <div className="flex items-center gap-2">
                    {getStatusBadge(props)}
                    {isToday && (
                        <span className="text-sm text-blue-600">
                            &bull; Today&apos;s class
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}
