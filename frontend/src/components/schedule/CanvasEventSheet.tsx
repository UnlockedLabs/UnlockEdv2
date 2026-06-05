import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SessionDetailClassDetails } from './SessionDetailClassDetails';
import { FacilityProgramClassEvent } from '@/types';

interface CanvasEventSheetProps {
    event: FacilityProgramClassEvent;
    onClose: () => void;
    onViewClassDetails?: () => void;
}

function toClassTimeString(start: Date, end: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(start.getHours())}:${pad(start.getMinutes())}-${pad(end.getHours())}:${pad(end.getMinutes())}`;
}

export function CanvasEventSheet({ event, onClose, onViewClassDetails }: CanvasEventSheetProps) {
    const start = event.start instanceof Date ? event.start : new Date(event.start);
    const end = event.end instanceof Date ? event.end : new Date(event.end);

    const dateLabel = start.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric'
    });

    const isToday =
        new Date().toDateString() === start.toDateString();

    const classTime = toClassTimeString(start, end);

    return (
        <Sheet open onOpenChange={(open) => { if (!open) onClose(); }}>
            <SheetContent className="w-[400px] sm:w-[500px] p-0">
                <SheetHeader className="sr-only">
                    <SheetTitle>Canvas Event Details</SheetTitle>
                    <SheetDescription>View details for this Canvas event</SheetDescription>
                </SheetHeader>

                <div className="border-b border-gray-200 px-6 py-4">
                    <h3 className="text-[#203622] mb-2">{dateLabel}</h3>
                    <div className="flex items-center gap-2">
                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300">
                            Canvas
                        </Badge>
                        {isToday && (
                            <span className="text-sm text-blue-600">&bull; Today&apos;s class</span>
                        )}
                    </div>
                </div>

                <div className="px-6 py-6 space-y-6">
                    <SessionDetailClassDetails
                        className={event.title}
                        programName={event.program_name}
                        classTime={classTime}
                        room={event.room ?? ''}
                        instructorName={event.instructor_name || undefined}
                        isCancelled={false}
                        isRescheduledFrom={false}
                        isCancelledReschedule={false}
                    />

                    {onViewClassDetails && (
                        <div className="pt-6 border-t border-gray-200">
                            <Button
                                variant="outline"
                                className="w-full justify-start"
                                onClick={onViewClassDetails}
                            >
                                View Full Class Details →
                            </Button>
                        </div>
                    )}
                </div>
            </SheetContent>
        </Sheet>
    );
}
