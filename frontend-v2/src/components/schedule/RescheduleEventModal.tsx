import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import API from '@/api/api';
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

interface RescheduleEventModalProps {
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

function buildSingleInstanceRRule(dateStr: string, timeStr: string): string {
    const dt = `${dateStr.replace(/-/g, '')}T${timeStr.replace(/:/g, '')}00`;
    return `DTSTART;TZID=Local:${dt}\nRRULE:FREQ=DAILY;COUNT=1`;
}

function formatDuration(startTime: string, endTime: string): string {
    if (!startTime || !endTime) return '0h0m0s';
    const [sh, sm] = startTime.split(':').map(Number);
    const [eh, em] = endTime.split(':').map(Number);
    const totalMin = (eh ?? 0) * 60 + (em ?? 0) - ((sh ?? 0) * 60 + (sm ?? 0));
    if (totalMin <= 0) return '0h0m0s';
    const hours = Math.floor(totalMin / 60);
    const minutes = totalMin % 60;
    return `${hours}h${minutes}m0s`;
}

export function RescheduleEventModal({
    open,
    onOpenChange,
    event,
    rooms,
    onSuccess
}: RescheduleEventModalProps) {
    const [date, setDate] = useState('');
    const [startTime, setStartTime] = useState('');
    const [endTime, setEndTime] = useState('');
    const [roomId, setRoomId] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [conflicts, setConflicts] = useState<RoomConflict[]>([]);
    const [showConflicts, setShowConflicts] = useState(false);

    useEffect(() => {
        if (open && event) {
            setDate(toDateInput(event.start));
            setStartTime(toTimeInput(event.start));
            setEndTime(toTimeInput(event.end));
            setRoomId(event.room_id ? String(event.room_id) : '');
        }
    }, [open, event]);

    async function handleSubmit() {
        if (!date || !startTime || !endTime) {
            toast.error('All fields are required');
            return;
        }
        const duration = formatDuration(startTime, endTime);
        if (duration === '0h0m0s') {
            toast.error('End time must be after start time');
            return;
        }

        setSubmitting(true);
        const originalRRule = buildSingleInstanceRRule(
            toDateInput(event.start),
            toTimeInput(event.start)
        );
        const newRRule = buildSingleInstanceRRule(date, startTime);

        const resp = await API.put(
            `program-classes/${event.class_id}/events/${event.id}`,
            [
                {
                    event_id: event.id,
                    is_cancelled: true,
                    override_rrule: originalRRule,
                    duration: event.duration,
                    reason: 'rescheduled'
                },
                {
                    event_id: event.id,
                    is_cancelled: false,
                    override_rrule: newRRule,
                    duration,
                    room_id: roomId ? Number(roomId) : event.room_id
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
            toast.success('Event rescheduled');
            onOpenChange(false);
            onSuccess();
        } else {
            toast.error(resp.message || 'Failed to reschedule event');
        }
    }

    return (
        <>
            <FormModal
                open={open}
                onOpenChange={onOpenChange}
                title="Edit Event"
                description={`Reschedule "${event.title}"`}
            >
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label>Date</Label>
                        <Input
                            type="date"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                            <Label>Start Time</Label>
                            <Input
                                type="time"
                                value={startTime}
                                onChange={(e) => setStartTime(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>End Time</Label>
                            <Input
                                type="time"
                                value={endTime}
                                onChange={(e) => setEndTime(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Room</Label>
                        <Select value={roomId} onValueChange={setRoomId}>
                            <SelectTrigger>
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

                    <div className="flex justify-end gap-2">
                        <Button
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={() => void handleSubmit()}
                            disabled={submitting}
                            className="bg-[#203622] text-white hover:bg-[#203622]/90"
                        >
                            {submitting ? 'Saving...' : 'Save Changes'}
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
