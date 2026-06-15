import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import API from '@/api/api';
import { DialogFooter } from '@/components/ui/dialog';
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
import { FormModal } from '@/components/shared';
import { residentNoteSchema, ResidentNoteInput } from '@/lib/validation';

interface AddNoteDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    residentId: string;
    residentName: string;
    onSuccess: () => void;
}

export function AddNoteDialog({
    open,
    onOpenChange,
    residentId,
    residentName,
    onSuccess
}: AddNoteDialogProps) {
    const form = useForm<ResidentNoteInput>({
        resolver: zodResolver(residentNoteSchema),
        defaultValues: { note: '' }
    });
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (!open) form.reset({ note: '' });
    }, [open, form]);

    const handleSubmit = async (data: ResidentNoteInput) => {
        setSubmitting(true);
        const resp = await API.post(`users/${residentId}/notes`, {
            note: data.note.trim()
        });
        setSubmitting(false);
        if (resp.success) {
            toast.success('Historical note added');
            form.reset({ note: '' });
            onSuccess();
            onOpenChange(false);
        } else {
            toast.error(resp.message);
        }
    };

    return (
        <FormModal
            open={open}
            onOpenChange={onOpenChange}
            title="Add Historical Note"
            description={`Add context or supportive information to ${residentName}'s profile`}
            titleClassName="text-foreground"
        >
            <Form {...form}>
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        void form.handleSubmit((d) => void handleSubmit(d))(e);
                    }}
                >
                    <div className="space-y-4 py-4">
                        <FormField
                            control={form.control}
                            name="note"
                            render={({ field }) => (
                                <FormItem className="space-y-2">
                                    <FormLabel>Note</FormLabel>
                                    <FormControl>
                                        <Textarea
                                            placeholder="Add contextual information, support plans, or important updates..."
                                            rows={4}
                                            className="[overflow-wrap:anywhere] [field-sizing:normal]"
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>
                    <DialogFooter>
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
                            variant="brand"
                        >
                            Add Note
                        </Button>
                    </DialogFooter>
                </form>
            </Form>
        </FormModal>
    );
}
