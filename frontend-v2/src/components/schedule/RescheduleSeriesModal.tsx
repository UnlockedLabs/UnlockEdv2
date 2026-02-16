import { useRef, useState } from 'react';
import { toast } from 'sonner';
import API from '@/api/api';
import { FacilityProgramClassEvent, Room, RoomConflict } from '@/types';
import { FormModal } from '@/components/shared/FormModal';
import { RoomConflictModal } from './RoomConflictModal';
import { RRuleControl, RRuleFormHandle } from './RRuleControl';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';

interface RescheduleSeriesModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    event: FacilityProgramClassEvent;
    rooms: Room[];
    onSuccess: () => void;
}

function parseRRuleDefaults(event: FacilityProgramClassEvent) {
    const rule = event.recurrence_rule ?? '';
    let startTime = '';
    let endTime = '';
    let days: string[] = [];
    let endDate = '';

    const dtMatch = /T(\d{2})(\d{2})/.exec(rule);
    if (dtMatch) {
        startTime = `${dtMatch[1]}:${dtMatch[2]}`;
    }

    if (startTime && event.duration) {
        const durMatch = /(\d+)h(\d+)m/.exec(event.duration);
        if (durMatch) {
            const [, hours, mins] = durMatch;
            const [sh, sm] = startTime.split(':').map(Number);
            const totalMin =
                (sh ?? 0) * 60 + (sm ?? 0) + Number(hours) * 60 + Number(mins);
            const eh = Math.floor(totalMin / 60) % 24;
            const em = totalMin % 60;
            endTime = `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`;
        }
    }

    const byDayMatch = /BYDAY=([A-Z,]+)/.exec(rule);
    if (byDayMatch) {
        days = byDayMatch[1].split(',');
    }

    const untilMatch = /UNTIL=(\d{4})(\d{2})(\d{2})/.exec(rule);
    if (untilMatch) {
        endDate = `${untilMatch[1]}-${untilMatch[2]}-${untilMatch[3]}`;
    }

    return { startTime, endTime, days, endDate };
}

function closedSeriesRRule(
    originalRule: string,
    closeDateStr: string
): string {
    const untilStr = closeDateStr.replace(/-/g, '') + 'T235959Z';
    const ruleClean = originalRule
        .replace(/;UNTIL=\d{8}T\d{6}Z/, '')
        .replace(/\n/, '\n');
    const parts = ruleClean.split('\n');
    return parts[0] + '\n' + parts[1] + `;UNTIL=${untilStr}`;
}

function dayBefore(dateStr: string): string {
    const d = new Date(dateStr + 'T00:00:00');
    d.setDate(d.getDate() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function RescheduleSeriesModal({
    open,
    onOpenChange,
    event,
    rooms,
    onSuccess
}: RescheduleSeriesModalProps) {
    const rruleRef = useRef<RRuleFormHandle>(null);
    const [roomId, setRoomId] = useState(
        event.room_id ? String(event.room_id) : ''
    );
    const [submitting, setSubmitting] = useState(false);
    const [conflicts, setConflicts] = useState<RoomConflict[]>([]);
    const [showConflicts, setShowConflicts] = useState(false);

    const defaults = parseRRuleDefaults(event);

    async function handleSubmit() {
        if (!rruleRef.current?.validate()) {
            toast.error('Please fill in all schedule fields');
            return;
        }
        const result = rruleRef.current.createRule();
        if (!result) return;

        const newStartDate = result.rule.match(
            /DTSTART;TZID=Local:(\d{4})(\d{2})(\d{2})/
        );
        if (!newStartDate) {
            toast.error('Invalid start date');
            return;
        }
        const newStartDateStr = `${newStartDate[1]}-${newStartDate[2]}-${newStartDate[3]}`;
        const closeDate = dayBefore(newStartDateStr);

        setSubmitting(true);
        const resp = await API.put(
            `program-classes/${event.class_id}/events`,
            {
                event_series: {
                    class_id: event.class_id,
                    recurrence_rule: result.rule,
                    duration: result.duration,
                    room_id: roomId ? Number(roomId) : event.room_id
                },
                closed_event_series: {
                    id: event.id,
                    class_id: event.class_id,
                    recurrence_rule: closedSeriesRRule(
                        event.recurrence_rule,
                        closeDate
                    ),
                    duration: event.duration,
                    room_id: event.room_id
                }
            }
        );
        setSubmitting(false);

        if (resp.status === 409 && Array.isArray(resp.data)) {
            setConflicts(resp.data as unknown as RoomConflict[]);
            setShowConflicts(true);
            return;
        }

        if (resp.success) {
            toast.success('Series rescheduled');
            onOpenChange(false);
            onSuccess();
        } else {
            toast.error(resp.message || 'Failed to reschedule series');
        }
    }

    return (
        <>
            <FormModal
                open={open}
                onOpenChange={onOpenChange}
                title="Edit Series"
                description={`Update the recurring schedule for "${event.title}"`}
                className="max-w-lg"
            >
                <div className="space-y-4">
                    <RRuleControl
                        ref={rruleRef}
                        defaultStartDate=""
                        defaultStartTime={defaults.startTime}
                        defaultEndTime={defaults.endTime}
                        defaultDays={defaults.days}
                        defaultEndDate={defaults.endDate}
                    />

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
                            {submitting ? 'Saving...' : 'Save Series'}
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
