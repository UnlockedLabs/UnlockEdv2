import { CalendarClock, CalendarOff, CheckCircle, MapPin, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SessionDetailActionsProps {
    canModify: boolean;
    showTakeAttendance: boolean;
    isCancelled: boolean;
    onTakeAttendance?: () => void;
    onRescheduleClick: () => void;
    onCancelClick: () => void;
    onChangeInstructorClick: () => void;
    onChangeRoomClick: () => void;
    onViewClassDetails?: () => void;
}

export function SessionDetailActions({
    canModify,
    showTakeAttendance,
    isCancelled,
    onTakeAttendance,
    onRescheduleClick,
    onCancelClick,
    onChangeInstructorClick,
    onChangeRoomClick,
    onViewClassDetails
}: SessionDetailActionsProps) {
    return (
        <>
            {(canModify || showTakeAttendance) && (
                <div className="pt-6 border-t border-gray-200">
                    <h4 className="text-sm text-gray-700 mb-3">
                        Actions
                    </h4>
                    <div className="space-y-2">
                        {showTakeAttendance && onTakeAttendance && (
                            <Button
                                className="w-full justify-start bg-[#556830] hover:bg-[#203622] text-white"
                                onClick={onTakeAttendance}
                            >
                                <CheckCircle className="size-4 mr-2" />
                                Take Attendance
                            </Button>
                        )}
                        {canModify && (
                            <>
                                <Button
                                    variant="outline"
                                    onClick={onRescheduleClick}
                                    className="w-full justify-start border-gray-300 hover:bg-gray-50"
                                >
                                    <CalendarClock className="size-4 mr-2" />
                                    Reschedule This Class
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={onCancelClick}
                                    className="w-full justify-start border-gray-300 text-red-600 hover:bg-red-50 hover:text-red-700 hover:border-red-200"
                                >
                                    <CalendarOff className="size-4 mr-2" />
                                    Cancel This Class
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={onChangeInstructorClick}
                                    className="w-full justify-start border-gray-300 hover:bg-gray-50"
                                >
                                    <Users className="size-4 mr-2" />
                                    Change Instructor
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={onChangeRoomClick}
                                    className="w-full justify-start border-gray-300 hover:bg-gray-50"
                                >
                                    <MapPin className="size-4 mr-2" />
                                    Change Room
                                </Button>
                            </>
                        )}
                    </div>
                </div>
            )}

            {onViewClassDetails && !isCancelled && (
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
        </>
    );
}
