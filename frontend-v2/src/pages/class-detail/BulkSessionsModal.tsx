import { useState, useMemo } from 'react';
import useSWR from 'swr';
import { Clock, MapPin, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import API from '@/api/api';
import { useAuth } from '@/auth/useAuth';
import { FormModal } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';
import { ClassEventInstance } from '@/types/events';
import { Room, User, ServerResponseMany } from '@/types';

export interface BulkSession {
    instance: ClassEventInstance;
    dateObj: Date;
    dayName: string;
    classTime: string;
    room: string;
}

type ActionType = 'cancel' | 'reschedule' | 'change-room' | 'change-instructor';

interface BulkSessionsModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    classId: number;
    sessions: BulkSession[];
    onComplete: () => void | Promise<unknown>;
}

const ACTION_OPTIONS: { value: ActionType; label: string }[] = [
    { value: 'cancel', label: 'Cancel All Sessions' },
    { value: 'reschedule', label: 'Reschedule Sessions' },
    { value: 'change-room', label: 'Change Room' },
    { value: 'change-instructor', label: 'Substitute Instructor' }
];

export function BulkSessionsModal({
    open,
    onOpenChange,
    classId,
    sessions,
    onComplete
}: BulkSessionsModalProps) {
    const { user } = useAuth();
    const [actionType, setActionType] = useState<ActionType>('cancel');
    const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set());
    const [dateRange, setDateRange] = useState({ start: '', end: '' });
    const [note, setNote] = useState('');
    const [newDate, setNewDate] = useState('');
    const [newStartTime, setNewStartTime] = useState('');
    const [selectedRoomId, setSelectedRoomId] = useState('');
    const [selectedInstructorId, setSelectedInstructorId] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const { data: roomsResp } = useSWR<ServerResponseMany<Room>>(
        open ? '/api/rooms' : null
    );
    const rooms = roomsResp?.data ?? [];

    const { data: instructorsResp } = useSWR<ServerResponseMany<User>>(
        open && actionType === 'change-instructor' && user
            ? `/api/users?role=${user.role}&per_page=100`
            : null
    );
    const instructors = instructorsResp?.data ?? [];

    const selected = useMemo(
        () => sessions.filter((s) => selectedDates.has(s.instance.date)),
        [sessions, selectedDates]
    );

    const resetActionFields = () => {
        setNote('');
        setNewDate('');
        setNewStartTime('');
        setSelectedRoomId('');
        setSelectedInstructorId('');
    };

    const handleClose = () => {
        setSelectedDates(new Set());
        setDateRange({ start: '', end: '' });
        setActionType('cancel');
        resetActionFields();
        onOpenChange(false);
    };

    const handleActionChange = (action: ActionType) => {
        setActionType(action);
        resetActionFields();
    };

    const handleToggle = (date: string) => {
        const next = new Set(selectedDates);
        if (next.has(date)) {
            next.delete(date);
        } else {
            next.add(date);
        }
        setSelectedDates(next);
    };

    const handleSelectRange = () => {
        if (!dateRange.start || !dateRange.end) return;
        const start = new Date(dateRange.start + 'T00:00:00');
        const end = new Date(dateRange.end + 'T23:59:59');
        const next = new Set(selectedDates);
        for (const s of sessions) {
            if (s.dateObj >= start && s.dateObj <= end)
                next.add(s.instance.date);
        }
        setSelectedDates(next);
    };

    const isApplyDisabled = (): boolean => {
        if (!selected.length || isSubmitting) return true;
        switch (actionType) {
            case 'cancel':
                return !note.trim();
            case 'reschedule':
                return !newDate;
            case 'change-room':
                return !selectedRoomId;
            case 'change-instructor':
                return !selectedInstructorId;
        }
    };

    const handleApply = async () => {
        if (isApplyDisabled()) return;
        setIsSubmitting(true);
        let ok = 0;
        let fail = 0;

        for (const s of selected) {
            const eventId = s.instance.event_id ?? s.instance.id;
            const url = `program-classes/${classId}/events/${eventId}`;
            let body: Record<string, unknown>;

            switch (actionType) {
                case 'cancel':
                    body = {
                        date: s.instance.date,
                        is_cancelled: true,
                        reason: note.trim()
                    };
                    break;
                case 'reschedule':
                    body = {
                        date: s.instance.date,
                        is_cancelled: true,
                        new_date: newDate,
                        new_start_time: newStartTime || undefined
                    };
                    break;
                case 'change-room':
                    body = {
                        date: s.instance.date,
                        is_cancelled: false,
                        room_id: Number(selectedRoomId)
                    };
                    break;
                case 'change-instructor':
                    body = {
                        date: s.instance.date,
                        is_cancelled: false,
                        instructor_id: Number(selectedInstructorId)
                    };
                    break;
            }

            const resp = await API.patch(url, body);
            if (resp.success) {
                ok++;
            } else {
                fail++;
            }
        }

        const actionLabel =
            actionType === 'cancel'
                ? 'cancelled'
                : actionType === 'reschedule'
                  ? 'rescheduled'
                  : actionType === 'change-room'
                    ? 'updated (room)'
                    : 'updated (instructor)';

        if (ok)
            toast.success(
                `${ok} session${ok === 1 ? '' : 's'} ${actionLabel}`
            );
        if (fail)
            toast.error(
                `Failed to update ${fail} session${fail === 1 ? '' : 's'}`
            );
        await onComplete();
        setIsSubmitting(false);
        handleClose();
    };

    const previewText = (() => {
        const count = selectedDates.size;
        const s = count === 1 ? '' : 's';
        switch (actionType) {
            case 'cancel':
                return `This will cancel ${count} session${s}.`;
            case 'reschedule':
                return `This will reschedule ${count} session${s} to ${newDate || '(select date)'}.`;
            case 'change-room': {
                const roomName =
                    rooms.find((r) => String(r.id) === selectedRoomId)?.name ??
                    '(select room)';
                return `This will change the room to ${roomName} for ${count} session${s}.`;
            }
            case 'change-instructor': {
                const inst = instructors.find(
                    (i) => String(i.id) === selectedInstructorId
                );
                const instName = inst
                    ? `${inst.name_first} ${inst.name_last}`
                    : '(select instructor)';
                return `This will assign ${instName} as substitute for ${count} session${s}.`;
            }
        }
    })();

    const todayStr = new Date().toISOString().split('T')[0];

    return (
        <FormModal
            open={open}
            onOpenChange={(isOpen) => !isOpen && handleClose()}
            title="Manage Multiple Sessions"
            description="Select sessions and choose an action to apply"
            className="sm:max-w-3xl max-h-[90vh] overflow-y-auto"
        >
            <div className="space-y-6 py-2">
                <div>
                    <Label className="text-sm font-medium text-[#203622] mb-3 block">
                        Select by Date Range
                    </Label>
                    <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
                        <div className="flex-1 space-y-1">
                            <Label
                                htmlFor="bulk-start"
                                className="text-xs text-gray-600"
                            >
                                From
                            </Label>
                            <Input
                                id="bulk-start"
                                type="date"
                                value={dateRange.start}
                                min={todayStr}
                                onChange={(e) =>
                                    setDateRange((r) => ({
                                        ...r,
                                        start: e.target.value
                                    }))
                                }
                            />
                        </div>
                        <div className="flex-1 space-y-1">
                            <Label
                                htmlFor="bulk-end"
                                className="text-xs text-gray-600"
                            >
                                To
                            </Label>
                            <Input
                                id="bulk-end"
                                type="date"
                                value={dateRange.end}
                                min={dateRange.start || todayStr}
                                onChange={(e) =>
                                    setDateRange((r) => ({
                                        ...r,
                                        end: e.target.value
                                    }))
                                }
                            />
                        </div>
                        <Button
                            variant="outline"
                            onClick={handleSelectRange}
                            disabled={!dateRange.start || !dateRange.end}
                            className="border-gray-300"
                        >
                            Select Range
                        </Button>
                    </div>
                </div>

                <div>
                    <div className="flex items-center justify-between mb-3">
                        <Label className="text-sm font-medium text-[#203622]">
                            Or Select Individual Sessions
                        </Label>
                        {selectedDates.size > 0 && (
                            <Badge
                                variant="outline"
                                className="bg-[#556830] text-white border-[#556830]"
                            >
                                {selectedDates.size} selected
                            </Badge>
                        )}
                    </div>
                    {sessions.length === 0 ? (
                        <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg text-sm">
                            No upcoming sessions available
                        </div>
                    ) : (
                        <div className="border border-gray-200 rounded-lg divide-y divide-gray-200 max-h-64 overflow-y-auto">
                            {sessions.map((s) => (
                                <label
                                    key={s.instance.date}
                                    className="flex items-center gap-3 p-3 hover:bg-[#E2E7EA]/30 transition-colors cursor-pointer"
                                >
                                    <Checkbox
                                        checked={selectedDates.has(
                                            s.instance.date
                                        )}
                                        onCheckedChange={() =>
                                            handleToggle(s.instance.date)
                                        }
                                    />
                                    <div className="flex-1">
                                        <div className="text-sm font-medium text-[#203622]">
                                            {s.dayName},{' '}
                                            {s.dateObj.toLocaleDateString(
                                                'en-US',
                                                {
                                                    month: 'long',
                                                    day: 'numeric',
                                                    year: 'numeric'
                                                }
                                            )}
                                        </div>
                                        <div className="flex items-center gap-3 text-xs text-gray-600 mt-0.5">
                                            <span className="flex items-center gap-1">
                                                <Clock className="size-3" />
                                                {s.classTime}
                                            </span>
                                            {s.room && (
                                                <span className="flex items-center gap-1">
                                                    <MapPin className="size-3" />
                                                    {s.room}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </label>
                            ))}
                        </div>
                    )}
                </div>

                {selectedDates.size > 0 && (
                    <>
                        <div className="space-y-2">
                            <Label className="text-sm font-medium text-[#203622]">
                                Action
                            </Label>
                            <Select
                                value={actionType}
                                onValueChange={(v) =>
                                    handleActionChange(v as ActionType)
                                }
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {ACTION_OPTIONS.map((opt) => (
                                        <SelectItem
                                            key={opt.value}
                                            value={opt.value}
                                        >
                                            {opt.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {actionType === 'cancel' && (
                            <div className="space-y-2">
                                <Label className="text-sm font-medium text-[#203622]">
                                    Reason / Note (required)
                                </Label>
                                <Textarea
                                    placeholder="e.g., Instructor PTO, facility lockdown, etc."
                                    value={note}
                                    onChange={(e) => setNote(e.target.value)}
                                    rows={3}
                                />
                            </div>
                        )}

                        {actionType === 'reschedule' && (
                            <div className="space-y-3">
                                <div className="space-y-2">
                                    <Label className="text-sm font-medium text-[#203622]">
                                        New Date (required)
                                    </Label>
                                    <Input
                                        type="date"
                                        value={newDate}
                                        min={todayStr}
                                        onChange={(e) =>
                                            setNewDate(e.target.value)
                                        }
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-sm font-medium text-[#203622]">
                                        New Start Time (optional, keeps
                                        original if blank)
                                    </Label>
                                    <Input
                                        type="time"
                                        value={newStartTime}
                                        onChange={(e) =>
                                            setNewStartTime(e.target.value)
                                        }
                                    />
                                </div>
                            </div>
                        )}

                        {actionType === 'change-room' && (
                            <div className="space-y-2">
                                <Label className="text-sm font-medium text-[#203622]">
                                    New Room (required)
                                </Label>
                                <Select
                                    value={selectedRoomId}
                                    onValueChange={setSelectedRoomId}
                                >
                                    <SelectTrigger>
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
                        )}

                        {actionType === 'change-instructor' && (
                            <div className="space-y-2">
                                <Label className="text-sm font-medium text-[#203622]">
                                    Substitute Instructor (required)
                                </Label>
                                <Select
                                    value={selectedInstructorId}
                                    onValueChange={setSelectedInstructorId}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select an instructor" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {instructors.map((inst) => (
                                            <SelectItem
                                                key={inst.id}
                                                value={String(inst.id)}
                                            >
                                                {inst.name_first}{' '}
                                                {inst.name_last}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-2">
                            <AlertCircle className="size-4 text-blue-700 mt-0.5 shrink-0" />
                            <div className="text-sm text-blue-900">
                                <p>
                                    <strong>Preview:</strong> {previewText}
                                </p>
                                <ul className="mt-1 space-y-0.5">
                                    {selected.map((s) => (
                                        <li key={s.instance.date}>
                                            &bull;{' '}
                                            {s.dateObj.toLocaleDateString(
                                                'en-US',
                                                {
                                                    month: 'short',
                                                    day: 'numeric',
                                                    year: 'numeric'
                                                }
                                            )}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </>
                )}
            </div>

            <div className="flex gap-2 justify-end pt-4 border-t border-gray-200">
                <Button
                    variant="outline"
                    onClick={handleClose}
                    disabled={isSubmitting}
                >
                    Cancel
                </Button>
                <Button
                    onClick={() => void handleApply()}
                    disabled={isApplyDisabled()}
                    className="bg-[#556830] hover:bg-[#203622] text-white"
                >
                    {isSubmitting
                        ? 'Applying...'
                        : `Apply to ${selectedDates.size} Session${selectedDates.size === 1 ? '' : 's'}`}
                </Button>
            </div>
        </FormModal>
    );
}
