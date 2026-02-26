import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';
import { AlertCircle } from 'lucide-react';
import API from '@/api/api';
import { toast } from 'sonner';
import { Room, ServerResponseMany } from '@/types';

export interface ChangeRoomSession {
    date: string;
    dateLabel: string;
    eventId: number;
    classTime: string;
}

interface ChangeRoomModalProps {
    open: boolean;
    onClose: () => void;
    classId: number;
    sessions: ChangeRoomSession[];
    onChanged: () => void;
}

export function ChangeRoomModal({
    open,
    onClose,
    classId,
    sessions,
    onChanged
}: ChangeRoomModalProps) {
    const [selectedRoomId, setSelectedRoomId] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const { data: roomsResp } = useSWR<ServerResponseMany<Room>>(
        open ? '/api/rooms' : null
    );
    const rooms = roomsResp?.data ?? [];

    useEffect(() => {
        if (open) {
            setSelectedRoomId('');
        }
    }, [open]);

    const handleApply = async () => {
        if (!selectedRoomId) return;
        setIsSubmitting(true);
        let ok = 0;
        let fail = 0;

        for (const s of sessions) {
            const resp = await API.patch(
                `program-classes/${classId}/events/${s.eventId}`,
                {
                    date: s.date,
                    is_cancelled: false,
                    room_id: Number(selectedRoomId)
                }
            );
            if (resp.success) ok++;
            else fail++;
        }

        if (ok)
            toast.success(
                `Room updated for ${ok} session${ok === 1 ? '' : 's'}`
            );
        if (fail)
            toast.error(
                `Failed to update ${fail} session${fail === 1 ? '' : 's'}`
            );
        onClose();
        onChanged();
        setIsSubmitting(false);
    };

    const selectedRoom = rooms.find((r) => String(r.id) === selectedRoomId);
    const isSingle = sessions.length === 1;

    return (
        <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle className="text-[#203622]">
                        Change Room
                    </DialogTitle>
                    <DialogDescription>
                        {isSingle
                            ? `Change the room for ${sessions[0]?.dateLabel}`
                            : `Change the room for ${sessions.length} sessions`}
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div>
                        <Label>New Room</Label>
                        <Select
                            value={selectedRoomId}
                            onValueChange={setSelectedRoomId}
                        >
                            <SelectTrigger className="mt-1">
                                <SelectValue placeholder="Select a room" />
                            </SelectTrigger>
                            <SelectContent>
                                {rooms.map((room) => (
                                    <SelectItem
                                        key={room.id}
                                        value={String(room.id)}
                                    >
                                        {room.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {sessions.length > 0 && (
                        <div>
                            <Label className="text-sm text-gray-600 mb-2 block">
                                Affected Sessions
                            </Label>
                            <div className="border border-gray-200 rounded-lg divide-y divide-gray-200 max-h-48 overflow-y-auto">
                                {sessions.map((s) => (
                                    <div
                                        key={s.date}
                                        className="flex items-center gap-2 px-3 py-2 text-sm"
                                    >
                                        <Clock className="size-3 text-gray-400" />
                                        <span className="text-[#203622]">
                                            {s.dateLabel}
                                        </span>
                                        <span className="text-gray-500">
                                            {s.classTime}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {selectedRoom && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-2">
                            <AlertCircle className="size-4 text-blue-700 mt-0.5 shrink-0" />
                            <p className="text-sm text-blue-900">
                                This will change the room to{' '}
                                <strong>{selectedRoom.name}</strong> for{' '}
                                {sessions.length}{' '}
                                {sessions.length === 1 ? 'session' : 'sessions'}.
                            </p>
                        </div>
                    )}
                </div>
                <div className="flex gap-2 justify-end">
                    <Button
                        variant="outline"
                        onClick={onClose}
                        disabled={isSubmitting}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={() => {
                            void handleApply();
                        }}
                        disabled={!selectedRoomId || isSubmitting}
                        className="bg-[#556830] hover:bg-[#203622] text-white"
                    >
                        {isSubmitting ? 'Updating...' : 'Change Room'}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
