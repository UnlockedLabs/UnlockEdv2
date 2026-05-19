import { CalendarOff, CalendarClock, CheckCircle, MapPin, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SessionDetailStatusSectionProps {
    isCancelled: boolean;
    isCancelledReschedule: boolean;
    isRescheduledFrom: boolean;
    isRescheduledTo: boolean;
    hasAttendance: boolean;

    originalInstructorName?: string;
    instructorName?: string;
    originalRoom?: string;
    room: string;
    cancellationReason?: string;
    rescheduledDate?: string;
    cancellationActionLabel: string;

    onUndo: () => void;
    onUndoCancel?: () => void;
    onUndoReschedule?: () => void;
    onClose: () => void;
}

export function SessionDetailStatusSection({
    isCancelled,
    isCancelledReschedule,
    isRescheduledFrom,
    isRescheduledTo,
    hasAttendance,
    originalInstructorName,
    instructorName,
    originalRoom,
    room,
    cancellationReason,
    rescheduledDate,
    cancellationActionLabel,
    onUndo,
    onUndoCancel,
    onUndoReschedule,
    onClose
}: SessionDetailStatusSectionProps) {
    const visible =
        isCancelled ||
        isCancelledReschedule ||
        isRescheduledFrom ||
        isRescheduledTo ||
        hasAttendance ||
        (!isCancelled && (originalInstructorName ?? originalRoom));

    if (!visible) return null;

    return (
        <div className="pt-6 border-t border-gray-200">
            <h4 className="text-sm text-gray-700 mb-3">
                Status
            </h4>
            <div className="space-y-4">

            {!isCancelled && originalInstructorName && instructorName && (
                <div className="flex items-start gap-2">
                    <Users className="size-4 text-gray-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                        <div className="text-sm text-gray-900 mb-1">Instructor Change</div>
                        <p className="text-sm text-gray-600">
                            Session Instructor: {instructorName}
                        </p>
                    </div>
                </div>
            )}

            {!isCancelled && originalRoom && (
                <div className="flex items-start gap-2">
                    <MapPin className="size-4 text-gray-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                        <div className="text-sm text-gray-900 mb-1">Room Change</div>
                        <p className="text-sm text-gray-600">
                            Session Room: {room}
                        </p>
                    </div>
                </div>
            )}

            {isCancelledReschedule && (
                <div className="space-y-4">
                    <div className="space-y-3">
                        <div className="flex items-start gap-2">
                            <CalendarOff className="size-4 text-gray-600 mt-0.5 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                                <div className="text-sm text-gray-900 mb-1">
                                    Class Cancelled
                                </div>
                                {cancellationReason && (
                                    <p className="text-sm text-gray-600">
                                        {cancellationReason}
                                    </p>
                                )}
                            </div>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                if (onUndoCancel) onUndoCancel();
                                onClose();
                            }}
                            className="w-full"
                        >
                            {cancellationActionLabel}
                        </Button>
                    </div>
                    {rescheduledDate && (
                        <div className="space-y-3">
                            <div className="flex items-start gap-2">
                                <CalendarClock className="size-4 text-blue-700 mt-0.5 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm text-gray-900 mb-1">
                                        Rescheduled Class
                                    </div>
                                    <p className="text-sm text-gray-600">
                                        Originally scheduled for{' '}
                                        {new Date(rescheduledDate + 'T00:00:00').toLocaleDateString('en-US', {
                                            weekday: 'long',
                                            month: 'long',
                                            day: 'numeric'
                                        })}
                                    </p>
                                </div>
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                    if (onUndoReschedule) onUndoReschedule();
                                    onClose();
                                }}
                                className="w-full"
                            >
                                Undo Reschedule
                            </Button>
                        </div>
                    )}
                </div>
            )}

            {isRescheduledFrom && !isRescheduledTo && rescheduledDate && (
                <div className="space-y-3">
                    <div className="flex items-start gap-2">
                        <CalendarClock className="size-4 text-gray-500 mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                            <div className="text-sm text-gray-900 mb-1">
                                Class Rescheduled
                            </div>
                            <p className="text-sm text-gray-600">
                                Moved to{' '}
                                {new Date(rescheduledDate + 'T00:00:00').toLocaleDateString('en-US', {
                                    weekday: 'long',
                                    month: 'long',
                                    day: 'numeric'
                                })}
                            </p>
                        </div>
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={onUndo}
                        className="w-full"
                    >
                        Undo Reschedule
                    </Button>
                </div>
            )}

            {isRescheduledTo && (
                <div className="space-y-3">
                    <div className="flex items-start gap-2">
                        <CalendarClock className="size-4 text-blue-700 mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                            <div className="text-sm text-gray-900 mb-1">
                                Rescheduled Class
                            </div>
                            {rescheduledDate && (
                                <p className="text-sm text-gray-600">
                                    Originally scheduled for{' '}
                                    {new Date(rescheduledDate + 'T00:00:00').toLocaleDateString('en-US', {
                                        weekday: 'long',
                                        month: 'long',
                                        day: 'numeric'
                                    })}
                                </p>
                            )}
                        </div>
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={onUndo}
                        className="w-full"
                    >
                        Undo Reschedule
                    </Button>
                </div>
            )}

            {isCancelled && (
                <div className="space-y-3">
                    <div className="flex items-start gap-2">
                        <CalendarOff className="size-4 text-gray-600 mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                            <div className="text-sm text-gray-900 mb-1">
                                Class Cancelled
                            </div>
                            {cancellationReason && (
                                <p className="text-sm text-gray-600">
                                    {cancellationReason}
                                </p>
                            )}
                        </div>
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={onUndo}
                        className="w-full"
                    >
                        {cancellationActionLabel}
                    </Button>
                </div>
            )}

            {hasAttendance && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-start gap-2">
                        <CheckCircle className="size-4 text-[#556830] mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                            <div className="text-sm text-[#556830] mb-1">
                                Attendance Taken
                            </div>
                            <p className="text-sm text-gray-600">
                                This class cannot be
                                modified because attendance
                                has been recorded.
                            </p>
                        </div>
                    </div>
                </div>
            )}
            </div>
        </div>
    );
}
