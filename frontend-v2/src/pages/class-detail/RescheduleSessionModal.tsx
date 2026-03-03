import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

interface RescheduleSessionModalProps {
    open: boolean;
    onClose: () => void;
    classId: number;
    eventId: number;
    currentDate: string;
    dateLabel: string;
    currentRoomId: number;
    currentRoom: string;
    onRescheduled: (newDate: string, newTime?: string) => void;
}

export function RescheduleSessionModal({
    open,
    onClose,
    classId,
    eventId,
    currentDate,
    dateLabel,
    currentRoomId,
    currentRoom,
    onRescheduled
}: RescheduleSessionModalProps) {
    const [newDate, setNewDate] = useState('');
    const [newStartTime, setNewStartTime] = useState('');
    const [newEndTime, setNewEndTime] = useState('');
    const [selectedRoomId, setSelectedRoomId] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showAddRoom, setShowAddRoom] = useState(false);
    const [newRoomName, setNewRoomName] = useState('');

    const { data: roomsResp } = useSWR<ServerResponseMany<Room>>(
        open ? '/api/rooms' : null
    );
    const rooms = roomsResp?.data ?? [];

    useEffect(() => {
        if (open) {
            setNewDate('');
            setNewStartTime('');
            setNewEndTime('');
            setSelectedRoomId(
                currentRoomId && currentRoomId > 0
                    ? String(currentRoomId)
                    : ''
            );
            setShowAddRoom(false);
            setNewRoomName('');
        }
    }, [open, currentRoomId]);

    const handleAddRoom = async () => {
        if (!newRoomName.trim()) return;
        const resp = await API.post<Room, object>('rooms', {
            name: newRoomName.trim()
        });
        if (resp.success) {
            const created = resp.data as unknown as Room;
            setSelectedRoomId(String(created.id));
            toast.success('Room created');
        } else {
            toast.error('Failed to create room');
        }
        setNewRoomName('');
        setShowAddRoom(false);
    };

    const handleReschedule = async () => {
        setIsSubmitting(true);
        const body: {
            date: string;
            new_date: string;
            new_start_time?: string;
            room_id?: number;
        } = { date: currentDate, new_date: newDate };
        if (newStartTime) body.new_start_time = newStartTime;
        if (selectedRoomId && selectedRoomId !== String(currentRoomId)) {
            body.room_id = Number(selectedRoomId);
        }

        const resp = await API.patch<unknown, typeof body>(
            `program-classes/${classId}/events/${eventId}`,
            body
        );
        if (resp.success) {
            toast.success('Class rescheduled successfully');
            onClose();
            onRescheduled(newDate, newStartTime || undefined);
        } else {
            toast.error(resp.message || 'Failed to reschedule class');
        }
        setIsSubmitting(false);
    };

    const today = new Date().toISOString().split('T')[0];

    return (
        <>
            <Dialog
                open={open}
                onOpenChange={(isOpen) => !isOpen && onClose()}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="text-[#203622]">
                            Reschedule Class
                        </DialogTitle>
                        <DialogDescription>
                            Reschedule the class from {dateLabel}. You can
                            change the date, time, and room.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="reschedule-date">New Date</Label>
                            <Input
                                id="reschedule-date"
                                type="date"
                                value={newDate}
                                onChange={(e) => setNewDate(e.target.value)}
                                min={today}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="reschedule-start-time">
                                New Start Time (optional)
                            </Label>
                            <Input
                                id="reschedule-start-time"
                                type="time"
                                value={newStartTime}
                                onChange={(e) =>
                                    setNewStartTime(e.target.value)
                                }
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="reschedule-end-time">
                                New End Time (optional)
                            </Label>
                            <Input
                                id="reschedule-end-time"
                                type="time"
                                value={newEndTime}
                                onChange={(e) => setNewEndTime(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="reschedule-room">
                                Room (optional)
                            </Label>
                            <Select
                                value={selectedRoomId}
                                onValueChange={(v) => {
                                    if (v === '__add__') {
                                        setShowAddRoom(true);
                                        return;
                                    }
                                    setSelectedRoomId(v);
                                }}
                            >
                                <SelectTrigger className="w-full">
                                    <SelectValue
                                        placeholder={
                                            currentRoom
                                                ? `Keep current room (${currentRoom})`
                                                : 'Select a room'
                                        }
                                    />
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
                                    <SelectItem
                                        value="__add__"
                                        className="text-[#556830] font-medium"
                                    >
                                        + Add Room
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                            <p className="text-sm text-gray-500">
                                Leave time and room blank to keep current
                                values.
                            </p>
                        </div>
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
                                void handleReschedule();
                            }}
                            disabled={!newDate || isSubmitting}
                            className="bg-[#556830] hover:bg-[#203622] text-white"
                        >
                            {isSubmitting
                                ? 'Rescheduling...'
                                : 'Reschedule Class'}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={showAddRoom} onOpenChange={setShowAddRoom}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add Room</DialogTitle>
                        <DialogDescription>
                            Create a new room for this class.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="new-room-name">Room Name</Label>
                            <Input
                                id="new-room-name"
                                value={newRoomName}
                                onChange={(e) => setNewRoomName(e.target.value)}
                                placeholder="e.g. Room 101"
                            />
                        </div>
                    </div>
                    <div className="flex justify-end gap-2">
                        <Button
                            variant="outline"
                            onClick={() => setShowAddRoom(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            className="bg-[#203622] text-white hover:bg-[#203622]/90"
                            onClick={() => void handleAddRoom()}
                        >
                            Create
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
