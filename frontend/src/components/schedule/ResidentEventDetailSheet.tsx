import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription
} from '@/components/ui/sheet';
import { SessionDetailHeader } from './SessionDetailHeader';
import { SessionDetailClassDetails } from './SessionDetailClassDetails';
import { FacilityProgramClassEvent, SelectedClassStatus } from '@/types';

function toClassTimeRange(start: Date, end: Date): string {
    const fmt = (d: Date) =>
        `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    return `${fmt(start)}-${fmt(end)}`;
}

// Read-only equivalent of SessionDetailSheet for the resident Schedule tab:
// no mutate/undo hooks, no modify actions, no modals — just the two pure
// display sub-components a resident is allowed to see.
export function ResidentEventDetailSheet({
    event,
    onClose
}: {
    event: FacilityProgramClassEvent | null;
    onClose: () => void;
}) {
    if (!event) return null;

    const dateLabel = event.start.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric'
    });
    const isToday = new Date().toDateString() === event.start.toDateString();

    return (
        <Sheet open={!!event} onOpenChange={onClose}>
            <SheetContent className="w-100 sm:w-125 p-0">
                <SheetHeader className="sr-only">
                    <SheetTitle>Class Details</SheetTitle>
                    <SheetDescription>
                        View this class instance
                    </SheetDescription>
                </SheetHeader>

                <SessionDetailHeader
                    dateLabel={dateLabel}
                    isToday={isToday}
                    isCancelled={false}
                    isCancelledReschedule={false}
                    isRescheduledFrom={false}
                    isRescheduledTo={false}
                    hasAttendance={
                        event.class_status === SelectedClassStatus.Completed
                    }
                    isUpcoming={
                        event.class_status !== SelectedClassStatus.Completed &&
                        event.class_status !== SelectedClassStatus.Active
                    }
                    hideRescheduledBadge
                    showActiveBadge={
                        event.class_status === SelectedClassStatus.Active
                    }
                />

                <div className="px-6 py-6 space-y-6 flex-1 overflow-y-auto min-h-0">
                    <SessionDetailClassDetails
                        className={event.title}
                        programName={event.program_name}
                        classTime={toClassTimeRange(event.start, event.end)}
                        room={event.room}
                        instructorName={event.instructor_name}
                        isCancelled={false}
                        isRescheduledFrom={false}
                        isCancelledReschedule={false}
                    />
                </div>
            </SheetContent>
        </Sheet>
    );
}
