import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { toast } from 'sonner';
import useSWR from 'swr';
import { AlertCircle, X } from 'lucide-react';
import API from '@/api/api';
import { useAuth } from '@/auth/useAuth';
import { FormModal } from '@/components/shared';
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
  credit_hours: number | null;
  start_dt: string;
  end_dt: string;
  room_id: number | null;
  start_time: string;
  end_time: string;
  cadence: string;
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
): { days: string[]; startTime: string; endTime: string; cadence: string; interval: number } {
  let startTime = '';
  let endTime = '';
  let days: string[] = [];
  let cadence = 'no-repeat';
  let interval = 1;

  const dtMatch = /T(\d{2})(\d{2})/.exec(recurrenceRule);
  if (dtMatch) {
    startTime = `${dtMatch[1]}:${dtMatch[2]}`;
  }

  const freqMatch = /FREQ=(\w+)/.exec(recurrenceRule);
  if (freqMatch) {
    const freq = freqMatch[1];
    const intervalMatch = /INTERVAL=(\d+)/.exec(recurrenceRule);
    interval = intervalMatch ? Number(intervalMatch[1]) : 1;

    if (freq === 'DAILY') cadence = 'daily';
    else if (freq === 'WEEKLY' && interval === 2) cadence = 'biweekly';
    else if (freq === 'WEEKLY' && interval > 2) cadence = 'custom';
    else if (freq === 'WEEKLY') cadence = 'weekly';
    else if (freq === 'MONTHLY') cadence = 'monthly';
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

  return { days, startTime, endTime, cadence, interval };
}

function buildRecurrenceRule(
  originalRule: string,
  startDate: string,
  startTime: string,
  days: string[],
  cadence: string,
  customInterval?: number,
  endDate?: string
): string {
  const tzMatch = /DTSTART;TZID=([^:]+):/.exec(originalRule);
  const tz = tzMatch?.[1] ?? 'Local';

  const dtStart = `${startDate.replace(/-/g, '')}T${startTime.replace(/:/g, '')}00`;

  if (cadence === 'no-repeat') {
    return `DTSTART;TZID=${tz}:${dtStart}`;
  }

  const freqMap: Record<string, string> = {
    daily: 'DAILY',
    weekly: 'WEEKLY',
    biweekly: 'WEEKLY',
    custom: 'WEEKLY',
    monthly: 'MONTHLY'
  };
  let rule = `DTSTART;TZID=${tz}:${dtStart}\nRRULE:FREQ=${freqMap[cadence] ?? 'WEEKLY'}`;

  if (cadence === 'biweekly') {
    rule += ';INTERVAL=2';
  } else if (cadence === 'custom' && customInterval && customInterval > 1) {
    rule += `;INTERVAL=${customInterval}`;
  }

  if (
    days.length > 0 &&
    (cadence === 'weekly' || cadence === 'biweekly' || cadence === 'custom')
  ) {
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

  const activeEvent = cls.events?.find((e) => !e.is_cancelled);
  const initialSchedule = activeEvent
    ? parseScheduleFromEvent(activeEvent.recurrence_rule, activeEvent.duration)
    : { days: [], startTime: '', endTime: '', cadence: 'weekly', interval: 1 };

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
  const [scheduleDays, setScheduleDays] = useState<string[]>(initialSchedule.days);
  const [showCustomRecurrence, setShowCustomRecurrence] = useState(false);
  const [customRecurrence, setCustomRecurrence] = useState({ interval: initialSchedule.interval });

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
    watch,
    setValue,
    formState: { errors, isSubmitting }
  } = useForm<EditClassFormData>({
    values: {
      name: cls.name,
      description: cls.description,
      instructor_id: cls.instructor_id ?? null,
      capacity: cls.capacity,
      credit_hours: cls.credit_hours ?? null,
      start_dt: cls.start_dt.split('T')[0],
      end_dt: cls.end_dt ? cls.end_dt.split('T')[0] : '',
      room_id: activeEvent?.room_id ?? null,
      start_time: initialSchedule.startTime,
      end_time: initialSchedule.endTime,
      cadence: initialSchedule.cadence,
      status: cls.status
    },
    resetOptions: { keepDirtyValues: true }
  });

  const watchedInstructorId = watch('instructor_id');
  const watchedCapacity = watch('capacity');
  const watchedCadence = watch('cadence');
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

  function getCustomRecurrencePreview(): string {
    const { interval } = customRecurrence;
    let preview = `Every ${interval > 1 ? interval + ' ' : ''}`;
    preview += interval === 1 ? 'week' : 'weeks';
    if (scheduleDays.length > 0) {
      preview += ` on ${scheduleDays.join(', ')}`;
    }
    const endDt = watch('end_dt');
    if (endDt) {
      preview += `, ending on ${new Date(endDt).toLocaleDateString()}`;
    } else {
      preview += ', no end date';
    }
    return preview;
  }

  function isCustomRecurrenceValid(): boolean {
    return scheduleDays.length > 0;
  }

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
      data.cadence,
      data.cadence === 'custom' ? customRecurrence.interval : undefined,
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
      credit_hours: data.credit_hours != null && data.credit_hours !== '' ? Number(data.credit_hours) : null,
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
        <div className="space-y-6">
<div className="space-y-4">
            <h4 className="font-medium text-[#203622]">
              Class Details
            </h4>

            <div className="space-y-2">
              <label
                htmlFor="edit-name"
                className="text-sm font-medium"
              >
                Class Name
              </label>
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

            <div className="space-y-2">
              <label
                htmlFor="edit-instructor"
                className="text-sm font-medium"
              >
                Instructor
              </label>
              <Select
                value={
                  watchedInstructorId
                    ? String(watchedInstructorId)
                    : undefined
                }
                onValueChange={(v) => {
                  if (v === '__add__') {
                    setShowAddInstructor(true);
                    return;
                  }
                  setValue('instructor_id', Number(v));
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
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label
                  htmlFor="edit-capacity"
                  className="text-sm font-medium"
                >
                  Capacity
                </label>
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
                <label
                  htmlFor="edit-credit-hours"
                  className="text-sm font-medium"
                >
                  Credit Hours
                </label>
                <Input
                  id="edit-credit-hours"
                  type="number"
                  min={0}
                  {...register('credit_hours', {
                    min: {
                      value: 0,
                      message: 'Minimum 0'
                    }
                  })}
                />
                {errors.credit_hours && (
                  <p className="text-sm text-red-600">
                    {errors.credit_hours.message}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label
              htmlFor="edit-description"
              className="text-sm font-medium"
            >
              Description
            </label>
            <textarea
              id="edit-description"
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#556830] resize-none"
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

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="edit-start-time">
                  Start Time *
                </Label>
                <Input
                  id="edit-start-time"
                  type="time"
                  {...register('start_time')}
                />
              </div>

              <div>
                <Label htmlFor="edit-end-time">
                  End Time *
                </Label>
                <Input
                  id="edit-end-time"
                  type="time"
                  {...register('end_time')}
                />
              </div>

              <div>
                <Label htmlFor="edit-room">Room *</Label>
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
              <div>
                <Label htmlFor="edit-start-dt">
                  Start Date *
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
              <div>
                <Label htmlFor="edit-end-dt">
                  End Date
                </Label>
                <Input
                  id="edit-end-dt"
                  type="date"
                  {...register('end_dt')}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="edit-cadence">
                Repeats *
              </Label>
              <Controller
                name="cadence"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(value) => {
                      field.onChange(value);
                      if (value === 'custom') {
                        setShowCustomRecurrence(true);
                      } else {
                        setShowCustomRecurrence(false);
                      }
                    }}
                  >
                    <SelectTrigger id="edit-cadence">
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
              {!showCustomRecurrence && (
                <p className="text-xs text-gray-500 mt-1">
                  {watchedCadence === 'weekly' &&
                    'Class repeats every week on the selected days'}
                  {watchedCadence === 'biweekly' &&
                    'Class repeats every 2 weeks on the selected days'}
                  {watchedCadence === 'daily' &&
                    'Class repeats every day'}
                  {watchedCadence === 'monthly' &&
                    'Class repeats monthly on the same day'}
                  {watchedCadence === 'no-repeat' &&
                    'Class is a one-time event'}
                  {watchedCadence === 'custom' &&
                    getCustomRecurrencePreview()}
                </p>
              )}
              {watchedCadence === 'custom' &&
                !showCustomRecurrence && (
                  <Button
                    variant="ghost"
                    size="sm"
                    type="button"
                    onClick={() =>
                      setShowCustomRecurrence(true)
                    }
                    className="mt-1 h-7 text-xs text-[#556830] hover:text-[#203622] px-2"
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
                      type="button"
                      onClick={() => {
                        setShowCustomRecurrence(false);
                        setValue('cadence', 'weekly');
                      }}
                      className="h-6 w-6 p-0 -mt-1"
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
                      value={customRecurrence.interval.toString()}
                      onValueChange={(value) =>
                        setCustomRecurrence({
                          ...customRecurrence,
                          interval: parseInt(value)
                        })
                      }
                    >
                      <SelectTrigger
                        id="customInterval"
                        className="bg-white"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 4, 5, 6, 7, 8].map(
                          (num) => (
                            <SelectItem
                              key={num}
                              value={num.toString()}
                            >
                              {num}{' '}
                              {num === 1
                                ? 'week'
                                : 'weeks'}
                            </SelectItem>
                          )
                        )}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-gray-500 mt-1">
                      Use the &quot;Days of Week&quot;
                      selector below to choose which days
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
                        Please select at least one day
                        of the week below
                      </span>
                    </div>
                  )}

                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      type="button"
                      onClick={() => {
                        setShowCustomRecurrence(false);
                        setValue('cadence', 'weekly');
                      }}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      type="button"
                      onClick={() => {
                        if (isCustomRecurrenceValid()) {
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
                    >
                      Apply Pattern
                    </Button>
                  </div>
                </div>
              )}

              {(watchedCadence === 'weekly' ||
                watchedCadence === 'biweekly' ||
                watchedCadence === 'custom') && (
                  <div className="mt-2">
                    <Label>Days of Week *</Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {ALL_DAYS.map((day) => {
                        const isSelected =
                          scheduleDays.includes(day);
                        return (
                          <button
                            key={day}
                            type="button"
                            onClick={() =>
                              toggleDay(day)
                            }
                            className={`px-4 py-2 rounded-lg border transition-colors ${isSelected
                                ? 'bg-[#556830] text-white border-[#556830]'
                                : 'bg-white text-gray-700 border-gray-300 hover:border-[#556830]'
                              }`}
                          >
                            {day.slice(0, 3)}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
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
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={isSubmitting}
            onClick={() => void handleSubmit(onSubmit)()}
            className="bg-[#556830] hover:bg-[#203622] text-white"
          >
            {isSubmitting ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
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
