import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { FacilityProgramClassEvent, CancelEventReason } from '@/types';
import { cancelEventSchema, CancelEventInput } from '@/lib/validation';
import { FormModal } from '@/components/shared/FormModal';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
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

interface CancelEventModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    event: FacilityProgramClassEvent;
    onSuccess: () => void;
    showApplyToFuture?: boolean;
}

export function CancelEventModal({
    open,
    onOpenChange,
    event,
    onSuccess,
    showApplyToFuture = true
}: CancelEventModalProps) {
    const form = useForm<CancelEventInput>({
        resolver: zodResolver(cancelEventSchema),
        defaultValues: {
            reason: '',
            customReason: '',
            applyToFuture: false
        }
    });
    const [submitting, setSubmitting] = useState(false);

    const reason = form.watch('reason');
    const customReason = form.watch('customReason');
    const applyToFuture = form.watch('applyToFuture');

    const isOther =
        reason === (CancelEventReason['Other (add note)'] as string);
    const finalReason = isOther ? (customReason ?? '').trim() : reason;

    const { submitSingleSessionChange, submitCancelSeriesChange } =
        useChangeEventField(event, { is_cancelled: true }, finalReason);

    useEffect(() => {
        if (open) {
            form.reset({
                reason: '',
                customReason: '',
                applyToFuture: false
            });
        }
    }, [open, form]);

    async function handleSubmit() {
        setSubmitting(true);

        const result = applyToFuture
            ? await submitCancelSeriesChange()
            : await submitSingleSessionChange();

        setSubmitting(false);

        if (result.success) {
            toast.success(
                applyToFuture
                    ? `Class on ${event.start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} and all future sessions cancelled`
                    : `Class on ${event.start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} cancelled`
            );
            onOpenChange(false);
            onSuccess();
        } else {
            toast.error(result.message ?? 'Failed to cancel class');
        }
    }

    return (
        <FormModal
            open={open}
            onOpenChange={onOpenChange}
            title="Cancel Class"
            description={`Cancel the class scheduled for ${event.start.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}`}
        >
            <Form {...form}>
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        void form.handleSubmit(() => void handleSubmit())(e);
                    }}
                >
                    <div className="space-y-4 pt-4">
                        <FormField
                            control={form.control}
                            name="reason"
                            render={({ field }) => (
                                <FormItem className="space-y-2">
                                    <FormLabel>
                                        Reason for Cancellation *
                                    </FormLabel>
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
                                                CancelEventReason
                                            ).map((r) => (
                                                <SelectItem key={r} value={r}>
                                                    {r}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {isOther && (
                            <FormField
                                control={form.control}
                                name="customReason"
                                render={({ field }) => (
                                    <FormItem className="space-y-2 min-w-0">
                                        <FormLabel>Details</FormLabel>
                                        <FormControl>
                                            <Textarea
                                                placeholder="Describe the reason..."
                                                rows={3}
                                                maxLength={255}
                                                className="break-all [field-sizing:fixed]"
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        )}

                        {showApplyToFuture && (
                            <FormField
                                control={form.control}
                                name="applyToFuture"
                                render={({ field }) => (
                                    <FormItem className="flex items-center gap-2 space-y-0">
                                        <FormControl>
                                            <input
                                                type="checkbox"
                                                id="apply-to-future"
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
                                            htmlFor="apply-to-future"
                                            className="text-sm font-normal cursor-pointer"
                                        >
                                            Apply this change to all future
                                            sessions
                                        </label>
                                    </FormItem>
                                )}
                            />
                        )}

                        <div className="flex justify-end gap-2 pt-4">
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
                                className="bg-red-600 text-white hover:bg-red-700"
                            >
                                {submitting ? 'Cancelling...' : 'Cancel Class'}
                            </Button>
                        </div>
                    </div>
                </form>
            </Form>
        </FormModal>
    );
}
