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
    originalDate: string;
    dateLabel: string;
    currentRoom?: string;
    onRescheduled: () => void;
}

export function RescheduleSessionModal({
    open,
    onClose,
    classId,
    eventId,
    originalDate,
    dateLabel,
    currentRoom,
    onRescheduled
}: RescheduleSessionModalProps) {
    const [newDate, setNewDate] = useState('');
    const [newStartTime, setNewStartTime] = useState('');
    const [newEndTime, setNewEndTime] = useState('');
    const [newRoom, setNewRoom] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const { data: roomsResp } = useSWR<ServerResponseMany<Room>>(
        open ? '/api/rooms' : null
    );
    const rooms = roomsResp?.data ?? [];

    useEffect(() => {
        if (open) {
            setNewDate('');
            setNewStartTime('');
            setNewEndTime('');
            setNewRoom('');
        }
    }, [open]);

    const handleReschedule = async () => {
        setIsSubmitting(true);
        const body: Record<string, unknown> = {
            date: originalDate,
            new_date: newDate
        };
        if (newStartTime) body.new_start_time = newStartTime;
        if (newEndTime) body.new_end_time = newEndTime;
        if (newRoom) body.room_id = Number(newRoom);
        const resp = await API.patch(
            `program-classes/${classId}/events/${eventId}`,
            body
        );
        if (resp.success) {
            toast.success('Session rescheduled successfully');
            onClose();
            onRescheduled();
        } else {
            toast.error(resp.message || 'Failed to reschedule session');
        }
        setIsSubmitting(false);
    };

    const today = new Date().toISOString().split('T')[0];

    return (
        <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle className="text-[#203622]">
                        Reschedule Class
                    </DialogTitle>
                    <DialogDescription>
                        Reschedule the class from {dateLabel}. You can change
                        the date, time, and room.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="rescheduleDate">New Date</Label>
                        <Input
                            id="rescheduleDate"
                            type="date"
                            value={newDate}
                            onChange={(e) => setNewDate(e.target.value)}
                            min={today}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="rescheduleStartTime">
                            New Start Time (optional)
                        </Label>
                        <Input
                            id="rescheduleStartTime"
                            type="time"
                            value={newStartTime}
                            onChange={(e) => setNewStartTime(e.target.value)}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="rescheduleEndTime">
                            New End Time (optional)
                        </Label>
                        <Input
                            id="rescheduleEndTime"
                            type="time"
                            value={newEndTime}
                            onChange={(e) => setNewEndTime(e.target.value)}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="rescheduleRoom">
                            New Room (optional)
                        </Label>
                        <Select value={newRoom} onValueChange={setNewRoom}>
                            <SelectTrigger id="rescheduleRoom">
                                <SelectValue
                                    placeholder={
                                        currentRoom
                                            ? `Keep current room (${currentRoom})`
                                            : 'Select room'
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
                            </SelectContent>
                        </Select>
                        <p className="text-sm text-gray-500">
                            Leave time and room blank to keep current values.
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
    );
}
