import { useState, useEffect } from 'react';
import { useNavigate, useParams, useLoaderData } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { toast } from 'sonner';
import useSWR from 'swr';
import API from '@/api/api';
import { useAuth } from '@/auth/useAuth';
import {
    ClassLoaderData,
    ProgClassStatus,
    ServerResponseMany,
    Room,
    RoomConflict,
    User
} from '@/types';
import { isCompletedCancelledOrArchived } from '@/lib/classStatus';
import { PageHeader } from '@/components/shared';
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
import { FormModal } from '@/components/shared';
import { AlertCircle, X } from 'lucide-react';

interface ClassFormData {
    name: string;
    description: string;
    instructor_id: number | null;
    capacity: number;
    credit_hours: number;
    start_dt: string;
    end_dt: string;
    status: string;
    room_id: number | null;
    start_time: string;
    end_time: string;
    days: string[];
    cadence:
        | 'no-repeat'
        | 'daily'
        | 'weekly'
        | 'biweekly'
        | 'monthly'
        | 'custom';
}

interface ClassManagementFormProps {
    programId: string;
    classId?: string;
    loaderData?: ClassLoaderData;
    onCancel?: () => void;
    onCreated?: () => void;
    embedded?: boolean;
}

const WEEKDAY_OPTIONS = [
    { label: 'Monday', value: 'MO' },
    { label: 'Tuesday', value: 'TU' },
    { label: 'Wednesday', value: 'WE' },
    { label: 'Thursday', value: 'TH' },
    { label: 'Friday', value: 'FR' },
    { label: 'Saturday', value: 'SA' },
    { label: 'Sunday', value: 'SU' }
];

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

function buildRRule(
    startDt: string,
    startTime: string,
    days: string[],
    endDt?: string,
    cadence: ClassFormData['cadence'] = 'weekly',
    customInterval?: number,
    timezone?: string
): string {
    const dtStart = `${startDt.replace(/-/g, '')}T${startTime.replace(/:/g, '')}00`;
    const tz = timezone ?? 'Local';
    let rule = `DTSTART;TZID=${tz}:${dtStart}\nRRULE:`;
    if (cadence === 'no-repeat') {
        return `${rule}FREQ=DAILY;COUNT=1`;
    }
    if (cadence === 'daily') {
        rule += 'FREQ=DAILY';
    } else if (cadence === 'custom') {
        const interval = Math.max(1, customInterval ?? 1);
        rule += `FREQ=WEEKLY;INTERVAL=${interval}`;
        if (days.length > 0) {
            rule += `;BYDAY=${days.join(',')}`;
        }
    } else if (cadence === 'monthly') {
        rule += `FREQ=MONTHLY;BYMONTHDAY=${startDt.split('-')[2]}`;
    } else {
        rule += 'FREQ=WEEKLY;INTERVAL=1';
        if (cadence === 'biweekly') {
            rule += ';INTERVAL=2';
        }
        if (days.length > 0) {
            rule += `;BYDAY=${days.join(',')}`;
        }
    }
    if (endDt) {
        rule += `;UNTIL=${endDt.replace(/-/g, '')}T235959Z`;
    }
    return rule;
}

