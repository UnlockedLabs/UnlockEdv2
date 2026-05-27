import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import API from '@/api/api';
import {
    Facility,
    NewUserResponse,
    ServerResponseOne,
    ToastState
} from '@/types';
import { useToast } from '@/contexts/useToast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DialogFooter } from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';
import { FormModal } from '@/components/shared';

interface AddResidentFormData {
    name_first: string;
    name_last: string;
    username: string;
    doc_id?: string;
    facility_id?: number;
}

interface AddResidentDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    facilities: Facility[];
    showFacilityColumn: boolean;
    defaultFacilityId?: number;
    onSuccess: () => void;
}

export function AddResidentDialog({
    open,
    onOpenChange,
    facilities,
    showFacilityColumn,
    defaultFacilityId,
    onSuccess
}: AddResidentDialogProps) {
    const { toaster } = useToast();
    const form = useForm<AddResidentFormData>();
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (open) {
            form.reset();
            if (defaultFacilityId !== undefined) {
                form.setValue('facility_id', defaultFacilityId);
            }
        }
    }, [open, defaultFacilityId, form]);

    const handleAddUser = async (formData: AddResidentFormData) => {
        if (submitting) return;
        setSubmitting(true);
        try {
            const user = {
                name_first: formData.name_first,
                name_last: formData.name_last,
                username: formData.username,
                doc_id: formData.doc_id,
                role: 'student' as const,
                ...(formData.facility_id
                    ? { facility_id: formData.facility_id }
                    : {})
            };
            const response = (await API.post<NewUserResponse, object>('users', {
                user
            })) as ServerResponseOne<NewUserResponse>;

            if (response.success) {
                onOpenChange(false);
                toaster(
                    `Resident ${formData.name_first} ${formData.name_last} added successfully`,
                    ToastState.success
                );
                form.reset();
                onSuccess();
            } else {
                toaster(
                    response.message || 'Failed to create resident',
                    ToastState.error
                );
            }
        } finally {
            setSubmitting(false);
        }
    };

    const isFormValid =
        form.watch('name_first') &&
        form.watch('name_last') &&
        form.watch('username');

    return (
        <FormModal
            open={open}
            onOpenChange={onOpenChange}
            title="Add New Resident"
            description="Create a new resident profile in the system"
            titleClassName="text-foreground"
        >
            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    void form.handleSubmit((d) => void handleAddUser(d))(e);
                }}
            >
                <div className="space-y-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label htmlFor="add-first">First Name</Label>
                            <Input
                                id="add-first"
                                placeholder="First name"
                                {...form.register('name_first', {
                                    required: true
                                })}
                                className="mt-2"
                            />
                        </div>
                        <div>
                            <Label htmlFor="add-last">Last Name</Label>
                            <Input
                                id="add-last"
                                placeholder="Last name"
                                {...form.register('name_last', {
                                    required: true
                                })}
                                className="mt-2"
                            />
                        </div>
                    </div>
                    <div>
                        <Label htmlFor="add-username">Username</Label>
                        <Input
                            id="add-username"
                            placeholder="Enter username for login"
                            {...form.register('username', { required: true })}
                            className="mt-2"
                        />
                    </div>
                    <div>
                        <Label htmlFor="add-doc-id">Resident ID</Label>
                        <Input
                            id="add-doc-id"
                            placeholder="e.g., R001"
                            {...form.register('doc_id')}
                            className="mt-2"
                        />
                    </div>
                    {showFacilityColumn && (
                        <div>
                            <Label htmlFor="add-facility">Facility</Label>
                            <Select
                                value={
                                    form.watch('facility_id')
                                        ? String(form.watch('facility_id'))
                                        : undefined
                                }
                                onValueChange={(v) =>
                                    form.setValue('facility_id', Number(v))
                                }
                            >
                                <SelectTrigger className="mt-2">
                                    <SelectValue placeholder="Select facility" />
                                </SelectTrigger>
                                <SelectContent>
                                    {facilities.map((f) => (
                                        <SelectItem
                                            key={f.id}
                                            value={String(f.id)}
                                        >
                                            {f.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}
                </div>
                <DialogFooter className="pt-4">
                    <Button
                        variant="outline"
                        type="button"
                        onClick={() => onOpenChange(false)}
                    >
                        Cancel
                    </Button>
                    <Button
                        type="submit"
                        disabled={!isFormValid || submitting}
                        variant="brand"
                    >
                        {submitting ? 'Adding...' : 'Add Resident'}
                    </Button>
                </DialogFooter>
            </form>
        </FormModal>
    );
}
