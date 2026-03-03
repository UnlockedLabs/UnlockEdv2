import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { CheckCircle, MapPin } from 'lucide-react';
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

const CHANGE_REASONS = [
    'Room Unavailable',
    'Maintenance',
    'Capacity Issue',
    'Equipment Needed',
    'Other'
];

export function ChangeRoomModal({
    open,
    onClose,
    classId,
    sessions,
    onChanged
}: ChangeRoomModalProps) {
    const [selectedRoomId, setSelectedRoomId] = useState('');
    const [reason, setReason] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const { data: roomsResp } = useSWR<ServerResponseMany<Room>>(
        open ? '/api/rooms' : null
    );
    const rooms = roomsResp?.data ?? [];

    useEffect(() => {
        if (open) {
            setSelectedRoomId('');
            setReason('');
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

    const selectedRoom = rooms.find(
        (r) => String(r.id) === selectedRoomId
    );

    return (
        <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle className="text-[#203622]">
                        Change Room
                    </DialogTitle>
                    <DialogDescription>
                        Select a new room for {sessions.length}{' '}
                        {sessions.length === 1 ? 'session' : 'sessions'}
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div>
                        <Label htmlFor="change-room">New Room</Label>
                        <Select
                            value={selectedRoomId}
                            onValueChange={setSelectedRoomId}
                        >
                            <SelectTrigger
                                id="change-room"
                                className="mt-2"
                            >
                                <SelectValue placeholder="Select room" />
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

                    <div className="space-y-2">
                        <Label>Reason for Change</Label>
                        <Select value={reason} onValueChange={setReason}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select a reason" />
                            </SelectTrigger>
                            <SelectContent>
                                {CHANGE_REASONS.map((r) => (
                                    <SelectItem key={r} value={r}>
                                        {r}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div>
                        <Label className="text-sm font-medium text-[#203622] mb-2 block">
                            Sessions to Update
                        </Label>
                        <div className="max-h-48 overflow-y-auto bg-gray-50 rounded-lg p-4 space-y-1">
                            {sessions.map((s) => (
                                <div
                                    key={s.date}
                                    className="text-sm text-gray-700"
                                >
                                    {s.dateLabel}
                                </div>
                            ))}
                        </div>
                    </div>

                    {selectedRoom && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <div className="flex gap-3">
                                <CheckCircle className="size-5 text-blue-600 shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-sm text-blue-900 font-medium mb-1">
                                        Preview
                                    </p>
                                    <p className="text-sm text-blue-700">
                                        <strong>
                                            {selectedRoom.name}
                                        </strong>{' '}
                                        will be assigned as the location for{' '}
                                        {sessions.length}{' '}
                                        {sessions.length === 1
                                            ? 'session'
                                            : 'sessions'}
                                        .
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
                <div className="flex justify-end gap-3">
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
                        <MapPin className="size-4 mr-2" />
                        Change Room
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
