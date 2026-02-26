import { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { toast } from 'sonner';
import useSWR from 'swr';
import API from '@/api/api';
import { useAuth } from '@/auth/useAuth';
import { FormModal } from '@/components/shared';
import { StatusBadge } from '@/components/shared';
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
import {
    Class,
    Room,
    RoomConflict,
    User,
    ServerResponseMany
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
}

export function EditClassModal({
    open,
    onOpenChange,
    cls,
    onUpdated
}: EditClassModalProps) {
    const { user } = useAuth();

    const [rooms, setRooms] = useState<Room[]>([]);
    const [conflicts, setConflicts] = useState<RoomConflict[]>([]);
    const [showAddRoom, setShowAddRoom] = useState(false);
    const [showAddInstructor, setShowAddInstructor] = useState(false);
    const [newRoomName, setNewRoomName] = useState('');
    const [newInstructor, setNewInstructor] = useState({
        name_first: '',
        name_last: '',
        username: ''
    });

    const { data: instructorsResp, mutate: mutateInstructors } =
        useSWR<ServerResponseMany<User>>(
            user ? `/api/users?role=${user.role}&per_page=100` : null
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
    } = useForm<EditClassFormData>({
        defaultValues: {
            name: '',
            description: '',
            instructor_id: null,
            capacity: 20,
            credit_hours: 0,
            start_dt: '',
            end_dt: '',
            room_id: null
        }
    });

    useEffect(() => {
        if (cls && open) {
            const event = cls.events?.[0];
            reset({
                name: cls.name,
                description: cls.description,
                instructor_id: cls.instructor_id ?? null,
                capacity: cls.capacity,
                credit_hours: cls.credit_hours,
                start_dt: new Date(cls.start_dt).toISOString().split('T')[0],
                end_dt: cls.end_dt
                    ? new Date(cls.end_dt).toISOString().split('T')[0]
                    : '',
                room_id: event?.room_id ?? null
            });
            setConflicts([]);
        }
    }, [cls, open, reset]);

    const watchedCapacity = watch('capacity');
    const capacityBelowEnrolled =
        watchedCapacity !== undefined &&
        Number(watchedCapacity) < cls.enrolled;

    async function handleAddRoom() {
        if (!newRoomName.trim()) return;
        const resp = await API.post<Room, object>('rooms', {
            name: newRoomName.trim()
        });
        if (resp.success) {
            const created = resp.data as unknown as Room;
            setRooms((prev) => [...prev, created]);
            reset({ ...watch(), room_id: created.id });
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
        const resp = await API.post<object, object>('users', {
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

    async function onSubmit(data: EditClassFormData) {
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
            start_dt: new Date(data.start_dt),
            end_dt: data.end_dt ? new Date(data.end_dt) : null,
            events: [
                {
                    id: cls.events[0].id,
                    class_id: cls.events[0].class_id,
                    duration: cls.events[0].duration,
                    recurrence_rule: cls.events[0].recurrence_rule,
                    room_id: data.room_id
                        ? Number(data.room_id)
                        : cls.events[0].room_id
                },
                ...cls.events.slice(1)
            ]
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
                className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto"
            >
                <form
                    onSubmit={(e) => {
                        void handleSubmit(onSubmit)(e);
                    }}
                    className="space-y-6"
                >
                    <div className="space-y-4">
                        <h3 className="text-sm font-semibold text-foreground">
                            Class Details
                        </h3>

                        <div className="space-y-2">
                            <Label htmlFor="edit-name">Name</Label>
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

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                                                    setShowAddInstructor(true);
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
                                <Label>Room</Label>
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

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="edit-capacity">Capacity</Label>
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
                                    <p className="text-sm text-amber-600">
                                        Capacity is below current enrollment (
                                        {cls.enrolled})
                                    </p>
                                )}
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="edit-credit-hours">
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

                    <div className="space-y-4">
                        <h3 className="text-sm font-semibold text-foreground">
                            Description
                        </h3>
                        <div className="space-y-2">
                            <Textarea
                                id="edit-description"
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
                    </div>

                    <div className="space-y-4">
                        <h3 className="text-sm font-semibold text-foreground">
                            Class Period
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="edit-start-dt">
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
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="edit-end-dt">End Date</Label>
                                <Input
                                    id="edit-end-dt"
                                    type="date"
                                    {...register('end_dt')}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <h3 className="text-sm font-semibold text-foreground">
                            Status
                        </h3>
                        <StatusBadge status={cls.status} variant="class" />
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

                    <div className="flex justify-end gap-2 pt-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            className="border-gray-300"
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={isSubmitting}
                            className="bg-[#F1B51C] text-foreground hover:bg-[#F1B51C]/90"
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
        </>
    );
}
