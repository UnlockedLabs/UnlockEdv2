import { RoomConflict } from '@/types';
import { useAuth } from '@/auth/useAuth';
import { FormModal } from '@/components/shared/FormModal';
import { Button } from '@/components/ui/button';
import { formatRoomConflictRange } from '@/lib/formatters';

interface RoomConflictModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    conflicts: RoomConflict[];
}

export function RoomConflictModal({
    open,
    onOpenChange,
    conflicts
}: RoomConflictModalProps) {
    const { user } = useAuth();
    const timezone = user?.timezone ?? 'UTC';

    return (
        <FormModal
            open={open}
            onOpenChange={onOpenChange}
            title="Room Scheduling Conflict"
            description="The selected room has conflicts with existing classes."
        >
            <div className="space-y-3">
                {conflicts.map((c, i) => (
                    <div key={i} className="bg-red-50 p-3 rounded-lg text-sm">
                        <p className="font-medium text-red-800">
                            {c.class_name}
                        </p>
                        <p className="text-red-600">
                            {formatRoomConflictRange(c.start_time, c.end_time, timezone)}
                        </p>
                    </div>
                ))}
                <div className="flex justify-end">
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                    >
                        Close
                    </Button>
                </div>
            </div>
        </FormModal>
    );
}
