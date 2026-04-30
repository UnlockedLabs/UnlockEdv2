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
import { formatTime12h } from '@/lib/formatters';

export interface RescheduleFutureSession {
    date: string;
    eventId: number;
}

interface RescheduleSessionModalProps {
    open: boolean;
    onClose: () => void;
    classId: number;
    eventId: number;
    originalDate: string;
    dateLabel: string;
    currentRoom?: string;
    classTime?: string;
    onRescheduled: () => void;
    applyToFuture?: boolean;
    setApplyToFuture?: (apply: boolean) => void;
    futureSessions?: RescheduleFutureSession[];
}

export function RescheduleSessionModal({
    open,
    onClose,
    classId,
    eventId,
    originalDate,
    dateLabel,
    currentRoom,
    classTime,
    onRescheduled,
    applyToFuture,
    setApplyToFuture,
    futureSessions = []
}: RescheduleSessionModalProps) {
    const [startTime, endTime] = classTime
        ?.split('-')
        .map((s) => s.trim()) ?? [];
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
        const startTimeFromClass = classTime?.split('-')[0]?.split(' - ')[0];
        const body: Record<string, unknown> = {
            date: originalDate,
            start_time: startTimeFromClass,
            new_date: newDate || originalDate
        };
        if (newStartTime) body.new_start_time = newStartTime;
        if (newEndTime) body.new_end_time = newEndTime;
        if (newRoom) body.room_id = Number(newRoom);
        const resp = await API.patch(
            `program-classes/${classId}/events/${eventId}`,
            body
        );
        if (!resp.success) {
            toast.error(resp.message || 'Failed to reschedule session');
            setIsSubmitting(false);
            return;
        }

        if (applyToFuture && futureSessions.length > 0) {
            const hasTimeOrRoom = newStartTime || newEndTime || newRoom;
            if (hasTimeOrRoom) {
                let ok = 0;
                let fail = 0;
                for (const s of futureSessions) {
                    const futureBody: Record<string, unknown> = {
                        date: s.date,
                        new_date: s.date,
                        reason: 'applied_future'
                    };
                    if (newStartTime) futureBody.new_start_time = newStartTime;
                    if (newEndTime) futureBody.new_end_time = newEndTime;
                    if (newRoom) futureBody.room_id = Number(newRoom);
                    const futureResp = await API.patch(
                        `program-classes/${classId}/events/${s.eventId}`,
                        futureBody
                    );
                    if (futureResp.success) ok++;
                    else fail++;
                }
                if (fail) {
                    toast.error(
                        `Failed to update ${fail} future session${fail === 1 ? '' : 's'}`
                    );
                }
                toast.success(
                    `Rescheduled session and updated ${ok} future session${ok === 1 ? '' : 's'}`
                );
            } else {
                toast.success('Class rescheduled successfully');
            }
        } else {
            toast.success('Class rescheduled successfully');
        }

        onClose();
        onRescheduled();
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
                            placeholder={startTime ? formatTime12h(startTime) : undefined}
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
                            placeholder={endTime ? formatTime12h(endTime) : undefined}
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
                    {setApplyToFuture && (
                        <div className="flex items-center space-x-2">
                            <input
                                type="checkbox"
                                id="apply-to-future"
                                checked={applyToFuture}
                                onChange={(e) =>
                                    setApplyToFuture(e.target.checked)
                                }
                                className="size-4 rounded border-gray-300"
                            />
                            <Label
                                htmlFor="apply-to-future"
                                className="text-sm font-normal cursor-pointer"
                            >
                                Apply this change to all future sessions
                            </Label>
                        </div>
                    )}
                </div>
                <div className="flex gap-2 justify-end">
                    <Button
                        variant="outline"
                        onClick={() => {
                            onClose();
                            setNewDate('');
                            setNewStartTime('');
                            setNewEndTime('');
                            setNewRoom('');
                            if (setApplyToFuture) setApplyToFuture(false);
                        }}
                        disabled={isSubmitting}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={() => {
                            void handleReschedule();
                        }}
                        disabled={
                            (!newDate && !newStartTime && !newEndTime && !newRoom) ||
                            isSubmitting
                        }
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
