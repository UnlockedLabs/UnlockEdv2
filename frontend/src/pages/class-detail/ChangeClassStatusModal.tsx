import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
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
import { FormModal } from '@/components/shared';
import { SelectedClassStatus } from '@/types/attendance';
import API from '@/api/api';
import { toast } from 'sonner';
import {
    changeClassStatusSchema,
    ChangeClassStatusInput
} from '@/lib/validation';

interface ChangeClassStatusModalProps {
    open: boolean;
    onClose: () => void;
    classId: number;
    programId: number;
    className: string;
    currentStatus: SelectedClassStatus;
    capacity: number;
    onStatusChanged: () => void;
}

const ALL_STATUSES: SelectedClassStatus[] = [
    SelectedClassStatus.Active,
    SelectedClassStatus.Scheduled,
    SelectedClassStatus.Completed,
    SelectedClassStatus.Cancelled
];

function getStatusDescription(status: SelectedClassStatus): string {
    switch (status) {
        case SelectedClassStatus.Active:
            return 'Class is currently running and accepting attendance.';
        case SelectedClassStatus.Scheduled:
            return 'Class is scheduled to begin in the future.';
        case SelectedClassStatus.Completed:
            return 'Class has finished and is now archived.';
        case SelectedClassStatus.Cancelled:
            return 'Class has been cancelled and will not take place.';
        default:
            return '';
    }
}

export function ChangeClassStatusModal({
    open,
    onClose,
    classId,
    programId,
    className,
    currentStatus,
    capacity,
    onStatusChanged
}: ChangeClassStatusModalProps) {
    const form = useForm<ChangeClassStatusInput>({
        resolver: zodResolver(changeClassStatusSchema),
        defaultValues: { status: currentStatus }
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (open) {
            form.reset({ status: currentStatus });
        }
    }, [open, currentStatus, form]);

    const handleSubmit = async (formData: ChangeClassStatusInput) => {
        setIsSubmitting(true);
        const resp = await API.patch<
            unknown,
            { status: string; capacity: number }
        >(`programs/${programId}/classes/${classId}`, {
            status: formData.status,
            capacity
        });
        if (resp.success) {
            toast.success(`Class status updated to ${formData.status}`);
            onClose();
            onStatusChanged();
        } else {
            toast.error(resp.message || 'Failed to update status');
        }
        setIsSubmitting(false);
    };

    return (
        <FormModal
            open={open}
            onOpenChange={(isOpen) => !isOpen && onClose()}
            title="Change Class Status"
            description={`Update the status for ${className}`}
            className="max-w-md"
            titleClassName="text-foreground"
        >
            <Form {...form}>
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        void form.handleSubmit((d) => void handleSubmit(d))(e);
                    }}
                >
                    <div className="space-y-4">
                        <FormField
                            control={form.control}
                            name="status"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel htmlFor="classStatus">
                                        New Status
                                    </FormLabel>
                                    <Select
                                        value={field.value}
                                        onValueChange={field.onChange}
                                    >
                                        <FormControl>
                                            <SelectTrigger id="classStatus">
                                                <SelectValue />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {ALL_STATUSES.map((s) => (
                                                <SelectItem key={s} value={s}>
                                                    {s}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <p className="text-xs text-gray-500 mt-2">
                                        {getStatusDescription(
                                            field.value as SelectedClassStatus
                                        )}
                                    </p>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <div className="flex gap-2 justify-end pt-4">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={onClose}
                                disabled={isSubmitting}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                disabled={isSubmitting}
                                variant="brand"
                            >
                                {isSubmitting ? 'Updating...' : 'Update Status'}
                            </Button>
                        </div>
                    </div>
                </form>
            </Form>
        </FormModal>
    );
}
