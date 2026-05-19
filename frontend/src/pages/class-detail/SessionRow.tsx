import {
    Calendar,
    AlertCircle,
    CheckCircle,
    CalendarClock,
    CalendarOff,
    X,
    Undo2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { formatClassTimeRange } from '@/lib/formatters';
import { formatShortDate, type SessionDisplay } from './session-utils';

interface SessionRowProps {
    session: SessionDisplay;
    selected: boolean;
    onToggle: () => void;
    onClick: () => void;
    onNavigateToAttendance: () => void;
    onCancel: () => void;
    onReschedule: () => void;
    onUndo: () => void;
    onUndoCancel: () => void;
}

export function SessionRow({
    session,
    selected,
    onToggle,
    onClick,
    onNavigateToAttendance,
    onCancel,
    onReschedule,
    onUndo,
    onUndoCancel
}: SessionRowProps) {
    const dateLabel = session.dateObj.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric'
    });

    const {
        isCancelled,
        isRescheduledFrom,
        isRescheduledTo,
        isCancelledReschedule,
        isToday,
        hasAttendance,
        isPast,
        isUpcoming,
        rescheduledDate,
        rescheduledClassTime
    } = session;

    // Time-only reschedule (same date) renders as a "to" row, not a "from" row.
    const isSameDateReschedule = isRescheduledFrom && isRescheduledTo && rescheduledDate === session.instance.date;
    const treatAsFrom = isRescheduledFrom && !isSameDateReschedule;
    const treatAsTo = isRescheduledTo || isSameDateReschedule;

    const getBorderClass = () => {
        if (treatAsFrom)
            return 'border-gray-300 border-dashed bg-gray-50 hover:bg-gray-100';
        if (isCancelledReschedule)
            return 'border-gray-300 bg-gray-100 hover:bg-gray-200';
        if (treatAsTo)
            return 'border-blue-300 bg-blue-50 hover:bg-blue-100';
        if (isCancelled)
            return 'border-gray-300 bg-gray-100 hover:bg-gray-200';
        if (isToday) return 'border-blue-200 bg-blue-50 hover:bg-blue-100';
        if (hasAttendance) return 'border-gray-200 hover:bg-[#E2E7EA]/30';
        if (isPast)
            return 'border-amber-200 bg-amber-50/30 hover:bg-amber-50';
        return 'border-gray-200 bg-gray-50 hover:bg-[#E2E7EA]/30';
    };

    const getIcon = () => {
        if (treatAsFrom)
            return (
                <CalendarClock className="size-5 text-gray-400 flex-shrink-0" />
            );
        if (treatAsTo)
            return (
                <CalendarClock className="size-5 text-blue-700 flex-shrink-0" />
            );
        if (isCancelled)
            return (
                <CalendarOff className="size-5 text-gray-500 flex-shrink-0" />
            );
        if (hasAttendance)
            return (
                <CheckCircle className="size-5 text-[#556830] flex-shrink-0" />
            );
        if (isPast)
            return (
                <AlertCircle className="size-5 text-[#F1B51C] flex-shrink-0" />
            );
        return <Calendar className="size-5 text-gray-400 flex-shrink-0" />;
    };

    const showCheckbox =
        isUpcoming && !isCancelled && !treatAsFrom && !isCancelledReschedule;
    const showLineThrough = isCancelled || treatAsFrom || isCancelledReschedule;

    return (
        <div
            onClick={onClick}
            className={`flex items-center justify-between p-4 rounded-lg border transition-colors cursor-pointer ${getBorderClass()}`}
        >
            <div className="flex items-center gap-4 min-w-0">
                {showCheckbox && (
                    <Checkbox
                        checked={selected}
                        onCheckedChange={() => onToggle()}
                        onClick={(e) => e.stopPropagation()}
                    />
                )}
                {getIcon()}
                <div className="min-w-0">
                    <div className="text-sm font-medium text-[#203622]">
                        <span
                            className={showLineThrough ? 'line-through' : ''}
                        >
                            {session.dayName}, {dateLabel}
                        </span>
                        {isToday && (
                            <Badge className="ml-2 bg-blue-500 text-white">
                                Today
                            </Badge>
                        )}
                        {isCancelled && (
                            <Badge
                                variant="outline"
                                className="ml-2 bg-gray-100 text-gray-600 border-gray-300"
                            >
                                Cancelled
                            </Badge>
                        )}
                        {treatAsFrom && (
                            <Badge
                                variant="outline"
                                className="ml-2 bg-gray-100 text-gray-600 border-gray-300"
                            >
                                Rescheduled
                            </Badge>
                        )}
                        {treatAsTo && (
                            <Badge
                                variant="outline"
                                className="ml-2 bg-blue-100 text-blue-800 border-blue-300"
                            >
                                Rescheduled Class
                            </Badge>
                        )}
                        {isCancelledReschedule && (
                            <>
                                <Badge
                                    variant="outline"
                                    className="ml-2 bg-gray-100 text-gray-600 border-gray-300"
                                >
                                    Cancelled
                                </Badge>
                                <Badge
                                    variant="outline"
                                    className="ml-2 bg-blue-100 text-blue-800 border-blue-300"
                                >
                                    Rescheduled Class
                                </Badge>
                            </>
                        )}
                    </div>
                    {treatAsFrom && rescheduledDate ? (
                        <div className="text-xs text-gray-500 mt-0.5">
                            &rarr; Moved to {formatShortDate(rescheduledDate)}
                            {rescheduledClassTime &&
                                ` at ${formatClassTimeRange(rescheduledClassTime)}`}
                        </div>
                    ) : (treatAsTo || isCancelledReschedule) ? (
                        <div className="text-xs text-blue-700 mt-0.5">
                            {formatClassTimeRange(session.instance.class_time)}
                        </div>
                    ) : (
                        <div
                            className={`text-xs text-gray-600 mt-0.5 ${showLineThrough ? 'line-through' : ''}`}
                        >
                            {formatClassTimeRange(session.instance.class_time)}
                        </div>
                    )}
                </div>
            </div>
            <div
                className="flex items-center gap-4"
                onClick={(e) => e.stopPropagation()}
            >
                {hasAttendance && !treatAsFrom && (
                    <div className="text-sm text-gray-600 whitespace-nowrap">
                        {session.attendedCount} / {session.totalEnrolled}{' '}
                        attended (
                        {session.totalEnrolled > 0
                            ? Math.round(
                                  (session.attendedCount /
                                      session.totalEnrolled) *
                                      100
                              )
                            : 0}
                        %)
                    </div>
                )}
                {isPast &&
                    !hasAttendance &&
                    !isCancelled &&
                    !treatAsFrom && (
                        <Badge
                            variant="outline"
                            className="bg-amber-50 text-amber-700 border-amber-200"
                        >
                            Missing
                        </Badge>
                    )}
                {!isCancelled &&
                    !isUpcoming &&
                    !treatAsFrom && (
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onNavigateToAttendance()}
                            className="border-gray-300"
                        >
                            {hasAttendance ? 'Edit' : 'Take'} Attendance
                        </Button>
                    )}
                {isCancelled && isUpcoming && (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onUndo()}
                        className="border-gray-300 hover:bg-gray-50"
                    >
                        <Undo2 className="size-4 mr-1.5" />
                        Undo
                    </Button>
                )}
                {isRescheduledFrom && isUpcoming && (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onUndo()}
                        className="border-amber-300 hover:bg-amber-50"
                    >
                        <Undo2 className="size-4 mr-1.5" />
                        Undo
                    </Button>
                )}
                {isCancelledReschedule && isUpcoming && (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onUndoCancel()}
                        className="border-gray-300 hover:bg-gray-50"
                    >
                        <Undo2 className="size-4 mr-1.5" />
                        Undo
                    </Button>
                )}
                {isRescheduledTo && isUpcoming && !isSameDateReschedule && (
                    <>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onReschedule()}
                            className="border-gray-300 hover:bg-gray-50"
                        >
                            <CalendarClock className="size-4 mr-1.5" />
                            Reschedule
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onUndo()}
                            className="border-gray-300 hover:bg-gray-50"
                            title="Undo reschedule"
                        >
                            <Undo2 className="size-4" />
                        </Button>
                    </>
                )}
                {isUpcoming &&
                    !isCancelled &&
                    !treatAsFrom &&
                    !treatAsTo &&
                    !isCancelledReschedule && (
                        <>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => onReschedule()}
                                className="border-gray-300 hover:bg-gray-50"
                            >
                                <CalendarClock className="size-4 mr-1.5" />
                                Reschedule
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => onCancel()}
                                className="border-gray-300 text-red-600 hover:bg-red-50 hover:text-red-700 hover:border-red-200"
                            >
                                <X className="size-4 mr-1.5" />
                                Cancel
                            </Button>
                        </>
                    )}
            </div>
        </div>
    );
}
