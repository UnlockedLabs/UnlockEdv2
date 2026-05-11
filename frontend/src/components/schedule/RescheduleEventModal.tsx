import { Calendar, Repeat } from 'lucide-react';
import { FacilityProgramClassEvent } from '@/types';
import { FormModal } from '@/components/shared/FormModal';

interface RescheduleEventModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    event: FacilityProgramClassEvent;
    onSingleSession: () => void;
    onSeriesReschedule: () => void;
}

export function RescheduleEventModal({
    open,
    onOpenChange,
    event,
    onSingleSession,
    onSeriesReschedule
}: RescheduleEventModalProps) {
    const sessionDateShort = event.start.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });

    const sessionDateLong = event.start.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric'
    });

    return (
        <FormModal
            open={open}
            onOpenChange={onOpenChange}
            title="Reschedule Class"
            description={`Select what you would like to reschedule for the class on ${sessionDateLong}`}
        >
            <div className="space-y-3 py-4">
                <button
                    onClick={onSingleSession}
                    className="w-full flex items-start gap-3 p-4 border-2 border-gray-200 rounded-lg hover:border-[#556830] hover:bg-gray-50 cursor-pointer transition-all text-left"
                >
                    <Calendar className="size-5 text-[#556830] mt-0.5 shrink-0" />
                    <div className="flex-1">
                        <div className="font-medium text-[#203622] mb-1">This session only</div>
                        <p className="text-sm text-gray-600">
                            Reschedule only the session on {sessionDateShort}
                        </p>
                    </div>
                </button>

                <button
                    onClick={onSeriesReschedule}
                    className="w-full flex items-start gap-3 p-4 border-2 border-gray-200 rounded-lg hover:border-[#556830] hover:bg-gray-50 cursor-pointer transition-all text-left"
                >
                    <Repeat className="size-5 text-[#556830] mt-0.5 shrink-0" />
                    <div className="flex-1">
                        <div className="font-medium text-[#203622] mb-1">This and all future sessions</div>
                        <p className="text-sm text-gray-600">
                            Change the recurring schedule pattern starting from {sessionDateShort} onwards
                        </p>
                    </div>
                </button>
            </div>
        </FormModal>
    );
}
