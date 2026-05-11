import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { FacilityProgramClassEvent, Room, RoomConflict, ChangeReason } from '@/types';
import { FormModal } from '@/components/shared/FormModal';
import { RoomConflictModal } from './RoomConflictModal';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';
import { useChangeEventField } from './useChangeEventField';

interface ChangeRoomModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    event: FacilityProgramClassEvent;
    rooms: Room[];
    onSuccess: () => void;
}

export function ChangeRoomModal({
    open,
    onOpenChange,
    event,
    rooms,
    onSuccess
}: ChangeRoomModalProps) {
    const [roomId, setRoomId] = useState('');
    const [reason, setReason] = useState('');
    const [applyToFuture, setApplyToFuture] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [conflicts, setConflicts] = useState<RoomConflict[]>([]);
    const [showConflicts, setShowConflicts] = useState(false);

    const { submitSingleSessionChange, submitSeriesChange } = useChangeEventField(
        event,
        { room_id: roomId ? Number(roomId) : null },
        reason
    );

    useEffect(() => {
        if (open && event) {
            setRoomId('');
            setReason('');
            setApplyToFuture(false);
        }
    }, [open, event]);

    const selectedRoomName = rooms.find((r) => String(r.id) === roomId)?.name ?? roomId;

    async function handleSubmit() {
        if (!roomId) {
            toast.error('Please select a room');
            return;
        }
        setSubmitting(true);

        const result = applyToFuture
            ? await submitSeriesChange()
            : await submitSingleSessionChange();

        setSubmitting(false);

        if (result.status === 409 && Array.isArray(result.data)) {
            setConflicts(result.data as RoomConflict[]);
            setShowConflicts(true);
            return;
        }

        if (result.success) {
            toast.success(
                applyToFuture
                    ? `Room changed to ${selectedRoomName} for all future sessions`
                    : `Room changed to ${selectedRoomName}`
            );
            onOpenChange(false);
            onSuccess();
        } else {
            toast.error(result.message ?? 'Failed to update room');
        }
    }

    return (
        <>
            <FormModal open={open} onOpenChange={onOpenChange} title="Change Room">
                <div className="space-y-4 pt-6">
                    <div className="space-y-2">
                        <Label>New Room</Label>
                        <Select value={roomId} onValueChange={setRoomId}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select room" />
                            </SelectTrigger>
                            <SelectContent>
                                {rooms.map((room) => (
                                    <SelectItem key={room.id} value={String(room.id)}>
                                        {room.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>Reason for Change</Label>
                        <Select value={reason} onValueChange={setReason}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select a reason" />
                            </SelectTrigger>
                            <SelectContent>
                                {Object.values(ChangeReason).map((r) => (
                                    <SelectItem key={r} value={r}>
                                        {r}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            id="room-apply-to-future"
                            checked={applyToFuture}
                            onChange={(e) => setApplyToFuture(e.target.checked)}
                            className="size-4 rounded border-gray-300"
                        />
                        <label
                            htmlFor="room-apply-to-future"
                            className="text-sm font-normal cursor-pointer"
                        >
                            Apply this change to all future sessions
                        </label>
                    </div>

                    <div className="flex justify-end gap-3 pt-4">
                        <Button variant="outline" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button
                            onClick={() => void handleSubmit()}
                            disabled={submitting || !roomId}
                            className="bg-[#556830] text-white hover:bg-[#203622]"
                        >
                            {submitting ? 'Saving...' : 'Change Room'}
                        </Button>
                    </div>
                </div>
            </FormModal>

            <RoomConflictModal
                open={showConflicts}
                onOpenChange={setShowConflicts}
                conflicts={conflicts}
            />
        </>
    );
}
