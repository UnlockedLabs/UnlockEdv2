import { useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage
} from '@/components/ui/form';
import { FormModal } from '@/components/shared';
import { editEnrollmentDateSchema } from '@/lib/validation';

interface EditEnrollmentDateModalProps {
    open: boolean;
    onClose: () => void;
    residentDisplayId: string;
    residentName: string;
    currentEnrolledAt: string;
    classStartDt: string;
    onSubmit: (newDateIso: string) => void;
}

const ISO = 'yyyy-MM-dd';

function toIsoDate(value: string): string {
    if (!value) return '';
    if (value.includes('T')) return value.split('T')[0];
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '';
    return format(parsed, ISO);
}

export function EditEnrollmentDateModal({
    open,
    onClose,
    residentDisplayId,
    residentName,
    currentEnrolledAt,
    classStartDt,
    onSubmit
}: EditEnrollmentDateModalProps) {
    const currentIso = useMemo(
        () => toIsoDate(currentEnrolledAt),
        [currentEnrolledAt]
    );
    const classStartIso = useMemo(
        () => toIsoDate(classStartDt),
        [classStartDt]
    );
    const today = useMemo(() => format(new Date(), ISO), []);

    // Range/changed rules depend on runtime dates, so layer them onto the base
    // schema (which only enforces "required") whenever those values change.
    const schema = useMemo(
        () =>
            editEnrollmentDateSchema
                .refine((v) => v.newDate <= today, {
                    message: 'Enrollment date cannot be in the future',
                    path: ['newDate']
                })
                .refine((v) => !classStartIso || v.newDate >= classStartIso, {
                    message: `Enrollment date cannot be before the class start date (${classStartIso})`,
                    path: ['newDate']
                })
                .refine((v) => v.newDate !== currentIso, {
                    message: 'Choose a different enrollment date',
                    path: ['newDate']
                }),
        [today, classStartIso, currentIso]
    );

    const form = useForm<{ newDate: string }>({
        resolver: zodResolver(schema),
        defaultValues: { newDate: currentIso }
    });

    useEffect(() => {
        if (open) form.reset({ newDate: currentIso });
    }, [open, currentIso, form]);

    const handleSubmit = (formData: { newDate: string }) => {
        onSubmit(`${formData.newDate}T00:00:00Z`);
        onClose();
    };

    return (
        <FormModal
            open={open}
            onOpenChange={(isOpen) => !isOpen && onClose()}
            title="Update Enrollment Date"
            description="Change the date this resident was enrolled in the class."
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
                        <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-600">
                                    Resident ID:
                                </span>
                                <span className="font-medium text-brand-dark">
                                    {residentDisplayId}
                                </span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-600">Name:</span>
                                <span className="font-medium text-brand-dark">
                                    {residentName}
                                </span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-600">
                                    Current Enrollment Date:
                                </span>
                                <span className="font-medium text-brand-dark">
                                    {currentIso || 'Not set'}
                                </span>
                            </div>
                        </div>
                        <FormField
                            control={form.control}
                            name="newDate"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel htmlFor="new-enrolled-date">
                                        New Enrollment Date *
                                    </FormLabel>
                                    <FormControl>
                                        <Input
                                            id="new-enrolled-date"
                                            type="date"
                                            min={classStartIso || undefined}
                                            max={today}
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <div className="flex gap-2 justify-end pt-4">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={onClose}
                            >
                                Cancel
                            </Button>
                            <Button type="submit" variant="brand">
                                Save
                            </Button>
                        </div>
                    </div>
                </form>
            </Form>
        </FormModal>
    );
}
