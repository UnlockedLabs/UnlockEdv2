import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import useSWR from 'swr';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage
} from '@/components/ui/form';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';
import { FormModal } from '@/components/shared';
import API from '@/api/api';
import { bulkPatchEvents } from '@/api/bulkPatchEvents';
import { toast } from 'sonner';
import { Room, ServerResponseMany } from '@/types';
import { formatTime12h } from '@/lib/formatters';
import {
    rescheduleSessionSchema,
    RescheduleSessionInput
} from '@/lib/validation';

export interface RescheduleFutureSession {
    date: string;
    eventId: number;
}

interface RescheduleSessionModalProps {
    open: boolean;
    onClose: () => void;
    classId: number;
    classFacilityId?: number;
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
    classFacilityId,
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
    const [startTime, endTime] =
        classTime?.split('-').map((s) => s.trim()) ?? [];
    const form = useForm<RescheduleSessionInput>({
        resolver: zodResolver(rescheduleSessionSchema),
        defaultValues: {
            newDate: '',
            newStartTime: '',
            newEndTime: '',
            newRoom: ''
        }
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    const { data: roomsResp } = useSWR<ServerResponseMany<Room>>(
        open
            ? classFacilityId
                ? `/api/rooms?facility_id=${classFacilityId}`
                : '/api/rooms'
            : null
    );
    const rooms = roomsResp?.data ?? [];

    useEffect(() => {
        if (open) {
            form.reset({
                newDate: '',
                newStartTime: '',
                newEndTime: '',
                newRoom: ''
            });
        }
    }, [open, form]);

    const handleReschedule = async (formData: RescheduleSessionInput) => {
        const { newDate, newStartTime, newEndTime, newRoom } = formData;
        setIsSubmitting(true);
        const body: Record<string, unknown> = {
            date: originalDate,
            start_time: startTime,
            new_date: newDate && newDate.length > 0 ? newDate : originalDate
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
            const hasTimeOrRoom = [newStartTime, newEndTime, newRoom].some(
                (val) => (val ?? '').length > 0
            );
            if (hasTimeOrRoom) {
                const { ok, fail } = await bulkPatchEvents(
                    classId,
                    futureSessions,
                    (s) => {
                        const futureBody: Record<string, unknown> = {
                            date: s.date,
                            new_date: s.date,
                            reason: 'applied_future'
                        };
                        if (newStartTime)
                            futureBody.new_start_time = newStartTime;
                        if (newEndTime) futureBody.new_end_time = newEndTime;
                        if (newRoom) futureBody.room_id = Number(newRoom);
                        return futureBody;
                    }
                );
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
        <FormModal
            open={open}
            onOpenChange={(isOpen) => !isOpen && onClose()}
            title="Reschedule Class"
            description={`Reschedule the class from ${dateLabel}. You can change the date, time, and room.`}
        >
            <Form {...form}>
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        void form.handleSubmit((d) => void handleReschedule(d))(
                            e
                        );
                    }}
                >
                    <div className="space-y-4 py-4">
                        <FormField
                            control={form.control}
                            name="newDate"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel htmlFor="rescheduleDate">
                                        New Date
                                    </FormLabel>
                                    <FormControl>
                                        <Input
                                            id="rescheduleDate"
                                            type="date"
                                            min={today}
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="newStartTime"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel htmlFor="rescheduleStartTime">
                                        New Start Time (optional)
                                    </FormLabel>
                                    <FormControl>
                                        <Input
                                            id="rescheduleStartTime"
                                            type="time"
                                            placeholder={
                                                startTime
                                                    ? formatTime12h(startTime)
                                                    : undefined
                                            }
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="newEndTime"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel htmlFor="rescheduleEndTime">
                                        New End Time (optional)
                                    </FormLabel>
                                    <FormControl>
                                        <Input
                                            id="rescheduleEndTime"
                                            type="time"
                                            placeholder={
                                                endTime
                                                    ? formatTime12h(endTime)
                                                    : undefined
                                            }
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="newRoom"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel htmlFor="rescheduleRoom">
                                        New Room (optional)
                                    </FormLabel>
                                    <Select
                                        value={field.value}
                                        onValueChange={field.onChange}
                                    >
                                        <FormControl>
                                            <SelectTrigger id="rescheduleRoom">
                                                <SelectValue
                                                    placeholder={
                                                        currentRoom
                                                            ? `Keep current room (${currentRoom})`
                                                            : 'Select room'
                                                    }
                                                />
                                            </SelectTrigger>
                                        </FormControl>
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
                                        Leave time and room blank to keep
                                        current values.
                                    </p>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
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
                            type="button"
                            variant="outline"
                            onClick={() => {
                                onClose();
                                form.reset({
                                    newDate: '',
                                    newStartTime: '',
                                    newEndTime: '',
                                    newRoom: ''
                                });
                                if (setApplyToFuture) setApplyToFuture(false);
                            }}
                            disabled={isSubmitting}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={isSubmitting}
                            variant="brand"
                        >
                            {isSubmitting
                                ? 'Rescheduling...'
                                : 'Reschedule Class'}
                        </Button>
                    </div>
                </form>
            </Form>
        </FormModal>
    );
}
