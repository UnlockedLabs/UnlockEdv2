import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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
import { FormModal } from '@/components/shared';
import { EnrollmentStatus } from '@/types/attendance';
import { changeEnrollmentStatusSchema } from '@/lib/validation';

interface ChangeEnrollmentStatusModalProps {
    open: boolean;
    onClose: () => void;
    residentDisplayId: string;
    residentName: string;
    className: string;
    classStatus: string;
    currentStatus: EnrollmentStatus;
    allowedStatuses: EnrollmentStatus[];
    onStatusChange: (newStatus: EnrollmentStatus, reason: string) => void;
}

const STATUSES_IN_ORDER: EnrollmentStatus[] = [
    EnrollmentStatus.Enrolled,
    EnrollmentStatus.Completed,
    EnrollmentStatus.Withdrawn,
    EnrollmentStatus.Dropped,
    EnrollmentStatus.Segregated,
    EnrollmentStatus['Failed To Complete']
];

const statusNeedsReason = (status: string) =>
    status !== String(EnrollmentStatus.Enrolled) &&
    status !== String(EnrollmentStatus.Completed);

type FormValues = z.infer<typeof changeEnrollmentStatusSchema>;

export function ChangeEnrollmentStatusModal({
    open,
    onClose,
    residentDisplayId,
    residentName,
    className,
    classStatus,
    currentStatus,
    allowedStatuses,
    onStatusChange
}: ChangeEnrollmentStatusModalProps) {
    // The "reason is required" and "status must change" rules depend on the
    // current status, so the schema is rebuilt whenever it changes.
    const schema = useMemo(
        () =>
            changeEnrollmentStatusSchema
                .refine((v) => v.status !== String(currentStatus), {
                    message: 'Select a different status',
                    path: ['status']
                })
                .refine(
                    (v) =>
                        !statusNeedsReason(v.status) ||
                        (v.reason?.trim().length ?? 0) > 0,
                    {
                        message: 'Reason for incompletion is required',
                        path: ['reason']
                    }
                ),
        [currentStatus]
    );

    const form = useForm<FormValues>({
        resolver: zodResolver(schema),
        defaultValues: { status: currentStatus, reason: '' }
    });
    const newStatus = form.watch('status');
    const needsReason = statusNeedsReason(newStatus);

    useEffect(() => {
        if (open) {
            form.reset({ status: currentStatus, reason: '' });
        }
    }, [open, currentStatus, form]);

    const handleSubmit = (formData: FormValues) => {
        const reasonNeeded = statusNeedsReason(formData.status);
        onStatusChange(
            formData.status as EnrollmentStatus,
            reasonNeeded ? (formData.reason ?? '') : ''
        );
        onClose();
    };

    const displayStatuses = STATUSES_IN_ORDER.filter(
        (s) => s === currentStatus || allowedStatuses.includes(s)
    );

    if (classStatus === 'Scheduled') {
        return (
            <FormModal
                open={open}
                onOpenChange={(isOpen) => !isOpen && onClose()}
                title="Change Enrollment Status"
                description={`${className} currently has a status of "Scheduled". You may update enrollment status for ${residentDisplayId} - ${residentName} only once the class is "Active".`}
                className="max-w-md"
                titleClassName="text-foreground"
            >
                <div className="flex justify-end pt-2">
                    <Button variant="outline" onClick={onClose}>
                        Cancel
                    </Button>
                </div>
            </FormModal>
        );
    }

    return (
        <FormModal
            open={open}
            onOpenChange={(isOpen) => !isOpen && onClose()}
            title="Change Enrollment Status"
            description={`Update enrollment status for ${residentDisplayId} - ${residentName}`}
            className="max-w-md"
            titleClassName="text-foreground"
        >
            <Form {...form}>
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        void form.handleSubmit(handleSubmit)(e);
                    }}
                >
                    <div className="space-y-4">
                        <FormField
                            control={form.control}
                            name="status"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel htmlFor="status">
                                        New Status
                                    </FormLabel>
                                    <Select
                                        value={field.value}
                                        onValueChange={field.onChange}
                                    >
                                        <FormControl>
                                            <SelectTrigger id="status">
                                                <SelectValue />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {displayStatuses.map((status) => (
                                                <SelectItem
                                                    key={status}
                                                    value={status}
                                                >
                                                    {status}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        {needsReason && (
                            <FormField
                                control={form.control}
                                name="reason"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel htmlFor="reason">
                                            Reason for Incompletion *
                                        </FormLabel>
                                        <FormControl>
                                            <Textarea
                                                id="reason"
                                                placeholder="Explain why this resident did not complete the class..."
                                                rows={4}
                                                className="mt-1"
                                                {...field}
                                            />
                                        </FormControl>
                                        <p className="text-xs text-gray-500 mt-1">
                                            This information will be saved in
                                            the enrollment history
                                        </p>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        )}
                        <div className="flex gap-2 justify-end pt-4">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={onClose}
                            >
                                Cancel
                            </Button>
                            <Button type="submit" variant="brand">
                                Update Status
                            </Button>
                        </div>
                    </div>
                </form>
            </Form>
        </FormModal>
    );
}
