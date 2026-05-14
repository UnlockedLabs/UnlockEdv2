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
                    <Calendar className="size-5 text-gray-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                        <div className="text-sm text-gray-600 mb-0.5">
                            Class
                        </div>
                        <div className="text-[#203622]">
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
                    <Clock className="size-5 text-gray-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                        <div className="text-sm text-gray-600 mb-0.5">
                            Time
                        </div>
                        <div
                            className={`text-[#203622] ${isCancelled || isRescheduledFrom || isCancelledReschedule ? 'line-through' : ''}`}
                        >
                            {formatClassTimeRange(classTime)}
                        </div>
                    </div>
                </div>
                <div className="flex items-start gap-3">
                    <MapPin className="size-5 text-gray-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                        <div className="text-sm text-gray-600 mb-0.5">
                            Room
                        </div>
                        <div
                            className={`text-[#203622] ${
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
                        <Users className="size-5 text-gray-400 mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                            <div className="text-sm text-gray-600 mb-0.5">
                                Instructor
                            </div>
                            <div
                                className={`text-[#203622] ${
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
