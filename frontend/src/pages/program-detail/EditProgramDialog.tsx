import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import useSWR, { mutate } from 'swr';
import { toast } from 'sonner';
import API from '@/api/api';
import {
    Facility,
    ProgramOverview,
    PgmType,
    ProgramCreditType,
    ServerResponseMany
} from '@/types';
import { canSwitchFacility, useAuth } from '@/auth/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
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
import { editProgramSchema, EditProgramInput } from '@/lib/validation';
import {
    ALL_PROGRAM_TYPES,
    ALL_CREDIT_TYPES,
    ALL_FUNDING_TYPES
} from './constants';

interface EditProgramDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    program: ProgramOverview;
}

function buildInitialFormData(program: ProgramOverview): EditProgramInput {
    const status = program.archived_at
        ? 'Archived'
        : program.is_active
          ? 'Available'
          : 'Inactive';
    return {
        name: program.name,
        description: program.description,
        program_types: program.program_types.map((pt) => pt.program_type),
        credit_types: program.credit_types.map((ct) => ct.credit_type),
        funding_type: program.funding_type,
        status,
        facilities: program.facilities?.map((facility) => facility.id) ?? []
    };
}

export default function EditProgramDialog({
    open,
    onOpenChange,
    program
}: EditProgramDialogProps) {
    const { user } = useAuth();
    const isDeptAdminUser = user ? canSwitchFacility(user) : false;
    const { data: facilitiesResp } = useSWR<ServerResponseMany<Facility>>(
        isDeptAdminUser ? '/api/facilities?per_page=200' : null
    );
    const facilities = facilitiesResp?.data ?? [];

    const form = useForm<EditProgramInput>({
        resolver: zodResolver(editProgramSchema),
        defaultValues: buildInitialFormData(program)
    });
    const {
        control,
        handleSubmit,
        reset,
        formState: { isSubmitting }
    } = form;

    useEffect(() => {
        if (!open) return;
        reset(buildInitialFormData(program));
    }, [open, program, reset]);

    async function handleSave(formData: EditProgramInput) {
        const currentStatus = program.archived_at
            ? 'Archived'
            : program.is_active
              ? 'Available'
              : 'Inactive';
        const payload = {
            name: formData.name,
            description: formData.description,
            program_types: formData.program_types.map(
                (pt): PgmType => ({ program_type: pt })
            ),
            credit_types: formData.credit_types.map(
                (ct): ProgramCreditType => ({ credit_type: ct })
            ),
            funding_type: formData.funding_type,
            is_active: formData.status === 'Available'
        };
        if (isDeptAdminUser) {
            Object.assign(payload, { facilities: formData.facilities });
        }
        const resp = await API.patch('programs/' + program.id, payload);
        if (resp.success) {
            if (
                formData.status === 'Archived' &&
                currentStatus !== 'Archived'
            ) {
                const archiveResp = await API.patch<
                    {
                        updated?: boolean;
                        message?: string;
                    },
                    Record<string, unknown>
                >(`programs/${program.id}/status`, {
                    archived_at: new Date().toISOString(),
                    is_active: false
                });
                const archiveUpdated =
                    !Array.isArray(archiveResp.data) &&
                    archiveResp.data?.updated !== false;
                if (!archiveResp.success || !archiveUpdated) {
                    toast.error(
                        archiveResp.message || 'Unable to archive program'
                    );
                    return;
                }
            } else if (
                currentStatus === 'Archived' &&
                formData.status !== 'Archived'
            ) {
                const unarchiveResp = await API.patch<
                    {
                        updated?: boolean;
                        message?: string;
                    },
                    Record<string, unknown>
                >(`programs/${program.id}/status`, {
                    archived_at: null,
                    is_active: formData.status === 'Available'
                });
                const unarchiveUpdated =
                    !Array.isArray(unarchiveResp.data) &&
                    unarchiveResp.data?.updated !== false;
                if (!unarchiveResp.success || !unarchiveUpdated) {
                    toast.error(
                        unarchiveResp.message ||
                            'Unable to update program status'
                    );
                    return;
                }
            }
            toast.success('Program updated successfully');
            await mutate('/api/programs/' + program.id);
            onOpenChange(false);
        } else {
            toast.error(resp.message || 'Failed to update program');
        }
    }

    return (
        <FormModal
            open={open}
            onOpenChange={onOpenChange}
            title="Edit Program"
            description="Make changes to the program details and categorization."
            className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto"
            titleClassName="text-foreground"
        >
            <Form {...form}>
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        void handleSubmit(handleSave)(e);
                    }}
                    className="space-y-6"
                >
                    <div>
                        <h4 className="text-sm text-gray-700 mb-3">
                            Basic Information
                        </h4>
                        <div className="space-y-4">
                            <FormField
                                control={control}
                                name="name"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel htmlFor="programName">
                                            Program Name *
                                        </FormLabel>
                                        <FormControl>
                                            <Input
                                                id="programName"
                                                placeholder="Program name"
                                                className="focus-visible:border-[#b3b3b3] focus-visible:ring-[#b3b3b3]/50"
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={control}
                                name="description"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel htmlFor="programDescription">
                                            Description
                                        </FormLabel>
                                        <FormControl>
                                            <Textarea
                                                id="programDescription"
                                                placeholder="Brief description of the program"
                                                rows={2}
                                                className="focus-visible:border-[#b3b3b3] focus-visible:ring-[#b3b3b3]/50"
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                    </div>

                    <div className="pt-4 border-t border-gray-200">
                        <h4 className="text-sm text-gray-700 mb-3">
                            Categorization
                        </h4>
                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={control}
                                name="program_types"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>
                                            Category (Program Types) *
                                        </FormLabel>
                                        <div className="mt-2 space-y-2">
                                            {ALL_PROGRAM_TYPES.map((type) => (
                                                <label
                                                    key={type}
                                                    className="flex items-center gap-2 cursor-pointer"
                                                >
                                                    <Checkbox
                                                        size="sm"
                                                        className="rounded border-gray-400 bg-white data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600 data-[state=checked]:text-white focus-visible:border-[#b3b3b3] focus-visible:ring-[#b3b3b3]/50"
                                                        checked={field.value?.includes(
                                                            type
                                                        )}
                                                        onCheckedChange={(
                                                            checked
                                                        ) =>
                                                            field.onChange(
                                                                checked === true
                                                                    ? [
                                                                          ...field.value,
                                                                          type
                                                                      ]
                                                                    : field.value.filter(
                                                                          (v) =>
                                                                              v !==
                                                                              type
                                                                      )
                                                            )
                                                        }
                                                    />
                                                    <span className="text-sm text-gray-700">
                                                        {type.replace(
                                                            /_/g,
                                                            ' '
                                                        )}
                                                    </span>
                                                </label>
                                            ))}
                                        </div>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={control}
                                name="credit_types"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Credit Types *</FormLabel>
                                        <div className="mt-2 space-y-2">
                                            {ALL_CREDIT_TYPES.map((type) => (
                                                <label
                                                    key={type}
                                                    className="flex items-center gap-2 cursor-pointer"
                                                >
                                                    <Checkbox
                                                        size="sm"
                                                        className="rounded border-gray-400 bg-white data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600 data-[state=checked]:text-white focus-visible:border-[#b3b3b3] focus-visible:ring-[#b3b3b3]/50"
                                                        checked={field.value?.includes(
                                                            type
                                                        )}
                                                        onCheckedChange={(
                                                            checked
                                                        ) =>
                                                            field.onChange(
                                                                checked === true
                                                                    ? [
                                                                          ...field.value,
                                                                          type
                                                                      ]
                                                                    : field.value.filter(
                                                                          (v) =>
                                                                              v !==
                                                                              type
                                                                      )
                                                            )
                                                        }
                                                    />
                                                    <span className="text-sm text-gray-700">
                                                        {type}
                                                    </span>
                                                </label>
                                            ))}
                                        </div>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={control}
                                name="funding_type"
                                render={({ field }) => (
                                    <FormItem className="col-span-2">
                                        <FormLabel>Funding Types *</FormLabel>
                                        <Select
                                            value={field.value}
                                            onValueChange={field.onChange}
                                        >
                                            <FormControl>
                                                <SelectTrigger className="mt-2 focus-visible:border-[#b3b3b3] focus-visible:ring-[#b3b3b3]/50">
                                                    <SelectValue placeholder="Select funding type" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {ALL_FUNDING_TYPES.map((ft) => (
                                                    <SelectItem
                                                        key={ft}
                                                        value={ft}
                                                    >
                                                        {ft.replace(/_/g, ' ')}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={control}
                                name="status"
                                render={({ field }) => (
                                    <FormItem className="col-span-2">
                                        <FormLabel>
                                            Program Availability *
                                        </FormLabel>
                                        <Select
                                            value={field.value}
                                            onValueChange={field.onChange}
                                        >
                                            <FormControl>
                                                <SelectTrigger className="mt-0 focus-visible:border-[#b3b3b3] focus-visible:ring-[#b3b3b3]/50">
                                                    <SelectValue placeholder="Select program status" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="Available">
                                                    Available
                                                </SelectItem>
                                                <SelectItem value="Inactive">
                                                    Inactive
                                                </SelectItem>
                                                <SelectItem value="Archived">
                                                    Archived
                                                </SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <p className="text-xs text-gray-500 mt-1">
                                            Available programs can accept new
                                            class enrollments. Inactive programs
                                            are temporarily paused. Archived
                                            programs are no longer offered.
                                        </p>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            {isDeptAdminUser && (
                                <FormField
                                    control={control}
                                    name="facilities"
                                    render={({ field }) => (
                                        <FormItem className="col-span-2">
                                            <FormLabel htmlFor="facilities">
                                                Facilities Offered *
                                            </FormLabel>
                                            <div className="mt-2 max-h-60 overflow-y-auto space-y-2">
                                                {facilities.map((facility) => (
                                                    <label
                                                        key={facility.id}
                                                        className="flex items-center gap-2 cursor-pointer"
                                                    >
                                                        <Checkbox
                                                            checked={field.value?.includes(
                                                                facility.id
                                                            )}
                                                            onCheckedChange={(
                                                                checked
                                                            ) =>
                                                                field.onChange(
                                                                    checked ===
                                                                        true
                                                                        ? [
                                                                              ...field.value,
                                                                              facility.id
                                                                          ]
                                                                        : field.value.filter(
                                                                              (
                                                                                  id
                                                                              ) =>
                                                                                  id !==
                                                                                  facility.id
                                                                          )
                                                                )
                                                            }
                                                        />
                                                        <span className="text-sm text-gray-700">
                                                            {facility.name}
                                                        </span>
                                                    </label>
                                                ))}
                                            </div>
                                            <p className="text-xs text-gray-500 mt-1">
                                                Select which facilities will
                                                offer this program. You can add
                                                more facilities later.
                                            </p>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            )}
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            className="border-gray-300 focus-visible:border-[#b3b3b3] focus-visible:ring-[3px] focus-visible:ring-[#b3b3b3]/50 focus-visible:ring-offset-0"
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            variant="brand"
                            className="focus-visible:border-[#b3b3b3] focus-visible:ring-[3px] focus-visible:ring-[#b3b3b3]/50 focus-visible:ring-offset-0"
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? 'Saving...' : 'Save Changes'}
                        </Button>
                    </div>
                </form>
            </Form>
        </FormModal>
    );
}
