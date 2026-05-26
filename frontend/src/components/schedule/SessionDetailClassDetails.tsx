import { Calendar, Clock, MapPin, Users } from 'lucide-react';
import { formatClassTimeRange } from '@/lib/formatters';

interface SessionDetailClassDetailsProps {
    className: string;
    programName?: string;
    classTime: string;
    room: string;
    originalRoom?: string;
    instructorName?: string;
    originalInstructorName?: string;
    isCancelled: boolean;
    isRescheduledFrom: boolean;
    isCancelledReschedule: boolean;
}

export function SessionDetailClassDetails({
    className,
    programName,
    classTime,
    room,
    originalRoom,
    instructorName,
    originalInstructorName,
    isCancelled,
    isRescheduledFrom,
    isCancelledReschedule
}: SessionDetailClassDetailsProps) {
    return (
        <div>
            <h4 className="text-sm text-gray-700 mb-3">
                Class Details
            </h4>
            <div className="space-y-3">
                <div className="flex items-start gap-3">
                    <Calendar className="lead-icon" />
                    <div className="flex-1 min-w-0">
                        <div className="text-sm text-gray-600 mb-0.5">
                            Class
                        </div>
                        <div className="text-brand-dark">
                            {className}
                        </div>
                        {programName && (
                            <div className="text-sm text-gray-500">
                                {programName}
                            </div>
                        )}
                    </div>
                </div>
                <div className="flex items-start gap-3">
                    <Clock className="lead-icon" />
                    <div className="flex-1 min-w-0">
                        <div className="text-sm text-gray-600 mb-0.5">
                            Time
                        </div>
                        <div
                            className={`text-brand-dark ${isCancelled || isRescheduledFrom || isCancelledReschedule ? 'line-through' : ''}`}
                        >
                            {formatClassTimeRange(classTime)}
                        </div>
                    </div>
                </div>
                <div className="flex items-start gap-3">
                    <MapPin className="lead-icon" />
                    <div className="flex-1 min-w-0">
                        <div className="text-sm text-gray-600 mb-0.5">
                            Room
                        </div>
                        <div
                            className={`text-brand-dark ${
                                !!originalRoom || isCancelled || isRescheduledFrom || isCancelledReschedule
                                    ? 'line-through'
                                    : ''
                            }`}
                        >
                            {originalRoom ?? room}
                        </div>
                    </div>
                </div>
                {(originalInstructorName ?? instructorName) && (
                    <div className="flex items-start gap-3">
                        <Users className="lead-icon" />
                        <div className="flex-1 min-w-0">
                            <div className="text-sm text-gray-600 mb-0.5">
                                Instructor
                            </div>
                            <div
                                className={`text-brand-dark ${
                                    !!originalInstructorName || isCancelled || isRescheduledFrom || isCancelledReschedule
                                        ? 'line-through'
                                        : ''
                                }`}
                            >
                                {originalInstructorName ?? instructorName}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
