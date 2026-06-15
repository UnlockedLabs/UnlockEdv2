import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle, Trash2 } from 'lucide-react';
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
import { FormModal, TonedPanel } from '@/components/shared';
import API from '@/api/api';
import { toast } from 'sonner';
import { typeToConfirmSchema, TypeToConfirmInput } from '@/lib/validation';

interface DeleteClassModalProps {
    open: boolean;
    onClose: () => void;
    classId: number;
    className: string;
    onDeleted: () => void;
}

export function DeleteClassModal({
    open,
    onClose,
    classId,
    className,
    onDeleted
}: DeleteClassModalProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const schema = useMemo(() => typeToConfirmSchema(className), [className]);
    const form = useForm<TypeToConfirmInput>({
        resolver: zodResolver(schema),
        defaultValues: { confirmation: '' }
    });

    useEffect(() => {
        if (open) form.reset({ confirmation: '' });
    }, [open, form]);

    const handleDelete = async () => {
        setIsSubmitting(true);
        const resp = await API.delete(`program-classes/${classId}`);
        if (resp.success) {
            onClose();
            onDeleted();
            toast.success(`Class "${className}" has been deleted`);
        } else {
            toast.error(resp.message || 'Failed to delete class');
        }
        setIsSubmitting(false);
    };

    return (
        <FormModal
            open={open}
            onOpenChange={(isOpen) => !isOpen && onClose()}
            title="Delete Class"
            description={
                <>
                    Are you sure you want to delete <strong>{className}</strong>
                    ? This action cannot be undone.
                </>
            }
            preventOutsideClose
        >
            <TonedPanel tone="red" className="my-4">
                <div className="flex gap-3">
                    <AlertCircle className="size-5 text-red-600 shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm text-red-900 font-medium mb-1">
                            Warning
                        </p>
                        <p className="text-sm text-red-700">
                            This will permanently delete the class and all
                            associated session data from the system. This
                            operation is irreversible.
                        </p>
                    </div>
                </div>
            </TonedPanel>
            <Form {...form}>
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        void form.handleSubmit(() => void handleDelete())(e);
                    }}
                >
                    <div className="space-y-4">
                        <FormField
                            control={form.control}
                            name="confirmation"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel htmlFor="deleteClassConfirmation">
                                        To confirm, type the class name:{' '}
                                        <strong>{className}</strong>
                                    </FormLabel>
                                    <FormControl>
                                        <Input
                                            id="deleteClassConfirmation"
                                            placeholder="Type class name to confirm"
                                            className="mt-2"
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>
                    <div className="flex justify-end gap-3 mt-6">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={onClose}
                            className="border-gray-300"
                            disabled={isSubmitting}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            variant="destructive"
                            disabled={isSubmitting}
                        >
                            <Trash2 className="size-4 mr-2" />
                            {isSubmitting ? 'Deleting...' : 'Delete Class'}
                        </Button>
                    </div>
                </form>
            </Form>
        </FormModal>
    );
}
