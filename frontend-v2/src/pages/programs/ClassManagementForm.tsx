import { useState, useEffect } from 'react';
import { useNavigate, useParams, useLoaderData } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { toast } from 'sonner';
import useSWR from 'swr';
import API from '@/api/api';
import { useAuth } from '@/auth/useAuth';
import {
    Class,
    ClassLoaderData,
    ProgClassStatus,
    SelectedClassStatus,
    ServerResponseMany,
    Room,
    RoomConflict
} from '@/types';
import { Instructor } from '@/types/events';
import { isCompletedCancelledOrArchived } from './ProgramOverviewDashboard';
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
import { ConfirmDialog } from '@/components/shared';
import { FormModal } from '@/components/shared';

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

function buildRRule(startDt: string, startTime: string, days: string[], endDt?: string): string {
    const dtStart = `${startDt.replace(/-/g, '')}T${startTime.replace(/:/g, '')}00`;
    let rule = `DTSTART;TZID=Local:${dtStart}\nRRULE:FREQ=WEEKLY;BYDAY=${days.join(',')}`;
    if (endDt) {
        rule += `;UNTIL=${endDt.replace(/-/g, '')}T235959Z`;
    }
    return rule;
}

export default function ClassManagementForm() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { id: programId, class_id } = useParams<{ id: string; class_id?: string }>();
    const loaderData = useLoaderData() as ClassLoaderData;

    const isNewClass = class_id === 'new' || !class_id;
    const existingClass = loaderData?.class;
    const blockEdits = existingClass ? isCompletedCancelledOrArchived(existingClass) : false;

    const [rooms, setRooms] = useState<Room[]>(loaderData?.rooms ?? []);
    const [conflicts, setConflicts] = useState<RoomConflict[]>([]);
    const [showConflicts, setShowConflicts] = useState(false);

    const { data: instructorsResp } = useSWR<ServerResponseMany<Instructor>>(
        user ? `/api/users?role=instructor&facility_id=${user.facility.id}` : null
    );
    const instructors = instructorsResp?.data ?? [];

    const { data: roomsResp } = useSWR<ServerResponseMany<Room>>(
        rooms.length === 0 ? '/api/rooms' : null
    );

    useEffect(() => {
        if (roomsResp?.data && rooms.length === 0) {
            setRooms(roomsResp.data);
        }
    }, [roomsResp, rooms.length]);

    const {
        register,
        handleSubmit,
        control,
        reset,
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
            days: []
        }
    });

    useEffect(() => {
        if (existingClass && !isNewClass) {
            const event = existingClass.events?.[0];
            let startTime = '';
            let endTime = '';
            let selectedDays: string[] = [];

            if (event?.recurrence_rule) {
                try {
                    const dtMatch = /T(\d{2})(\d{2})/.exec(event.recurrence_rule);
                    if (dtMatch) {
                        startTime = `${dtMatch[1]}:${dtMatch[2]}`;
                    }
                    const byDayMatch = /BYDAY=([A-Z,]+)/.exec(event.recurrence_rule);
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
                    const totalMin = (sh ?? 0) * 60 + (sm ?? 0) + Number(hours) * 60 + Number(mins);
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
                start_dt: new Date(existingClass.start_dt).toISOString().split('T')[0],
                end_dt: existingClass.end_dt
                    ? new Date(existingClass.end_dt).toISOString().split('T')[0]
                    : '',
                status: existingClass.status,
                room_id: event?.room_id ?? null,
                start_time: startTime,
                end_time: endTime,
                days: selectedDays
            });
        }
    }, [existingClass, isNewClass, reset]);

    const watchedDays = watch('days') ?? [];

    function toggleDay(day: string) {
        const current = watchedDays;
        const updated = current.includes(day)
            ? current.filter((d) => d !== day)
            : [...current, day];
        reset({ ...watch(), days: updated });
    }

    async function onSubmit(data: ClassFormData) {
        if (blockEdits) {
            toast.error('Cannot update classes that are complete or cancelled');
            return;
        }

        const duration = formatDuration(data.start_time, data.end_time);
        const rrule = isNewClass
            ? buildRRule(data.start_dt, data.start_time, data.days, data.end_dt)
            : existingClass?.events?.[0]?.recurrence_rule ?? '';

        const payload = {
            ...(class_id && class_id !== 'new' && { id: Number(class_id) }),
            name: data.name,
            description: data.description,
            instructor_id: data.instructor_id ? Number(data.instructor_id) : null,
            capacity: Number(data.capacity),
            credit_hours: Number(data.credit_hours) > 0 ? Number(data.credit_hours) : null,
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
                          recurrence_rule: existingClass!.events[0].recurrence_rule,
                          room_id: data.room_id
                              ? Number(data.room_id)
                              : existingClass!.events[0].room_id
                      },
                      ...existingClass!.events.slice(1)
                  ]
        };

        const resp = isNewClass
            ? await API.post(`programs/${programId}/classes`, payload)
            : await API.patch(`programs/${programId}/classes/${class_id}`, payload);

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
            isNewClass ? 'Class created successfully' : 'Class updated successfully'
        );
        if (isNewClass) {
            navigate(`/programs/${programId}`);
        } else {
            navigate(`/program-classes/${class_id}/dashboard`);
        }
    }

    const statusOptions = isNewClass
        ? { Scheduled: ProgClassStatus.SCHEDULED, Active: ProgClassStatus.ACTIVE }
        : ProgClassStatus;

    return (
        <div className="space-y-6">
            <PageHeader
                title={isNewClass ? 'Create Class' : 'Edit Class'}
                subtitle={isNewClass ? 'Set up a new class for this program' : 'Update class details'}
            />

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
                    <h2 className="text-lg font-semibold text-[#203622]">
                        Class Information
                    </h2>

                    <div className="space-y-2">
                        <Label htmlFor="name">Name</Label>
                        <Input
                            id="name"
                            {...register('name', {
                                required: 'Class name is required',
                                maxLength: { value: 255, message: 'Max 255 characters' }
                            })}
                        />
                        {errors.name && (
                            <p className="text-sm text-red-600">{errors.name.message}</p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="description">Description</Label>
                        <Textarea
                            id="description"
                            rows={3}
                            {...register('description', {
                                required: 'Description is required',
                                maxLength: { value: 255, message: 'Max 255 characters' }
                            })}
                        />
                        {errors.description && (
                            <p className="text-sm text-red-600">{errors.description.message}</p>
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
                                        value={field.value ? String(field.value) : ''}
                                        onValueChange={(v) => field.onChange(Number(v))}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select instructor" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {instructors.map((inst) => (
                                                <SelectItem
                                                    key={inst.id}
                                                    value={String(inst.id)}
                                                >
                                                    {inst.name_last}, {inst.name_first}
                                                </SelectItem>
                                            ))}
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
                                    min: { value: 1, message: 'Minimum 1' }
                                })}
                            />
                            {errors.capacity && (
                                <p className="text-sm text-red-600">{errors.capacity.message}</p>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Room</Label>
                            <Controller
                                name="room_id"
                                control={control}
                                render={({ field }) => (
                                    <Select
                                        value={field.value ? String(field.value) : ''}
                                        onValueChange={(v) => field.onChange(Number(v))}
                                    >
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
                                )}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="credit_hours">Credit Hours</Label>
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
                    <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
                        <h2 className="text-lg font-semibold text-[#203622]">
                            Scheduling
                        </h2>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="start_dt">Start Date</Label>
                                <Input
                                    id="start_dt"
                                    type="date"
                                    {...register('start_dt', {
                                        required: 'Start date is required'
                                    })}
                                />
                                {errors.start_dt && (
                                    <p className="text-sm text-red-600">{errors.start_dt.message}</p>
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
                                <Label htmlFor="start_time">Start Time</Label>
                                <Input
                                    id="start_time"
                                    type="time"
                                    {...register('start_time', {
                                        required: 'Start time is required'
                                    })}
                                />
                                {errors.start_time && (
                                    <p className="text-sm text-red-600">{errors.start_time.message}</p>
                                )}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="end_time">End Time</Label>
                                <Input
                                    id="end_time"
                                    type="time"
                                    {...register('end_time', {
                                        required: 'End time is required'
                                    })}
                                />
                                {errors.end_time && (
                                    <p className="text-sm text-red-600">{errors.end_time.message}</p>
                                )}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Days of Week</Label>
                            <div className="flex flex-wrap gap-2">
                                {WEEKDAY_OPTIONS.map((day) => (
                                    <Button
                                        key={day.value}
                                        type="button"
                                        variant={watchedDays.includes(day.value) ? 'default' : 'outline'}
                                        size="sm"
                                        className={
                                            watchedDays.includes(day.value)
                                                ? 'bg-[#556830] hover:bg-[#203622] text-white'
                                                : 'border-gray-300'
                                        }
                                        onClick={() => toggleDay(day.value)}
                                    >
                                        {day.label.slice(0, 3)}
                                    </Button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Status</Label>
                            <Controller
                                name="status"
                                control={control}
                                rules={{ required: 'Status is required' }}
                                render={({ field }) => (
                                    <Select value={field.value} onValueChange={field.onChange}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {Object.entries(statusOptions).map(([label, value]) => (
                                                <SelectItem key={value} value={value}>
                                                    {label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                )}
                            />
                        </div>
                    </div>
                )}

                <div className="flex items-center justify-end gap-3">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => navigate(`/programs/${programId}`)}
                        className="border-gray-300"
                    >
                        Cancel
                    </Button>
                    <Button
                        type="submit"
                        disabled={isSubmitting}
                        className="bg-[#F1B51C] text-[#203622] hover:bg-[#F1B51C]/90"
                    >
                        {isSubmitting
                            ? 'Saving...'
                            : isNewClass
                              ? 'Create Class'
                              : 'Save Changes'}
                    </Button>
                </div>
            </form>

            <FormModal
                open={showConflicts}
                onOpenChange={setShowConflicts}
                title="Room Scheduling Conflict"
                description="The selected room has conflicts with existing classes."
            >
                <div className="space-y-3">
                    {conflicts.map((c, i) => (
                        <div key={i} className="bg-red-50 p-3 rounded-lg text-sm">
                            <p className="font-medium text-red-800">{c.class_name}</p>
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
        </div>
    );
}
