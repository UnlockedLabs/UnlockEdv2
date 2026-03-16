import { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { toast } from 'sonner';
import useSWR from 'swr';
import { AlertCircle } from 'lucide-react';
import API from '@/api/api';
import { useAuth } from '@/auth/useAuth';
import { FormModal } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';
import { SelectedClassStatus } from '@/types/attendance';
import {
    Class,
    Room,
    RoomConflict,
    User,
    ServerResponseMany,
    ServerResponseOne,
    NewUserResponse
} from '@/types';

interface EditClassModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    cls: Class;
    onUpdated: () => void;
}

interface EditClassFormData {
    name: string;
    description: string;
    instructor_id: number | null;
    capacity: number;
    credit_hours: number;
    start_dt: string;
    end_dt: string;
    room_id: number | null;
    start_time: string;
    end_time: string;
    status: string;
}

const ALL_DAYS = [
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
    'Sunday'
];

const DAY_FULL_TO_RRULE: Record<string, string> = {
    Monday: 'MO',
    Tuesday: 'TU',
    Wednesday: 'WE',
    Thursday: 'TH',
    Friday: 'FR',
    Saturday: 'SA',
    Sunday: 'SU'
};

const DAY_RRULE_TO_FULL: Record<string, string> = {
    MO: 'Monday',
    TU: 'Tuesday',
    WE: 'Wednesday',
    TH: 'Thursday',
    FR: 'Friday',
    SA: 'Saturday',
    SU: 'Sunday'
};

function parseScheduleFromEvent(
    recurrenceRule: string,
    duration: string
): { days: string[]; startTime: string; endTime: string } {
    let startTime = '';
    let endTime = '';
    let days: string[] = [];

    const dtMatch = /T(\d{2})(\d{2})/.exec(recurrenceRule);
    if (dtMatch) {
        startTime = `${dtMatch[1]}:${dtMatch[2]}`;
    }

    const byDayMatch = /BYDAY=([A-Z,]+)/.exec(recurrenceRule);
    if (byDayMatch) {
        days = byDayMatch[1]
            .split(',')
            .map((code) => DAY_RRULE_TO_FULL[code] ?? code);
    }

    if (duration && startTime) {
        const durationMatch = /(\d+)h(\d+)m/.exec(duration);
        if (durationMatch) {
            const [, hours, mins] = durationMatch;
            const [sh, sm] = startTime.split(':').map(Number);
            const totalMin =
                (sh ?? 0) * 60 +
                (sm ?? 0) +
                Number(hours) * 60 +
                Number(mins);
            const eh = Math.floor(totalMin / 60) % 24;
            const em = totalMin % 60;
            endTime = `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`;
        }
    }

    return { days, startTime, endTime };
}

function buildRecurrenceRule(
    originalRule: string,
    startDate: string,
    startTime: string,
    days: string[],
    endDate?: string
): string {
    const tzMatch = /DTSTART;TZID=([^:]+):/.exec(originalRule);
    const tz = tzMatch?.[1] ?? 'Local';

    const dtStart = `${startDate.replace(/-/g, '')}T${startTime.replace(/:/g, '')}00`;
    let rule = `DTSTART;TZID=${tz}:${dtStart}\nRRULE:FREQ=WEEKLY`;

    if (days.length > 0) {
        const rruleDays = days
            .map((d) => DAY_FULL_TO_RRULE[d])
            .filter(Boolean);
        rule += `;BYDAY=${rruleDays.join(',')}`;
    }

    if (endDate) {
        rule += `;UNTIL=${endDate.replace(/-/g, '')}T235959Z`;
    } else {
        const untilMatch = /UNTIL=([^;\s]+)/.exec(originalRule);
        if (untilMatch) {
            rule += `;UNTIL=${untilMatch[1]}`;
        }
    }

    return rule;
}

function formatDuration(startTime: string, endTime: string): string {
    if (!startTime || !endTime) return '0h0m0s';
    const [sh, sm] = startTime.split(':').map(Number);
    const [eh, em] = endTime.split(':').map(Number);
    const totalMin =
        (eh ?? 0) * 60 + (em ?? 0) - ((sh ?? 0) * 60 + (sm ?? 0));
    if (totalMin <= 0) return '0h0m0s';
    const hours = Math.floor(totalMin / 60);
    const minutes = totalMin % 60;
    return `${hours}h${minutes}m0s`;
}