export function ClassManagementFormInner({
    programId,
    classId,
    loaderData,
    onCancel,
    onCreated,
    embedded = false
}: ClassManagementFormProps) {
    const { user } = useAuth();
    const navigate = useNavigate();

    const isNewClass = classId === 'new' || !classId;
    const existingClass = loaderData?.class;
    const blockEdits = existingClass
        ? isCompletedCancelledOrArchived(existingClass)
        : false;

    const [rooms, setRooms] = useState<Room[]>(loaderData?.rooms ?? []);
    const [conflicts, setConflicts] = useState<RoomConflict[]>([]);
    const [showConflicts, setShowConflicts] = useState(false);
    const [showAddRoom, setShowAddRoom] = useState(false);
    const [showAddInstructor, setShowAddInstructor] = useState(false);
    const [newRoomName, setNewRoomName] = useState('');
    const [newInstructor, setNewInstructor] = useState({
        name_first: '',
        name_last: '',
        username: ''
    });
    const [roomSelectValue, setRoomSelectValue] = useState('');
    const [pendingRoomId, setPendingRoomId] = useState<number | null>(null);
    const [showCustomRecurrence, setShowCustomRecurrence] = useState(false);
    const [customRecurrenceInterval, setCustomRecurrenceInterval] =
        useState(1);

    const { data: instructorsResp, mutate: mutateInstructors } = useSWR<
        ServerResponseMany<User>
    >(user ? `/api/users?role=${user.role}&per_page=100` : null);
    const instructors = instructorsResp?.data ?? [];

    const { data: roomsResp } = useSWR<ServerResponseMany<Room>>(
        rooms.length === 0 ? '/api/rooms' : null
    );

    const {
        register,
        handleSubmit,
        control,
        reset,
        setValue,
        setError,
        watch,
        formState: { errors, isSubmitting }
    } = useForm<ClassFormData>({
        defaultValues: {
            name: '',
            description: '',
            instructor_id: null,
            capacity: 20,
            credit_hours: 0,
            start_dt: '',
            end_dt: '',
            status: ProgClassStatus.SCHEDULED,
            room_id: null,
            start_time: '',
            end_time: '',
            days: [],
            cadence: 'weekly'
        }
    });

    useEffect(() => {
        if (roomsResp?.data && rooms.length === 0) {
            setRooms(roomsResp.data);
        }
    }, [roomsResp, rooms.length]);

    const watchedDays = watch('days') ?? [];
    const watchedCadence = watch('cadence');
    const watchedEndDate = watch('end_dt');
    const watchedRoomId = watch('room_id');

    useEffect(() => {
        if (!pendingRoomId) return;
        setValue('room_id', pendingRoomId, {
            shouldDirty: true,
            shouldValidate: true
        });
        setPendingRoomId(null);
    }, [pendingRoomId, setValue]);

    useEffect(() => {
        if (!watchedRoomId) {
            setRoomSelectValue('');
            return;
        }
        setRoomSelectValue(String(watchedRoomId));
    }, [watchedRoomId]);

    useEffect(() => {
        if (existingClass && !isNewClass) {
            const event = existingClass.events?.[0];
            let startTime = '';
            let endTime = '';
            let selectedDays: string[] = [];

            if (event?.recurrence_rule) {
                try {
                    const dtMatch = /T(\d{2})(\d{2})/.exec(
                        event.recurrence_rule
                    );
                    if (dtMatch) {
                        startTime = `${dtMatch[1]}:${dtMatch[2]}`;
                    }
                    const byDayMatch = /BYDAY=([A-Z,]+)/.exec(
                        event.recurrence_rule
                    );
                    if (byDayMatch) {
                        selectedDays = byDayMatch[1].split(',');
                    }
                } catch {
                    /* parse failure */
                }
            }

            if (event?.duration && startTime) {
                const durationMatch = /(\d+)h(\d+)m/.exec(event.duration);
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

            reset({
                name: existingClass.name,
                description: existingClass.description,
                instructor_id: existingClass.instructor_id ?? null,
                capacity: existingClass.capacity,
                credit_hours: existingClass.credit_hours,
                start_dt: new Date(existingClass.start_dt)
                    .toISOString()
                    .split('T')[0],
                end_dt: existingClass.end_dt
                    ? new Date(existingClass.end_dt).toISOString().split('T')[0]
                    : '',
                status: existingClass.status,
                room_id: event?.room_id ?? null,
                start_time: startTime,
                end_time: endTime,
                days: selectedDays,
                cadence: 'weekly'
            });
        }
    }, [existingClass, isNewClass, reset]);

    const focusRing =
        'focus-visible:border-[#b3b3b3] focus-visible:ring-[#b3b3b3]/50';
    const focusRingButton =
        'focus-visible:ring-[#b3b3b3]/50 focus-visible:ring-[1px] focus-visible:outline-none';

    function endTimeIsAfterStart(startTime: string, endTime: string): boolean {
        const [sh, sm] = startTime.split(':').map(Number);
        const [eh, em] = endTime.split(':').map(Number);
        if (!Number.isFinite(sh) || !Number.isFinite(sm)) return true;
        if (!Number.isFinite(eh) || !Number.isFinite(em)) return true;
        return eh * 60 + em > sh * 60 + sm;
    }

    function getSelectedDayLabels(days: string[]) {
        return WEEKDAY_OPTIONS.filter((opt) => days.includes(opt.value)).map(
            (opt) => opt.label
        );
    }

    function getCustomRecurrencePreview() {
        const interval = Math.max(1, customRecurrenceInterval);
        const dayLabels = getSelectedDayLabels(watchedDays);
        let preview = `Every ${interval > 1 ? `${interval} ` : ''}${
            interval === 1 ? 'week' : 'weeks'
        }`;
        if (dayLabels.length > 0) {
            preview += ` on ${dayLabels.join(', ')}`;
        }
        if (watchedEndDate) {
            preview += `, ending on ${new Date(
                watchedEndDate
            ).toLocaleDateString()}`;
        } else {
            preview += ', no end date';
        }
        return preview;
    }

    function isCustomRecurrenceValid() {
        return watchedDays.length > 0;
    }

    function cadenceHelpText(value: ClassFormData['cadence']) {
        switch (value) {
            case 'weekly':
                return 'Class repeats every week on the selected days';
            case 'biweekly':
                return 'Class repeats every 2 weeks on the selected days';
            case 'daily':
                return 'Class repeats every day';
            case 'monthly':
                return 'Class repeats monthly on the same day';
            case 'no-repeat':
                return 'Class is a one-time event';
            case 'custom':
                return isCustomRecurrenceValid()
                    ? getCustomRecurrencePreview()
                    : '';
            default:
                return '';
        }
    }

    function toggleDay(day: string) {
        const current = watchedDays;
        const updated = current.includes(day)
            ? current.filter((d) => d !== day)
            : [...current, day];
        setValue('days', updated, {
            shouldDirty: true,
            shouldValidate: true
        });
    }

    async function handleAddRoom() {
        if (!newRoomName.trim()) return;
        const resp = await API.post<Room, object>('rooms', {
            name: newRoomName.trim()
        });
        if (resp.success) {
            const created = resp.data as unknown as Room;
            setRooms((prev) => [...prev, created]);
            setPendingRoomId(created.id);
            setRoomSelectValue(String(created.id));
            toast.success('Room created');
        } else {
            toast.error('Failed to create room');
        }
        setNewRoomName('');
        setShowAddRoom(false);
    }

    async function handleAddInstructor() {
        const { name_first, name_last, username } = newInstructor;
        if (!name_first.trim() || !name_last.trim() || !username.trim()) return;
        const resp = await API.post<
            { user: User; temp_password: string },
            object
        >('users', {
            user: {
                name_first: name_first.trim(),
                name_last: name_last.trim(),
                username: username.trim(),
                role: 'facility_admin'
            },
            provider_platforms: []
        });
        if (resp.success) {
            void mutateInstructors();
            toast.success('Instructor created');
        } else {
            toast.error(resp.message || 'Failed to create instructor');
        }
        setNewInstructor({ name_first: '', name_last: '', username: '' });
        setShowAddInstructor(false);
    }

    async function onSubmit(data: ClassFormData) {
        if (blockEdits) {
            toast.error('Cannot update classes that are complete or cancelled');
            return;
        }

        if (isNewClass && (!data.start_time || !data.end_time)) {
            toast.error('Start time and end time are required');
            return;
        }
        if (
            isNewClass &&
            (data.cadence === 'weekly' ||
                data.cadence === 'biweekly' ||
                data.cadence === 'custom') &&
            data.days.length === 0
        ) {
            toast.error('Select at least one day');
            return;
        }

        const duration = formatDuration(data.start_time, data.end_time);
        if (isNewClass && duration === '0h0m0s') {
            setError('end_time', {
                type: 'validate',
                message: 'End time must be after start time'
            });
            return;
        }
        const rrule = isNewClass
            ? buildRRule(
                  data.start_dt,
                  data.start_time,
                  data.days,
                  data.end_dt,
                  data.cadence,
                  customRecurrenceInterval,
                  user?.timezone
              )
            : (existingClass?.events?.[0]?.recurrence_rule ?? '');

        const payload = {
            ...(classId && classId !== 'new' && { id: Number(classId) }),
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
            start_dt: new Date(data.start_dt),
            end_dt: data.end_dt ? new Date(data.end_dt) : null,
            status: data.status,
            events: isNewClass
                ? [
                      {
                          recurrence_rule: rrule,
                          room_id: data.room_id ? Number(data.room_id) : null,
                          duration
                      }
                  ]
                : [
                      {
                          id: existingClass!.events[0].id,
                          class_id: existingClass!.events[0].class_id,
                          duration: existingClass!.events[0].duration,
                          recurrence_rule:
                              existingClass!.events[0].recurrence_rule,
                          room_id: data.room_id
                              ? Number(data.room_id)
                              : existingClass!.events[0].room_id
                      },
                      ...existingClass!.events.slice(1)
                  ]
        };

        const resp = isNewClass
            ? await API.post(`programs/${programId}/classes`, payload)
            : await API.patch(
                  `programs/${programId}/classes/${classId}`,
                  payload
              );

        if (!resp.success) {
            if (resp.status === 409 && Array.isArray(resp.data)) {
                setConflicts(resp.data as unknown as RoomConflict[]);
                setShowConflicts(true);
                return;
            }
            toast.error(
                isNewClass ? 'Failed to create class' : 'Failed to update class'
            );
            return;
        }

        toast.success(
            isNewClass
                ? 'Class created successfully'
                : 'Class updated successfully'
        );
        if (isNewClass) {
            if (onCreated) {
                onCreated();
            }
            if (!embedded) {
                navigate(`/programs/${programId}`);
            }
        } else {
            if (onCreated) {
                onCreated();
            }
            if (!embedded) {
                navigate(`/program-classes/${classId}/dashboard`);
            }
        }
    }

    const statusOptions = isNewClass
        ? {
              Scheduled: ProgClassStatus.SCHEDULED,
              Active: ProgClassStatus.ACTIVE
          }
        : ProgClassStatus;

    return (
        <div className="space-y-6">
            {!embedded && (
                <PageHeader
                    title={isNewClass ? 'Create Class' : 'Edit Class'}
                    subtitle={
                        isNewClass
                            ? 'Set up a new class for this program'
                            : 'Update class details'
                    }
                />
            )}

            <form
                onSubmit={(event) => void handleSubmit(onSubmit)(event)}
                className="space-y-6"
            >
                {embedded && (
                    <div className="space-y-6">
                        <div>
                            <h4 className="text-sm text-gray-700 mb-3">
                                Basic Information
                            </h4>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label htmlFor="name">Class Name *</Label>
                                    <Input
                                        id="name"
                                        placeholder="e.g., GED Prep - Morning Section"
                                        className={focusRing}
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
                                <div>
                                    <Label>Instructor *</Label>
                                    <Controller
                                        name="instructor_id"
                                        control={control}
                                        rules={{
                                            required: 'Instructor is required'
                                        }}
                                        render={({ field }) => (
                                            <Select
                                                value={
                                                    field.value
                                                        ? String(field.value)
                                                        : ''
                                                }
                                                onValueChange={(v) =>
                                                    field.onChange(Number(v))
                                                }
                                            >
                                                <SelectTrigger
                                                    className={focusRing}
                                                >
                                                    <SelectValue placeholder="Select instructor" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {instructors.map((inst) => (
                                                        <SelectItem
                                                            key={inst.id}
                                                            value={String(
                                                                inst.id
                                                            )}
                                                        >
                                                            {inst.name_last},{' '}
                                                            {inst.name_first}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        )}
                                    />
                                    {errors.instructor_id && (
                                        <p className="text-sm text-red-600">
                                            {errors.instructor_id.message}
                                        </p>
                                    )}
                                </div>
                                <div>
                                    <Label>Initial Status *</Label>
                                    <Controller
                                        name="status"
                                        control={control}
                                        rules={{
                                            required: 'Status is required'
                                        }}
                                        render={({ field }) => (
                                            <Select
                                                value={field.value}
                                                onValueChange={field.onChange}
                                            >
                                                <SelectTrigger
                                                    id="status"
                                                    className={focusRing}
                                                >
                                                    <SelectValue placeholder="Select status" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem
                                                        value={
                                                            ProgClassStatus.SCHEDULED
                                                        }
                                                    >
                                                        Scheduled
                                                    </SelectItem>
                                                    <SelectItem
                                                        value={
                                                            ProgClassStatus.ACTIVE
                                                        }
                                                    >
                                                        Active
                                                    </SelectItem>
                                                </SelectContent>
                                            </Select>
                                        )}
                                    />
                                    <p className="text-xs text-gray-500 mt-1">
                                        Scheduled classes will start on the
                                        start date. Active classes are already
                                        running.
                                    </p>
                                </div>
                                <div>
                                    <Label htmlFor="capacity">Capacity *</Label>
                                    <Input
                                        id="capacity"
                                        type="number"
                                        min={1}
                                        className={focusRing}
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
                                </div>
                                <div className="col-span-2">
                                    <Label htmlFor="description">
                                        Description *
                                    </Label>
                                    <Textarea
                                        id="description"
                                        placeholder="Brief description of the class"
                                        rows={2}
                                        className={focusRing}
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
                            </div>
                        </div>

                        <div className="pt-4 border-t border-gray-200">
                            <h4 className="text-sm text-gray-700 mb-3">
                                Schedule
                            </h4>
                            <div className="space-y-4">
                                <div className="grid grid-cols-3 gap-4">
                                    <div>
                                        <Label htmlFor="start_time">
                                            Start Time *
                                        </Label>
                                        <Input
                                            id="start_time"
                                            type="time"
                                            className={focusRing}
                                            {...register('start_time', {
                                                required:
                                                    'Start time is required'
                                            })}
                                        />
                                        {errors.start_time && (
                                            <p className="text-sm text-red-600">
                                                {errors.start_time.message}
                                            </p>
                                        )}
                                    </div>
                                    <div>
                                        <Label htmlFor="end_time">
                                            End Time *
                                        </Label>
                                        <Input
                                            id="end_time"
                                            type="time"
                                            className={focusRing}
                                            {...register('end_time', {
                                                required:
                                                    'End time is required',
                                                validate: (value) => {
                                                    const start =
                                                        watch('start_time');
                                                    if (!start || !value)
                                                        return true;
                                                    return (
                                                        endTimeIsAfterStart(
                                                            start,
                                                            value
                                                        ) ||
                                                        'End time must be after start time'
                                                    );
                                                }
                                            })}
                                        />
                                        {errors.end_time && (
                                            <p className="text-sm text-red-600">
                                                {errors.end_time.message}
                                            </p>
                                        )}
                                    </div>
                                    <div>
                                        <Label>Room *</Label>
                                        <Controller
                                            name="room_id"
                                            control={control}
                                            rules={{
                                                required: 'Room is required'
                                            }}
                                            render={({ field }) => (
                                                <Select
                                                    value={roomSelectValue}
                                                    onValueChange={(v) => {
                                                        if (v === '__add__') {
                                                            setShowAddRoom(
                                                                true
                                                            );
                                                            return;
                                                        }
                                                        setRoomSelectValue(v);
                                                        field.onChange(
                                                            Number(v)
                                                        );
                                                    }}
                                                >
                                                    <SelectTrigger
                                                        id="room"
                                                        className={focusRing}
                                                    >
                                                        <SelectValue placeholder="Select room" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {rooms.map((room) => (
                                                            <SelectItem
                                                                key={room.id}
                                                                value={String(
                                                                    room.id
                                                                )}
                                                            >
                                                                {room.name}
                                                            </SelectItem>
                                                        ))}
                                                        <SelectItem value="__add__">
                                                            Add Custom Room
                                                        </SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            )}
                                        />
                                        {errors.room_id && (
                                            <p className="text-sm text-red-600 mt-1">
                                                {String(errors.room_id.message)}
                                            </p>
                                        )}
                                        {showAddRoom && (
                                            <div className="mt-3 p-3 border border-gray-200 rounded-md bg-gray-50 space-y-3 animate-in slide-in-from-top-2 duration-200">
                                                <div className="flex items-start justify-between">
                                                    <div className="flex-1">
                                                        <Label
                                                            htmlFor="new-room-name"
                                                            className="text-sm font-medium"
                                                        >
                                                            Custom Room Name
                                                        </Label>
                                                        <p className="text-xs text-gray-500 mt-1">
                                                            Room names should
                                                            be specific (e.g.,
                                                            "Library - Room 3A")
                                                        </p>
                                                    </div>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => {
                                                            setShowAddRoom(
                                                                false
                                                            );
                                                            setNewRoomName('');
                                                        }}
                                                        className="h-6 w-6 p-0 -mt-1"
                                                        type="button"
                                                    >
                                                        <X className="size-4" />
                                                    </Button>
                                                </div>
                                                <Input
                                                    id="new-room-name"
                                                    placeholder="e.g., Education Wing - Room 205"
                                                    value={newRoomName}
                                                    onChange={(e) =>
                                                        setNewRoomName(
                                                            e.target.value
                                                        )
                                                    }
                                                    className={focusRing}
                                                    autoFocus
                                                />
                                                {newRoomName &&
                                                    rooms.some(
                                                        (room) =>
                                                            room.name.toLowerCase() ===
                                                            newRoomName.trim().toLowerCase()
                                                    ) && (
                                                        <div className="flex items-center gap-2 text-sm text-orange-600">
                                                            <AlertCircle className="size-4" />
                                                            <span>
                                                                This room name
                                                                already exists
                                                                in the list
                                                                above
                                                            </span>
                                                        </div>
                                                    )}
                                                <div className="flex gap-2">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => {
                                                            setShowAddRoom(
                                                                false
                                                            );
                                                            setNewRoomName('');
                                                        }}
                                                        className="flex-1"
                                                        type="button"
                                                    >
                                                        Cancel
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        onClick={() =>
                                                            void handleAddRoom()
                                                        }
                                                        disabled={
                                                            !newRoomName.trim()
                                                        }
                                                        className="flex-1 bg-[#556830] hover:bg-[#203622]"
                                                        type="button"
                                                    >
                                                        Add Room
                                                    </Button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <Label htmlFor="start_dt">
                                            Start Date *
                                        </Label>
                                        <Input
                                            id="start_dt"
                                            type="date"
                                            className={focusRing}
                                            {...register('start_dt', {
                                                required:
                                                    'Start date is required'
                                            })}
                                        />
                                        {errors.start_dt && (
                                            <p className="text-sm text-red-600">
                                                {errors.start_dt.message}
                                            </p>
                                        )}
                                    </div>
                                    <div>
                                        <Label htmlFor="end_dt">End Date</Label>
                                        <Input
                                            id="end_dt"
                                            type="date"
                                            className={focusRing}
                                            {...register('end_dt')}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <Label htmlFor="cadence">Repeats *</Label>
                                    <Controller
                                        name="cadence"
                                        control={control}
                                        render={({ field }) => (
                                            <Select
                                                value={field.value}
                                                onValueChange={(value) => {
                                                    field.onChange(value);
                                                    if (value === 'custom') {
                                                        setShowCustomRecurrence(
                                                            true
                                                        );
                                                    } else {
                                                        setShowCustomRecurrence(
                                                            false
                                                        );
                                                    }
                                                }}
                                            >
                                                <SelectTrigger
                                                    id="cadence"
                                                    className={focusRing}
                                                >
                                                    <SelectValue placeholder="Select recurrence" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="no-repeat">
                                                        Does not repeat
                                                    </SelectItem>
                                                    <SelectItem value="daily">
                                                        Daily
                                                    </SelectItem>
                                                    <SelectItem value="weekly">
                                                        Weekly
                                                    </SelectItem>
                                                    <SelectItem value="biweekly">
                                                        Every 2 weeks
                                                    </SelectItem>
                                                    <SelectItem value="monthly">
                                                        Monthly
                                                    </SelectItem>
                                                    <SelectItem value="custom">
                                                        Custom
                                                    </SelectItem>
                                                </SelectContent>
                                            </Select>
                                        )}
                                    />
                                    <p className="text-xs text-gray-500 mt-1">
                                        {cadenceHelpText(
                                            watchedCadence ?? 'weekly'
                                        )}
                                    </p>
                                    {watchedCadence === 'custom' &&
                                        !showCustomRecurrence && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() =>
                                                    setShowCustomRecurrence(
                                                        true
                                                    )
                                                }
                                                className="mt-1 h-7 text-xs text-[#556830] hover:text-[#203622] px-2"
                                                type="button"
                                            >
                                                Edit pattern
                                            </Button>
                                        )}
                                    {showCustomRecurrence && (
                                        <div className="mt-3 p-4 border border-gray-200 rounded-lg bg-gray-50 space-y-4">
                                            <div className="flex items-center justify-between">
                                                <Label className="text-sm font-medium text-gray-700">
                                                    Custom Recurrence Pattern
                                                </Label>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => {
                                                        setShowCustomRecurrence(
                                                            false
                                                        );
                                                        setValue(
                                                            'cadence',
                                                            'weekly',
                                                            {
                                                                shouldDirty:
                                                                    true,
                                                                shouldValidate:
                                                                    true
                                                            }
                                                        );
                                                    }}
                                                    className="h-6 w-6 p-0 -mt-1"
                                                    type="button"
                                                >
                                                    <X className="size-4" />
                                                </Button>
                                            </div>
                                            <div>
                                                <Label
                                                    htmlFor="customInterval"
                                                    className="text-xs"
                                                >
                                                    Repeats every X weeks
                                                </Label>
                                                <Select
                                                    value={String(
                                                        customRecurrenceInterval
                                                    )}
                                                    onValueChange={(value) =>
                                                        setCustomRecurrenceInterval(
                                                            Number(value)
                                                        )
                                                    }
                                                >
                                                    <SelectTrigger
                                                        id="customInterval"
                                                        className={`bg-white ${focusRing}`}
                                                    >
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {[
                                                            1, 2, 3, 4, 5, 6, 7,
                                                            8
                                                        ].map((num) => (
                                                            <SelectItem
                                                                key={num}
                                                                value={String(
                                                                    num
                                                                )}
                                                            >
                                                                {num}{' '}
                                                                {num === 1
                                                                    ? 'week'
                                                                    : 'weeks'}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                <p className="text-xs text-gray-500 mt-1">
                                                    Use the "Days of Week"
                                                    selector below to choose
                                                    which days
                                                </p>
                                            </div>
                                            <div className="pt-3 border-t border-gray-200">
                                                <Label className="text-xs text-gray-600">
                                                    Preview
                                                </Label>
                                                <p className="text-sm text-gray-700 mt-1">
                                                    {getCustomRecurrencePreview()}
                                                </p>
                                            </div>
                                            {!isCustomRecurrenceValid() && (
                                                <div className="flex items-center gap-2 text-sm text-red-600">
                                                    <AlertCircle className="size-4" />
                                                    <span>
                                                        Please select at least
                                                        one day of the week
                                                        below
                                                    </span>
                                                </div>
                                            )}
                                            <div className="flex gap-2 pt-2">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => {
                                                        setShowCustomRecurrence(
                                                            false
                                                        );
                                                        setValue(
                                                            'cadence',
                                                            'weekly',
                                                            {
                                                                shouldDirty:
                                                                    true,
                                                                shouldValidate:
                                                                    true
                                                            }
                                                        );
                                                    }}
                                                    className="flex-1"
                                                    type="button"
                                                >
                                                    Cancel
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    onClick={() => {
                                                        if (
                                                            isCustomRecurrenceValid()
                                                        ) {
                                                            setValue(
                                                                'cadence',
                                                                'custom',
                                                                {
                                                                    shouldDirty:
                                                                        true,
                                                                    shouldValidate:
                                                                        true
                                                                }
                                                            );
                                                            setShowCustomRecurrence(
                                                                false
                                                            );
                                                            toast.success(
                                                                'Custom recurrence pattern applied'
                                                            );
                                                        }
                                                    }}
                                                    disabled={
                                                        !isCustomRecurrenceValid()
                                                    }
                                                    className="flex-1 bg-[#556830] hover:bg-[#203622]"
                                                    type="button"
                                                >
                                                    Apply Pattern
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                {(watchedCadence === 'weekly' ||
                                    watchedCadence === 'biweekly' ||
                                    watchedCadence === 'custom') && (
                                    <div className="!mt-0">
                                        <Label>Days of Week *</Label>
                                        <input
                                            type="hidden"
                                            {...register('days', {
                                                validate: (value) =>
                                                    (value?.length ?? 0) > 0 ||
                                                    'Days of week is required'
                                            })}
                                        />
                                        <div className="flex flex-wrap gap-2 mt-2">
                                            {WEEKDAY_OPTIONS.map((day) => (
                                                <button
                                                    key={day.value}
                                                    type="button"
                                                    onClick={() =>
                                                        toggleDay(day.value)
                                                    }
                                                    className={`px-4 py-2 rounded-lg border transition-colors ${
                                                        watchedDays.includes(
                                                            day.value
                                                        )
                                                            ? 'bg-[#556830] text-white border-[#556830]'
                                                            : 'bg-white text-gray-700 border-gray-300 hover:border-[#556830]'
                                                    } ${focusRingButton}`}
                                                >
                                                    {day.label.slice(0, 3)}
                                                </button>
                                            ))}
                                        </div>
                                        {errors.days && (
                                            <p className="text-sm text-red-600 mt-1">
                                                {String(errors.days.message)}
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 pt-4">
                            <Button
                                variant="outline"
                                onClick={() => onCancel?.()}
                                className={`border-gray-300 ${focusRingButton}`}
                                type="button"
                            >
                                Cancel
                            </Button>
                            <Button
                                className={`bg-[#556830] hover:bg-[#203622] text-white ${focusRingButton}`}
                                type="submit"
                                disabled={isSubmitting}
                            >
                                {isSubmitting ? 'Saving...' : 'Create Class'}
                            </Button>
                        </div>
                    </div>
                )}

                {!embedded && (
                    <>
                        <div className="bg-card rounded-lg border border-border p-6 space-y-4">
                            <h2 className="text-lg font-semibold text-foreground">
                                Class Information
                            </h2>

                            <div className="space-y-2">
                                <Label htmlFor="name">Name</Label>
                                <Input
                                    id="name"
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

                            <div className="space-y-2">
                                <Label htmlFor="description">Description</Label>
                                <Textarea
                                    id="description"
                                    rows={3}
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

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Instructor</Label>
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
                                                        setShowAddInstructor(
                                                            true
                                                        );
                                                        return;
                                                    }
                                                    field.onChange(Number(v));
                                                }}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select instructor" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {instructors.map((inst) => (
                                                        <SelectItem
                                                            key={inst.id}
                                                            value={String(
                                                                inst.id
                                                            )}
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
                                    <Label htmlFor="capacity">Capacity</Label>
                                    <Input
                                        id="capacity"
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
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Room</Label>
                                    <Controller
                                        name="room_id"
                                        control={control}
                                        rules={{
                                            required: 'Room is required'
                                        }}
                                        render={({ field }) => (
                                            <Select
                                                value={roomSelectValue}
                                                onValueChange={(v) => {
                                                    if (v === '__add__') {
                                                        setShowAddRoom(true);
                                                        return;
                                                    }
                                                    setRoomSelectValue(v);
                                                    field.onChange(Number(v));
                                                }}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select room" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {rooms.map((room) => (
                                                        <SelectItem
                                                            key={room.id}
                                                            value={String(
                                                                room.id
                                                            )}
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
                                    {errors.room_id && (
                                        <p className="text-sm text-red-600 mt-1">
                                            {String(errors.room_id.message)}
                                        </p>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="credit_hours">
                                        Credit Hours
                                    </Label>
                                    <Input
                                        id="credit_hours"
                                        type="number"
                                        min={0}
                                        {...register('credit_hours')}
                                    />
                                </div>
                            </div>
                        </div>

                        {isNewClass && (
                            <div className="bg-card rounded-lg border border-border p-6 space-y-4">
                                <h2 className="text-lg font-semibold text-foreground">
                                    Scheduling
                                </h2>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="start_dt">
                                            Start Date
                                        </Label>
                                        <Input
                                            id="start_dt"
                                            type="date"
                                            {...register('start_dt', {
                                                required:
                                                    'Start date is required'
                                            })}
                                        />
                                        {errors.start_dt && (
                                            <p className="text-sm text-red-600">
                                                {errors.start_dt.message}
                                            </p>
                                        )}
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="end_dt">End Date</Label>
                                        <Input
                                            id="end_dt"
                                            type="date"
                                            {...register('end_dt')}
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="start_time">
                                            Start Time
                                        </Label>
                                        <Input
                                            id="start_time"
                                            type="time"
                                            {...register('start_time', {
                                                required:
                                                    'Start time is required'
                                            })}
                                        />
                                        {errors.start_time && (
                                            <p className="text-sm text-red-600">
                                                {errors.start_time.message}
                                            </p>
                                        )}
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="end_time">
                                            End Time
                                        </Label>
                                        <Input
                                            id="end_time"
                                            type="time"
                                            {...register('end_time', {
                                                required:
                                                    'End time is required',
                                                validate: (value) => {
                                                    const start =
                                                        watch('start_time');
                                                    if (!start || !value)
                                                        return true;
                                                    return (
                                                        endTimeIsAfterStart(
                                                            start,
                                                            value
                                                        ) ||
                                                        'End time must be after start time'
                                                    );
                                                }
                                            })}
                                        />
                                        {errors.end_time && (
                                            <p className="text-sm text-red-600">
                                                {errors.end_time.message}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label>Days of Week *</Label>
                                    <input
                                        type="hidden"
                                        {...register('days', {
                                            validate: (value) =>
                                                (value?.length ?? 0) > 0 ||
                                                'Days of week is required'
                                        })}
                                    />
                                    <div className="flex flex-wrap gap-2">
                                        {WEEKDAY_OPTIONS.map((day) => (
                                            <Button
                                                key={day.value}
                                                type="button"
                                                variant={
                                                    watchedDays.includes(
                                                        day.value
                                                    )
                                                        ? 'default'
                                                        : 'outline'
                                                }
                                                size="sm"
                                                className={
                                                    watchedDays.includes(
                                                        day.value
                                                    )
                                                        ? 'bg-[#556830] hover:bg-[#203622] text-white'
                                                        : 'border-gray-300'
                                                }
                                                onClick={() =>
                                                    toggleDay(day.value)
                                                }
                                            >
                                                {day.label.slice(0, 3)}
                                            </Button>
                                        ))}
                                    </div>
                                    {errors.days && (
                                        <p className="text-sm text-red-600 mt-1">
                                            {String(errors.days.message)}
                                        </p>
                                    )}
                                </div>
                            </div>
                        )}

                        <div className="bg-card rounded-lg border border-border p-6 space-y-4">
                            <h2 className="text-lg font-semibold text-foreground">
                                Status
                            </h2>
                            <div className="space-y-2">
                                <Label>Class Status</Label>
                                <Controller
                                    name="status"
                                    control={control}
                                    rules={{ required: 'Status is required' }}
                                    render={({ field }) => (
                                        <Select
                                            value={field.value}
                                            onValueChange={field.onChange}
                                            disabled={blockEdits}
                                        >
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {Object.entries(
                                                    statusOptions
                                                ).map(([label, value]) => (
                                                    <SelectItem
                                                        key={value}
                                                        value={value}
                                                    >
                                                        {label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    )}
                                />
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-3">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                    if (onCancel) {
                                        onCancel();
                                        return;
                                    }
                                    navigate(`/programs/${programId}`);
                                }}
                                className="border-gray-300"
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                disabled={isSubmitting}
                                className="bg-[#F1B51C] text-foreground hover:bg-[#F1B51C]/90"
                            >
                                {isSubmitting
                                    ? 'Saving...'
                                    : isNewClass
                                      ? 'Create Class'
                                      : 'Save Changes'}
                            </Button>
                        </div>
                    </>
                )}
            </form>

            <FormModal
                open={showConflicts}
                onOpenChange={setShowConflicts}
                title="Room Scheduling Conflict"
                description="The selected room has conflicts with existing classes."
            >
                <div className="space-y-3">
                    {conflicts.map((c, i) => (
                        <div
                            key={i}
                            className="bg-red-50 p-3 rounded-lg text-sm"
                        >
                            <p className="font-medium text-red-800">
                                {c.class_name}
                            </p>
                            <p className="text-red-600">
                                {c.start_time} - {c.end_time}
                            </p>
                        </div>
                    ))}
                    <div className="flex justify-end">
                        <Button
                            variant="outline"
                            onClick={() => setShowConflicts(false)}
                        >
                            Close
                        </Button>
                    </div>
                </div>
            </FormModal>

            {!embedded && (
                <FormModal
                    open={showAddRoom}
                    onOpenChange={setShowAddRoom}
                    title="Add Room"
                >
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="new-room-name">Room Name</Label>
                            <Input
                                id="new-room-name"
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
            )}

            {!embedded && (
                <FormModal
                    open={showAddInstructor}
                    onOpenChange={setShowAddInstructor}
                    title="Add Instructor"
                >
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="inst-first">First Name</Label>
                                <Input
                                    id="inst-first"
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
                                <Label htmlFor="inst-last">Last Name</Label>
                                <Input
                                    id="inst-last"
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
                            <Label htmlFor="inst-username">Username</Label>
                            <Input
                                id="inst-username"
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
            )}
        </div>
    );
}

export default function ClassManagementForm() {
    const { id: programId, class_id } = useParams<{
        id: string;
        class_id?: string;
    }>();
    const loaderData = useLoaderData() as ClassLoaderData;

    if (!programId) {
        return null;
    }

    return (
        <ClassManagementFormInner
            programId={programId}
            classId={class_id}
            loaderData={loaderData}
        />
    );
}
