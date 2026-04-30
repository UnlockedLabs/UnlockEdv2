import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import API from '@/api/api';
import { useAuth } from '@/auth/useAuth';
import { FacilityProgramClassEvent, Room, RoomConflict } from '@/types';
import { FormModal } from '@/components/shared/FormModal';
import { RoomConflictModal } from './RoomConflictModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';

interface RescheduleSessionModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    event: FacilityProgramClassEvent;
    rooms: Room[];
    onSuccess: () => void;
}

function toDateInput(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function toTimeInput(d: Date): string {
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function formatDuration(startTime: string, endTime: string): string {
    const [sh, sm] = startTime.split(':').map(Number);
    const [eh, em] = endTime.split(':').map(Number);
    const totalMin = (eh ?? 0) * 60 + (em ?? 0) - ((sh ?? 0) * 60 + (sm ?? 0));
    if (totalMin <= 0) return '0h0m0s';
    return `${Math.floor(totalMin / 60)}h${totalMin % 60}m0s`;
}

export function RescheduleSessionModal({
    open,
    onOpenChange,
    event,
    rooms,
    onSuccess
}: RescheduleSessionModalProps) {
    const { user } = useAuth();
    const [date, setDate] = useState('');
    const [startTime, setStartTime] = useState('');
    const [endTime, setEndTime] = useState('');
    const [roomId, setRoomId] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [conflicts, setConflicts] = useState<RoomConflict[]>([]);
    const [showConflicts, setShowConflicts] = useState(false);

    const currentRoomName = rooms.find((r) => r.id === event.room_id)?.name ?? '';

    useEffect(() => {
        if (open && event) {
            setDate(toDateInput(event.start));
            setStartTime('');
            setEndTime('');
            setRoomId('');
        }
    }, [open, event]);

    async function handleSubmit() {
        if (!date) {
            toast.error('Date is required');
            return;
        }
        if (!user) return;

        const effectiveStart = startTime || toTimeInput(event.start);
        const effectiveEnd = endTime || toTimeInput(event.end);
        const duration = formatDuration(effectiveStart, effectiveEnd);
        if (duration === '0h0m0s') {
            toast.error('End time must be after start time');
            return;
        }

        setSubmitting(true);
        const origDt = `${toDateInput(event.start).replace(/-/g, '')}T${toTimeInput(event.start).replace(':', '')}00`;
        const newDt = `${date.replace(/-/g, '')}T${effectiveStart.replace(':', '')}00`;

        const resp = await API.put(
            `program-classes/${event.class_id}/events/${event.id}`,
            [
                {
                    event_id: event.id,
                    is_cancelled: true,
                    override_rrule: `DTSTART;TZID=${user.timezone}:${origDt}\nRRULE:FREQ=DAILY;COUNT=1`,
                    duration: event.duration,
                    reason: 'rescheduled'
                },
                {
                    event_id: event.id,
                    is_cancelled: false,
                    override_rrule: `DTSTART;TZID=${user.timezone}:${newDt}\nRRULE:FREQ=DAILY;COUNT=1`,
                    duration,
                    room_id: roomId ? Number(roomId) : (event.room_id ?? null),
                    instructor_id: event.instructor_id ?? null
                }
            ]
        );

        setSubmitting(false);

        if (resp.status === 409 && Array.isArray(resp.data)) {
            setConflicts(resp.data as unknown as RoomConflict[]);
            setShowConflicts(true);
            return;
        }

        if (resp.success) {
            toast.success('Class rescheduled successfully');
            onOpenChange(false);
            onSuccess();
        } else {
            toast.error(resp.message || 'Failed to reschedule class');
        }
    }

    const sessionDateLong = event.start.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric'
    });

    return (
        <>
            <FormModal
                open={open}
                onOpenChange={onOpenChange}
                title="Reschedule Class"
                description={`Reschedule the class from ${sessionDateLong}. You can change the date, time, and room.`}
            >
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="reschedule-date">New Date</Label>
                        <Input
                            id="reschedule-date"
                            type="date"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="reschedule-start">New Start Time (optional)</Label>
                        <Input
                            id="reschedule-start"
                            type="time"
                            value={startTime}
                            onChange={(e) => setStartTime(e.target.value)}
                            placeholder={toTimeInput(event.start)}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="reschedule-end">New End Time (optional)</Label>
                        <Input
                            id="reschedule-end"
                            type="time"
                            value={endTime}
                            onChange={(e) => setEndTime(e.target.value)}
                            placeholder={toTimeInput(event.end)}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="reschedule-room">New Room (optional)</Label>
                        <Select value={roomId} onValueChange={setRoomId}>
                            <SelectTrigger id="reschedule-room">
                                <SelectValue placeholder={currentRoomName ? `Keep current room (${currentRoomName})` : 'Select room'} />
                            </SelectTrigger>
                            <SelectContent>
                                {rooms.map((room) => (
                                    <SelectItem key={room.id} value={String(room.id)}>
                                        {room.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <p className="text-sm text-gray-500">Leave time and room blank to keep current values.</p>
                    </div>

                    <div className="flex gap-2 justify-end">
                        <Button variant="outline" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button
                            onClick={() => void handleSubmit()}
                            disabled={submitting || !date}
                            className="bg-[#556830] hover:bg-[#203622] text-white"
                        >
                            {submitting ? 'Saving...' : 'Reschedule Class'}
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
