import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import {
    FacilityProgramClassEvent,
    Room,
    RoomConflict,
    ChangeReason
} from '@/types';
import { changeRoomSchema, ChangeRoomInput } from '@/lib/validation';
import { FormModal } from '@/components/shared/FormModal';
import { RoomConflictModal } from './RoomConflictModal';
import { Button } from '@/components/ui/button';
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
import { useChangeEventField } from './useChangeEventField';

interface ChangeRoomModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    event: FacilityProgramClassEvent;
    rooms: Room[];
    onSuccess: () => void;
}

export function ChangeRoomModal({
    open,
    onOpenChange,
    event,
    rooms,
    onSuccess
}: ChangeRoomModalProps) {
    const form = useForm<ChangeRoomInput>({
        resolver: zodResolver(changeRoomSchema),
        defaultValues: {
            room_id: '',
            reason: '',
            applyToFuture: false
        }
    });
    const [submitting, setSubmitting] = useState(false);
    const [conflicts, setConflicts] = useState<RoomConflict[]>([]);
    const [showConflicts, setShowConflicts] = useState(false);

    const roomId = form.watch('room_id');
    const reason = form.watch('reason');
    const applyToFuture = form.watch('applyToFuture');

    const { submitSingleSessionChange, submitSeriesChange } =
        useChangeEventField(
            event,
            { room_id: roomId ? Number(roomId) : null },
            reason ?? ''
        );

    useEffect(() => {
        if (open && event) {
            form.reset({
                room_id: '',
                reason: '',
                applyToFuture: false
            });
        }
    }, [open, event, form]);

    const selectedRoomName =
        rooms.find((r) => String(r.id) === roomId)?.name ?? roomId;

    async function handleSubmit() {
        setSubmitting(true);

        const result = applyToFuture
            ? await submitSeriesChange()
            : await submitSingleSessionChange();

        setSubmitting(false);

        if (result.status === 409 && Array.isArray(result.data)) {
            setConflicts(result.data as RoomConflict[]);
            setShowConflicts(true);
            return;
        }

        if (result.success) {
            toast.success(
                applyToFuture
                    ? `Room changed to ${selectedRoomName} for all future sessions`
                    : `Room changed to ${selectedRoomName}`
            );
            onOpenChange(false);
            onSuccess();
        } else {
            toast.error(result.message ?? 'Failed to update room');
        }
    }

    return (
        <>
            <FormModal
                open={open}
                onOpenChange={onOpenChange}
                title="Change Room"
            >
                <Form {...form}>
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            void form.handleSubmit(() => void handleSubmit())(
                                e
                            );
                        }}
                    >
                        <div className="space-y-4 pt-6">
                            <FormField
                                control={form.control}
                                name="room_id"
                                render={({ field }) => (
                                    <FormItem className="space-y-2">
                                        <FormLabel>New Room</FormLabel>
                                        <Select
                                            value={field.value}
                                            onValueChange={field.onChange}
                                        >
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select room" />
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
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="reason"
                                render={({ field }) => (
                                    <FormItem className="space-y-2">
                                        <FormLabel>Reason for Change</FormLabel>
                                        <Select
                                            value={field.value}
                                            onValueChange={field.onChange}
                                        >
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select a reason" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {Object.values(
                                                    ChangeReason
                                                ).map((r) => (
                                                    <SelectItem
                                                        key={r}
                                                        value={r}
                                                    >
                                                        {r}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="applyToFuture"
                                render={({ field }) => (
                                    <FormItem className="flex items-center gap-2 space-y-0">
                                        <FormControl>
                                            <input
                                                type="checkbox"
                                                id="room-apply-to-future"
                                                checked={field.value}
                                                onChange={(e) =>
                                                    field.onChange(
                                                        e.target.checked
                                                    )
                                                }
                                                className="size-4 rounded border-gray-300"
                                            />
                                        </FormControl>
                                        <label
                                            htmlFor="room-apply-to-future"
                                            className="text-sm font-normal cursor-pointer"
                                        >
                                            Apply this change to all future
                                            sessions
                                        </label>
                                    </FormItem>
                                )}
                            />

                            <div className="flex justify-end gap-3 pt-4">
                                <Button
                                    variant="outline"
                                    type="button"
                                    onClick={() => onOpenChange(false)}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="submit"
                                    disabled={submitting}
                                    className="bg-brand text-white hover:bg-brand-dark"
                                >
                                    {submitting ? 'Saving...' : 'Change Room'}
                                </Button>
                            </div>
                        </div>
                    </form>
                </Form>
            </FormModal>

            <RoomConflictModal
                open={showConflicts}
                onOpenChange={setShowConflicts}
                conflicts={conflicts}
            />
        </>
    );
}
