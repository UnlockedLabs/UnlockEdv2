import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
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
import { bulkPatchEvents } from '@/api/bulkPatchEvents';
import { toast } from 'sonner';
import {
    bulkSessionFieldSchema,
    BulkSessionFieldInput
} from '@/lib/validation';

export interface BulkSessionFieldSession {
    date: string;
    dateLabel: string;
    eventId: number;
    classTime: string;
    dateObj?: Date;
    dayName?: string;
}

export interface FieldOption {
    id: number | string;
    label: string;
}

interface BulkSessionFieldModalProps {
    open: boolean;
    onClose: () => void;
    onChanged: () => void;
    classId: number;
    sessions: BulkSessionFieldSession[];
    futureSessions?: BulkSessionFieldSession[];
    applyToFuture?: boolean;
    setApplyToFuture?: (apply: boolean) => void;
    showSessionsList?: boolean;

    title: string;
    subject: string;
    idPrefix: string;
    options: FieldOption[];
    payloadKey: string;
    reasonOptions: { value: string; label: string }[];
}

export function BulkSessionFieldModal({
    open,
    onClose,
    onChanged,
    classId,
    sessions,
    futureSessions = [],
    applyToFuture,
    setApplyToFuture,
    showSessionsList = false,
    title,
    subject,
    idPrefix,
    options,
    payloadKey,
    reasonOptions
}: BulkSessionFieldModalProps) {
    const form = useForm<BulkSessionFieldInput>({
        resolver: zodResolver(bulkSessionFieldSchema),
        defaultValues: { selectedId: '', reason: '' }
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (open) {
            form.reset({ selectedId: '', reason: '' });
        }
    }, [open, form]);

    const subjectLower = subject.toLowerCase();
    const fieldId = `${idPrefix}-field`;
    const reasonId = `${idPrefix}-reason`;
    const applyFutureId = `${idPrefix}-apply-future`;

    const handleApply = async (formData: BulkSessionFieldInput) => {
        setIsSubmitting(true);

        const allSessions =
            applyToFuture && futureSessions.length > 0
                ? [...sessions, ...futureSessions]
                : sessions;

        const { ok, fail } = await bulkPatchEvents(
            classId,
            allSessions,
            (s) => ({
                date: s.date,
                start_time: s.classTime?.split('-')[0],
                is_cancelled: false,
                [payloadKey]: Number(formData.selectedId)
            })
        );

        const selectedLabel =
            options.find((o) => String(o.id) === formData.selectedId)?.label ??
            '';
        if (ok) {
            const msg =
                ok === 1
                    ? `${subject} changed to ${selectedLabel}`
                    : `${subject} changed to ${selectedLabel} for ${ok} sessions`;
            toast.success(msg);
        }
        if (fail) {
            toast.error(
                `Failed to update ${fail} session${fail === 1 ? '' : 's'}`
            );
        }
        onClose();
        onChanged();
        setIsSubmitting(false);
    };

    const useBulkLayout = showSessionsList || sessions.length > 1;

    return (
        <FormModal
            open={open}
            onOpenChange={(isOpen) => !isOpen && onClose()}
            title={title}
            description={
                useBulkLayout
                    ? `Select a new ${subjectLower} for ${sessions.length} ${sessions.length === 1 ? 'session' : 'sessions'}`
                    : `Change the ${subjectLower} for the class scheduled for ${sessions[0]?.dateLabel ?? ''}`
            }
            className={useBulkLayout ? 'max-w-2xl' : undefined}
            preventOutsideClose
        >
            <Form {...form}>
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        void form.handleSubmit((d) => void handleApply(d))(e);
                    }}
                >
                    <div className="space-y-4 py-4">
                        <FormField
                            control={form.control}
                            name="selectedId"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel htmlFor={fieldId}>
                                        New {subject}
                                    </FormLabel>
                                    <Select
                                        value={field.value}
                                        onValueChange={field.onChange}
                                    >
                                        <FormControl>
                                            <SelectTrigger id={fieldId}>
                                                <SelectValue
                                                    placeholder={`Select ${subjectLower}`}
                                                />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {options.map((opt) => (
                                                <SelectItem
                                                    key={opt.id}
                                                    value={String(opt.id)}
                                                >
                                                    {opt.label}
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
                                <FormItem>
                                    <FormLabel htmlFor={reasonId}>
                                        Reason for Change
                                    </FormLabel>
                                    <Select
                                        value={field.value}
                                        onValueChange={field.onChange}
                                    >
                                        <FormControl>
                                            <SelectTrigger id={reasonId}>
                                                <SelectValue placeholder="Select a reason" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {reasonOptions.map((r) => (
                                                <SelectItem
                                                    key={r.value}
                                                    value={r.value}
                                                >
                                                    {r.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {setApplyToFuture && (
                            <div className="flex items-center space-x-2">
                                <input
                                    type="checkbox"
                                    id={applyFutureId}
                                    checked={applyToFuture}
                                    onChange={(e) =>
                                        setApplyToFuture(e.target.checked)
                                    }
                                    className="size-4 rounded border-gray-300"
                                />
                                <Label
                                    htmlFor={applyFutureId}
                                    className="text-sm font-normal cursor-pointer"
                                >
                                    Apply this change to all future sessions
                                </Label>
                            </div>
                        )}

                        {applyToFuture && futureSessions.length > 0 && (
                            <SessionList
                                sessions={futureSessions}
                                showDayName
                            />
                        )}

                        {useBulkLayout && sessions.length > 0 && (
                            <SessionList sessions={sessions} />
                        )}
                    </div>
                    <div className="flex justify-end gap-3">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                                onClose();
                                form.reset({ selectedId: '', reason: '' });
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
                            {isSubmitting ? 'Updating...' : title}
                        </Button>
                    </div>
                </form>
            </Form>
        </FormModal>
    );
}

function SessionList({
    sessions,
    showDayName = false
}: {
    sessions: BulkSessionFieldSession[];
    showDayName?: boolean;
}) {
    const sorted = [...sessions].sort(
        (a, b) => (a.dateObj?.getTime() ?? 0) - (b.dateObj?.getTime() ?? 0)
    );
    return (
        <div>
            <Label className="form-label">Sessions to Update</Label>
            <div className="scroll-panel">
                {sorted.map((s) => (
                    <div key={s.date} className="text-sm text-gray-700">
                        {showDayName && s.dayName ? `${s.dayName}, ` : ''}
                        {s.dateObj?.toLocaleDateString('en-US', {
                            weekday: showDayName ? undefined : 'long',
                            month: 'long',
                            day: 'numeric',
                            year: 'numeric'
                        }) ?? s.dateLabel}
                    </div>
                ))}
            </div>
        </div>
    );
}