export function EditClassModal({
    open,
    onOpenChange,
    cls,
    onUpdated
}: EditClassModalProps) {
    const { user } = useAuth();

    const [conflicts, setConflicts] = useState<RoomConflict[]>([]);
    const [showAddRoom, setShowAddRoom] = useState(false);
    const [showAddInstructor, setShowAddInstructor] = useState(false);
    const [tempPassword, setTempPassword] = useState('');
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [newRoomName, setNewRoomName] = useState('');
    const [newInstructor, setNewInstructor] = useState({
        name_first: '',
        name_last: '',
        username: ''
    });
    const [scheduleDays, setScheduleDays] = useState<string[]>([]);

    const { data: instructorsResp, mutate: mutateInstructors } =
        useSWR<ServerResponseMany<User>>(
            user ? `/api/users?role=${user.role}&per_page=100` : null
        );
    const instructors = instructorsResp?.data ?? [];

    const { data: roomsResp, mutate: mutateRooms } =
        useSWR<ServerResponseMany<Room>>('/api/rooms');
    const rooms = roomsResp?.data ?? [];

    const {
        register,
        handleSubmit,
        control,
        reset,
        watch,
        setValue,
        formState: { errors, isSubmitting }
    } = useForm<EditClassFormData>({
        defaultValues: {
            name: '',
            description: '',
            instructor_id: null,
            capacity: 20,
            credit_hours: 0,
            start_dt: '',
            end_dt: '',
            room_id: null,
            start_time: '',
            end_time: '',
            status: ''
        }
    });

    const activeEvent = cls.events?.find((e) => !e.is_cancelled);

    useEffect(() => {
        if (cls && open) {
            const schedule = activeEvent
                ? parseScheduleFromEvent(
                      activeEvent.recurrence_rule,
                      activeEvent.duration
                  )
                : { days: [], startTime: '', endTime: '' };

            reset({
                name: cls.name,
                description: cls.description,
                instructor_id: cls.instructor_id ?? null,
                capacity: cls.capacity,
                credit_hours: cls.credit_hours,
                start_dt: cls.start_dt.split('T')[0],
                end_dt: cls.end_dt ? cls.end_dt.split('T')[0] : '',
                room_id: activeEvent?.room_id ?? null,
                start_time: schedule.startTime,
                end_time: schedule.endTime,
                status: cls.status
            });
            setScheduleDays(schedule.days);
            setConflicts([]);
        }
    }, [cls, open, reset, activeEvent]);

    const watchedCapacity = watch('capacity');
    const watchedStatus = watch('status');
    const watchedStartDt = watch('start_dt');
    const capacityBelowEnrolled =
        watchedCapacity !== undefined &&
        Number(watchedCapacity) < cls.enrolled;

    const toggleDay = (day: string) => {
        setScheduleDays((prev) =>
            prev.includes(day)
                ? prev.filter((d) => d !== day)
                : [...prev, day]
        );
    };

    async function handleAddRoom() {
        if (!newRoomName.trim()) return;
        const resp = await API.post<Room, object>('rooms', {
            name: newRoomName.trim()
        });
        if (resp.success) {
            const created = resp.data as unknown as Room;
            await mutateRooms();
            if (created?.id) setValue('room_id', created.id);
            setNewRoomName('');
            setShowAddRoom(false);
            toast.success('Room created');
        } else {
            toast.error('Failed to create room');
        }
    }

    async function handleAddInstructor() {
        const { name_first, name_last, username } = newInstructor;
        if (!name_first.trim() || !name_last.trim() || !username.trim())
            return;
        const resp = (await API.post<NewUserResponse, object>('users', {
            user: {
                name_first: name_first.trim(),
                name_last: name_last.trim(),
                username: username.trim(),
                role: 'facility_admin'
            },
            provider_platforms: []
        })) as ServerResponseOne<NewUserResponse>;
        if (resp.success) {
            const { user: created, temp_password } = resp.data;
            await mutateInstructors();
            if (created?.id) setValue('instructor_id', created.id);
            setNewInstructor({ name_first: '', name_last: '', username: '' });
            setShowAddInstructor(false);
            setTempPassword(temp_password);
            setShowPasswordModal(true);
        } else {
            toast.error(resp.message || 'Failed to create instructor');
        }
    }

    async function onSubmit(data: EditClassFormData) {
        if (!activeEvent) return;
        const newRule = buildRecurrenceRule(
            activeEvent.recurrence_rule,
            data.start_dt,
            data.start_time,
            scheduleDays,
            data.end_dt || undefined
        );
        const newDuration = formatDuration(data.start_time, data.end_time);

        const payload = {
            id: cls.id,
            name: data.name,
            description: data.description,
            instructor_id: data.instructor_id
                ? Number(data.instructor_id)
                : null,
            capacity: Number(data.capacity),
            credit_hours:
                Number(data.credit_hours) > 0
                    ? Number(data.credit_hours)
                    : null,
            status: data.status,
            start_dt: `${data.start_dt}T00:00:00Z`,
            end_dt: data.end_dt ? `${data.end_dt}T00:00:00Z` : null,
            events: cls.events.map((e) =>
                e.id === activeEvent.id
                    ? {
                          id: e.id,
                          class_id: e.class_id,
                          duration: newDuration,
                          recurrence_rule: newRule,
                          room_id: data.room_id
                              ? Number(data.room_id)
                              : e.room_id
                      }
                    : { id: e.id, class_id: e.class_id, duration: e.duration, recurrence_rule: e.recurrence_rule, room_id: e.room_id }
            )
        };

        const resp = await API.patch(
            `programs/${cls.program_id}/classes/${cls.id}`,
            payload
        );

        if (!resp.success) {
            if (resp.status === 409 && Array.isArray(resp.data)) {
                setConflicts(resp.data as unknown as RoomConflict[]);
                return;
            }
            toast.error(resp.message || 'Failed to update class');
            return;
        }

        toast.success('Class updated successfully');
        onUpdated();
        onOpenChange(false);
    }

    return (
        <>
            <FormModal
                open={open}
                onOpenChange={onOpenChange}
                title="Edit Class"
                description="Make changes to the class details."
                className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto"
            >
                <form
                    onSubmit={(e) => {
                        void handleSubmit(onSubmit)(e);
                    }}
                    className="space-y-6"
                >
                    <div className="space-y-4">
                        <h4 className="font-medium text-[#203622]">
                            Class Details
                        </h4>

                        <div className="space-y-2">
                            <Label
                                htmlFor="edit-name"
                                className="text-sm font-medium"
                            >
                                Class Name
                            </Label>
                            <Input
                                id="edit-name"
                                {...register('name', {
                                    required: 'Class name is required',
                                    maxLength: {
                                        value: 255,
                                        message: 'Max 255 characters'
                                    }
                                })}
                            />
                            {errors.name && (
                                <p className="text-sm text-red-600">
                                    {errors.name.message}
                                </p>
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-sm font-medium">
                                    Instructor
                                </Label>
                                <Controller
                                    name="instructor_id"
                                    control={control}
                                    render={({ field }) => (
                                        <Select
                                            value={
                                                field.value
                                                    ? String(field.value)
                                                    : ''
                                            }
                                            onValueChange={(v) => {
                                                if (v === '__add__') {
                                                    setShowAddInstructor(true);
                                                    return;
                                                }
                                                field.onChange(Number(v));
                                            }}
                                        >
                                            <SelectTrigger id="edit-instructor">
                                                <SelectValue placeholder="Select instructor" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {instructors.map((inst) => (
                                                    <SelectItem
                                                        key={inst.id}
                                                        value={String(inst.id)}
                                                    >
                                                        {inst.name_last},{' '}
                                                        {inst.name_first}
                                                    </SelectItem>
                                                ))}
                                                <SelectItem
                                                    value="__add__"
                                                    className="text-[#556830] font-medium"
                                                >
                                                    + Add Instructor
                                                </SelectItem>
                                            </SelectContent>
                                        </Select>
                                    )}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label className="text-sm font-medium">
                                    Room
                                </Label>
                                <Controller
                                    name="room_id"
                                    control={control}
                                    render={({ field }) => (
                                        <Select
                                            value={
                                                field.value
                                                    ? String(field.value)
                                                    : ''
                                            }
                                            onValueChange={(v) => {
                                                if (v === '__add__') {
                                                    setShowAddRoom(true);
                                                    return;
                                                }
                                                field.onChange(Number(v));
                                            }}
                                        >
                                            <SelectTrigger id="edit-room">
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
                                                <SelectItem
                                                    value="__add__"
                                                    className="text-[#556830] font-medium"
                                                >
                                                    + Add Room
                                                </SelectItem>
                                            </SelectContent>
                                        </Select>
                                    )}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label
                                    htmlFor="edit-capacity"
                                    className="text-sm font-medium"
                                >
                                    Capacity
                                </Label>
                                <Input
                                    id="edit-capacity"
                                    type="number"
                                    min={1}
                                    {...register('capacity', {
                                        required: 'Capacity is required',
                                        min: {
                                            value: 1,
                                            message: 'Minimum 1'
                                        }
                                    })}
                                />
                                {errors.capacity && (
                                    <p className="text-sm text-red-600">
                                        {errors.capacity.message}
                                    </p>
                                )}
                                {capacityBelowEnrolled && (
                                    <p className="text-sm text-amber-600 flex items-start gap-1">
                                        <AlertCircle className="size-4 mt-0.5 flex-shrink-0" />
                                        <span>
                                            Warning: Capacity is below current
                                            enrollment ({cls.enrolled}{' '}
                                            students)
                                        </span>
                                    </p>
                                )}
                            </div>

                            <div className="space-y-2">
                                <Label
                                    htmlFor="edit-credit-hours"
                                    className="text-sm font-medium"
                                >
                                    Credit Hours
                                </Label>
                                <Input
                                    id="edit-credit-hours"
                                    type="number"
                                    min={0}
                                    {...register('credit_hours')}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label
                            htmlFor="edit-description"
                            className="text-sm font-medium"
                        >
                            Description
                        </Label>
                        <Textarea
                            id="edit-description"
                            rows={3}
                            className="resize-none"
                            {...register('description', {
                                required: 'Description is required',
                                maxLength: {
                                    value: 255,
                                    message: 'Max 255 characters'
                                }
                            })}
                        />
                        {errors.description && (
                            <p className="text-sm text-red-600">
                                {errors.description.message}
                            </p>
                        )}
                    </div>

                    <div className="space-y-4">
                        <h4 className="font-medium text-[#203622]">
                            Schedule
                        </h4>

                        <div className="space-y-2">
                            <Label className="text-sm font-medium">Days</Label>
                            <div className="flex flex-wrap gap-2">
                                {ALL_DAYS.map((day) => {
                                    const isSelected =
                                        scheduleDays.includes(day);
                                    return (
                                        <button
                                            key={day}
                                            type="button"
                                            onClick={() => toggleDay(day)}
                                            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                                                isSelected
                                                    ? 'bg-[#556830] text-white'
                                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                            }`}
                                        >
                                            {day.slice(0, 3)}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label
                                    htmlFor="edit-start-time"
                                    className="text-sm font-medium"
                                >
                                    Start Time
                                </Label>
                                <Input
                                    id="edit-start-time"
                                    type="time"
                                    {...register('start_time')}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label
                                    htmlFor="edit-end-time"
                                    className="text-sm font-medium"
                                >
                                    End Time
                                </Label>
                                <Input
                                    id="edit-end-time"
                                    type="time"
                                    {...register('end_time')}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h4 className="font-medium text-[#203622]">
                            Class Period
                        </h4>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label
                                    htmlFor="edit-start-dt"
                                    className="text-sm font-medium"
                                >
                                    Start Date
                                </Label>
                                <Input
                                    id="edit-start-dt"
                                    type="date"
                                    {...register('start_dt', {
                                        required: 'Start date is required'
                                    })}
                                />
                                {errors.start_dt && (
                                    <p className="text-sm text-red-600">
                                        {errors.start_dt.message}
                                    </p>
                                )}
                                {cls.status === SelectedClassStatus.Active &&
                                    watchedStartDt !==
                                        new Date(cls.start_dt)
                                            .toISOString()
                                            .split('T')[0] && (
                                        <p className="text-sm text-amber-600 flex items-start gap-1">
                                            <AlertCircle className="size-4 mt-0.5 flex-shrink-0" />
                                            <span>
                                                Warning: Class has already
                                                started
                                            </span>
                                        </p>
                                    )}
                            </div>
                            <div className="space-y-2">
                                <Label
                                    htmlFor="edit-end-dt"
                                    className="text-sm font-medium"
                                >
                                    End Date
                                </Label>
                                <Input
                                    id="edit-end-dt"
                                    type="date"
                                    {...register('end_dt')}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h4 className="font-medium text-[#203622]">Status</h4>
                        <div className="space-y-2">
                            <Controller
                                name="status"
                                control={control}
                                render={({ field }) => (
                                    <Select
                                        value={field.value}
                                        onValueChange={field.onChange}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem
                                                value={
                                                    SelectedClassStatus.Scheduled
                                                }
                                            >
                                                Scheduled
                                            </SelectItem>
                                            <SelectItem
                                                value={
                                                    SelectedClassStatus.Active
                                                }
                                            >
                                                Active
                                            </SelectItem>
                                            <SelectItem
                                                value={
                                                    SelectedClassStatus.Paused
                                                }
                                            >
                                                Paused
                                            </SelectItem>
                                            <SelectItem
                                                value={
                                                    SelectedClassStatus.Completed
                                                }
                                            >
                                                Completed
                                            </SelectItem>
                                            <SelectItem
                                                value={
                                                    SelectedClassStatus.Cancelled
                                                }
                                            >
                                                Cancelled
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                )}
                            />
                            {watchedStatus === 'Paused' && (
                                <p className="text-sm text-gray-600 flex items-start gap-1">
                                    <AlertCircle className="size-4 mt-0.5 flex-shrink-0" />
                                    <span>
                                        Pausing will hide this class from daily
                                        attendance views
                                    </span>
                                </p>
                            )}
                            {watchedStatus === 'Cancelled' && (
                                <p className="text-sm text-gray-600 flex items-start gap-1">
                                    <AlertCircle className="size-4 mt-0.5 flex-shrink-0" />
                                    <span>
                                        Cancelling will end this class and
                                        update all enrollments
                                    </span>
                                </p>
                            )}
                        </div>
                    </div>

                    {conflicts.length > 0 && (
                        <div className="space-y-2">
                            <p className="text-sm font-medium text-red-700">
                                Room has {conflicts.length} scheduling{' '}
                                {conflicts.length === 1
                                    ? 'conflict'
                                    : 'conflicts'}
                                :
                            </p>
                            <div className="max-h-32 overflow-y-auto space-y-2">
                                {conflicts.map((c, i) => (
                                    <div
                                        key={i}
                                        className="bg-red-50 p-2 rounded text-sm"
                                    >
                                        <p className="font-medium text-red-800">
                                            {c.class_name}
                                        </p>
                                        <p className="text-red-600">
                                            {c.start_time} - {c.end_time}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="mt-6 flex justify-end gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={isSubmitting}
                            className="bg-[#556830] hover:bg-[#203622] text-white"
                        >
                            {isSubmitting ? 'Saving...' : 'Save Changes'}
                        </Button>
                    </div>
                </form>
            </FormModal>

            <FormModal
                open={showAddRoom}
                onOpenChange={setShowAddRoom}
                title="Add Room"
            >
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="edit-new-room-name">Room Name</Label>
                        <Input
                            id="edit-new-room-name"
                            value={newRoomName}
                            onChange={(e) => setNewRoomName(e.target.value)}
                            placeholder="e.g. Room 101"
                        />
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
                </div>
            </FormModal>

            <FormModal
                open={showAddInstructor}
                onOpenChange={setShowAddInstructor}
                title="Add Instructor"
            >
                <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="edit-inst-first">First Name</Label>
                            <Input
                                id="edit-inst-first"
                                value={newInstructor.name_first}
                                onChange={(e) =>
                                    setNewInstructor((p) => ({
                                        ...p,
                                        name_first: e.target.value
                                    }))
                                }
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="edit-inst-last">Last Name</Label>
                            <Input
                                id="edit-inst-last"
                                value={newInstructor.name_last}
                                onChange={(e) =>
                                    setNewInstructor((p) => ({
                                        ...p,
                                        name_last: e.target.value
                                    }))
                                }
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="edit-inst-username">Username</Label>
                        <Input
                            id="edit-inst-username"
                            value={newInstructor.username}
                            onChange={(e) =>
                                setNewInstructor((p) => ({
                                    ...p,
                                    username: e.target.value
                                }))
                            }
                        />
                    </div>
                    <div className="flex justify-end gap-2">
                        <Button
                            variant="outline"
                            onClick={() => setShowAddInstructor(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            className="bg-[#203622] text-white hover:bg-[#203622]/90"
                            onClick={() => void handleAddInstructor()}
                        >
                            Create
                        </Button>
                    </div>
                </div>
            </FormModal>

            <FormModal
                open={showPasswordModal}
                onOpenChange={(open) => {
                    setShowPasswordModal(open);
                    if (!open) setTempPassword('');
                }}
                title="Instructor Created"
            >
                <div className="space-y-4">
                    <p className="text-sm text-gray-600">
                        Share this temporary password with the new instructor.
                        They will be prompted to change it on first login.
                    </p>
                    <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 text-center">
                        <p className="text-sm text-gray-500 mb-1">
                            Temporary Password
                        </p>
                        <p className="text-2xl font-bold text-[#203622] select-all">
                            {tempPassword}
                        </p>
                    </div>
                    <div className="flex justify-end gap-2">
                        <Button
                            variant="outline"
                            onClick={() => {
                                void navigator.clipboard.writeText(
                                    tempPassword
                                );
                                toast.success('Password copied to clipboard');
                            }}
                        >
                            Copy
                        </Button>
                        <Button
                            className="bg-[#203622] text-white hover:bg-[#203622]/90"
                            onClick={() => {
                                setShowPasswordModal(false);
                                setTempPassword('');
                            }}
                        >
                            Done
                        </Button>
                    </div>
                </div>
            </FormModal>
        </>
    );
}
