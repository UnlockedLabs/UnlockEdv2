import { CalendarOff, Users, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SessionsTabBulkActionsProps {
    selectedCount: number;
    onClearSelection: () => void;
    onBulkCancelClick: () => void;
    onChangeInstructorClick: () => void;
    onChangeRoomClick: () => void;
}

export function SessionsTabBulkActions({
    selectedCount,
    onClearSelection,
    onBulkCancelClick,
    onChangeInstructorClick,
    onChangeRoomClick
}: SessionsTabBulkActionsProps) {
    if (selectedCount === 0) return null;

    return (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#E2E7EA] border border-gray-400 rounded-lg shadow-lg px-6 py-4">
            <div className="flex items-center gap-6">
                <div className="text-sm">
                    <span className="font-semibold text-[#203622]">
                        {selectedCount}
                    </span>
                    <span className="text-gray-600 ml-1">
                        {selectedCount === 1 ? 'session' : 'sessions'}{' '}
                        selected
                    </span>
                </div>
                <div className="flex gap-3">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={onClearSelection}
                    >
                        Clear Selection
                    </Button>
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={onBulkCancelClick}
                    >
                        <CalendarOff className="size-4 mr-2" />
                        Cancel Sessions
                    </Button>
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={onChangeInstructorClick}
                    >
                        <Users className="size-4 mr-2" />
                        Change Instructor
                    </Button>
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={onChangeRoomClick}
                    >
                        <MapPin className="size-4 mr-2" />
                        Change Room
                    </Button>
                </div>
            </div>
        </div>
    );
}
