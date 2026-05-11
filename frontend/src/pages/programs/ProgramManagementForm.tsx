import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import useSWR from 'swr';
import { toast } from 'sonner';
import API from '@/api/api';
import { useAuth, canSwitchFacility } from '@/auth/useAuth';
import {
    ProgramOverview,
    ProgramType,
    CreditType,
    FundingType,
    PgmType,
    ProgramCreditType,
    ServerResponseOne,
    Program,
    Facility
} from '@/types';
import { PageHeader } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';
import { ConfirmDialog } from '@/components/shared';
import {
    ALL_PROGRAM_TYPES,
    ALL_CREDIT_TYPES,
    ALL_FUNDING_TYPES
} from '@/pages/program-detail/constants';

interface ProgramFormData {
    name: string;
    description: string;
    program_types: ProgramType[];
    credit_types: CreditType[];
    funding_type: FundingType;
    is_active: boolean;
    facility_ids: number[];
}

function buildDefaultValues(program?: ProgramOverview): ProgramFormData {
    if (program) {
        return {
            name: program.name,
            description: program.description,
            program_types: program.program_types.map((pt) => pt.program_type),
            credit_types: program.credit_types.map((ct) => ct.credit_type),
            funding_type: program.funding_type,
            is_active: program.is_active,
            facility_ids: program.facilities.map((f) => f.id)
        };
    }
    return {
        name: '',
        description: '',
        program_types: [],
        credit_types: [],
        funding_type: FundingType.OTHER,
        is_active: true,
        facility_ids: []
    };
}

export default function ProgramManagementForm() {
    const navigate = useNavigate();
    const { program_id } = useParams<{ program_id?: string }>();
    const { user } = useAuth();
    const isEditing = !!program_id;
    const [showFacilityWarning, setShowFacilityWarning] = useState(false);

    const { data: programResp } = useSWR<ServerResponseOne<ProgramOverview>>(
        program_id ? `/api/programs/${program_id}` : null
    );
    const program = programResp?.data;

    const {
        register,
        handleSubmit,
        control,
        reset,
        watch,
        setValue,
        formState: { errors, isSubmitting }
    } = useForm<ProgramFormData>({
        defaultValues: buildDefaultValues()
    });

    useEffect(() => {
        if (program) {
            reset(buildDefaultValues(program));
        }
    }, [program, reset]);

    const selectedProgramTypes = watch('program_types');
    const selectedCreditTypes = watch('credit_types');
    const selectedFacilities = watch('facility_ids');
    const facilities: Facility[] = user?.facilities ?? [];

    function handleCheckboxToggle<T>(
        field: 'program_types' | 'credit_types',
        value: T,
        checked: boolean
    ) {
        const current = (field === 'program_types' ? selectedProgramTypes : selectedCreditTypes) as T[];
        const updated = checked
            ? [...current, value]
            : current.filter((item) => item !== value);
        setValue(field, updated as ProgramType[] & CreditType[]);
    }

    function handleFacilityToggle(facilityId: number, checked: boolean) {
        if (!checked && program) {
            const activeClassIds = program.active_class_facility_ids ?? [];
            if (activeClassIds.includes(facilityId)) {
                setShowFacilityWarning(true);
                return;
            }
        }
        const updated = checked
            ? [...selectedFacilities, facilityId]
            : selectedFacilities.filter((id) => id !== facilityId);
        setValue('facility_ids', updated);
    }

    async function onSubmit(data: ProgramFormData) {
        if (data.program_types.length === 0) {
            toast.error('Please select at least one program type');
            return;
        }
        if (data.credit_types.length === 0) {
            toast.error('Please select at least one credit type');
            return;
        }

        const payload = {
            ...(program_id && { id: Number(program_id) }),
            name: data.name,
            description: data.description,
            program_types: data.program_types.map(
                (pt): PgmType => ({
                    program_type: pt,
                    ...(program_id && { program_id: Number(program_id) })
                })
            ),
            credit_types: data.credit_types.map(
                (ct): ProgramCreditType => ({
                    credit_type: ct,
                    ...(program_id && { program_id: Number(program_id) })
                })
            ),
            funding_type: data.funding_type,
            is_active: data.is_active,
            facilities: data.facility_ids
        };

        const resp = isEditing
            ? ((await API.patch(
                  `programs/${program_id}`,
                  payload
              )) as ServerResponseOne<Program>)
            : ((await API.post<Program, typeof payload>(
                  'programs',
                  payload
              )) as ServerResponseOne<Program>);

        if (!resp.success) {
            toast.error(
                isEditing ? 'Failed to update program' : 'Failed to create program'
            );
            return;
        }

        toast.success(
            isEditing ? 'Program updated successfully' : 'Program created successfully'
        );
        navigate(`/programs/${resp.data.id}`);
    }

    return (
        <div className="space-y-6">
            <PageHeader
                title={isEditing ? 'Edit Program' : 'Create Program'}
                subtitle={
                    isEditing
                        ? 'Update program details and settings'
                        : 'Set up a new program for your facility'
                }
            />

            <form
                onSubmit={(event) => {
                    void handleSubmit(onSubmit)(event);
                }}
                className="space-y-6"
            >
                <div className="bg-card rounded-lg border border-border p-6 space-y-4">
                    <h2 className="text-lg font-semibold text-foreground">
                        Program Information
                    </h2>

                    <div className="space-y-2">
                        <Label htmlFor="name">Name</Label>
                        <Input
                            id="name"
                            {...register('name', {
                                required: 'Program name is required',
                                maxLength: { value: 255, message: 'Name must be 255 characters or fewer' }
                            })}
                        />
                        {errors.name && (
                            <p className="text-sm text-red-600">{errors.name.message}</p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="description">Description</Label>
                        <Textarea
                            id="description"
                            rows={3}
                            {...register('description', {
                                required: 'Description is required',
                                maxLength: { value: 255, message: 'Description must be 255 characters or fewer' }
                            })}
                        />
                        {errors.description && (
                            <p className="text-sm text-red-600">{errors.description.message}</p>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <Label>Program Types</Label>
                            <div className="space-y-2 mt-1">
                                {ALL_PROGRAM_TYPES.map((type) => (
                                    <label key={type} className="flex items-center gap-2 cursor-pointer">
                                        <Checkbox
                                            checked={selectedProgramTypes?.includes(type)}
                                            onCheckedChange={(checked) =>
                                                handleCheckboxToggle('program_types', type, checked === true)
                                            }
                                        />
                                        <span className="text-sm text-foreground">
                                            {type.replace(/_/g, ' ')}
                                        </span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Credit Types</Label>
                            <div className="space-y-2 mt-1">
                                {ALL_CREDIT_TYPES.map((type) => (
                                    <label key={type} className="flex items-center gap-2 cursor-pointer">
                                        <Checkbox
                                            checked={selectedCreditTypes?.includes(type)}
                                            onCheckedChange={(checked) =>
                                                handleCheckboxToggle('credit_types', type, checked === true)
                                            }
                                        />
                                        <span className="text-sm text-foreground">{type}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Funding Type</Label>
                        <Controller
                            name="funding_type"
                            control={control}
                            rules={{ required: 'Funding type is required' }}
                            render={({ field }) => (
                                <Select value={field.value} onValueChange={field.onChange}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select funding type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {ALL_FUNDING_TYPES.map((ft) => (
                                            <SelectItem key={ft} value={ft}>
                                                {ft.replace(/_/g, ' ')}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                        />
                    </div>
                </div>

                <div className="bg-card rounded-lg border border-border p-6 space-y-4">
                    <h2 className="text-lg font-semibold text-foreground">Availability</h2>

                    {user && canSwitchFacility(user) && facilities.length > 0 && (
                        <div className="space-y-2">
                            <Label>Facilities</Label>
                            <div className="space-y-2 mt-1">
                                {facilities.map((fac) => (
                                    <label key={fac.id} className="flex items-center gap-2 cursor-pointer">
                                        <Checkbox
                                            checked={selectedFacilities?.includes(fac.id)}
                                            onCheckedChange={(checked) =>
                                                handleFacilityToggle(fac.id, checked === true)
                                            }
                                        />
                                        <span className="text-sm text-foreground">{fac.name}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label>Program Status</Label>
                        <Controller
                            name="is_active"
                            control={control}
                            render={({ field }) => (
                                <Select
                                    value={field.value ? 'active' : 'inactive'}
                                    onValueChange={(v) => field.onChange(v === 'active')}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="active">Available</SelectItem>
                                        <SelectItem value="inactive">Inactive</SelectItem>
                                    </SelectContent>
                                </Select>
                            )}
                        />
                        <p className="text-xs text-muted-foreground">
                            Set to &apos;Available&apos; to let facility admins schedule classes.
                            &apos;Inactive&apos; programs stay hidden.
                        </p>
                    </div>
                </div>

                {isEditing && (
                    <p className="text-sm text-muted-foreground text-right">
                        This change will not impact historical data.
                    </p>
                )}

                <div className="flex items-center justify-end gap-3">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => navigate('/programs')}
                        className="border-gray-300"
                    >
                        Cancel
                    </Button>
                    <Button
                        type="submit"
                        disabled={isSubmitting}
                        className="bg-[#F1B51C] text-foreground hover:bg-[#F1B51C]/90"
                    >
                        {isSubmitting
                            ? 'Saving...'
                            : isEditing
                              ? 'Save Changes'
                              : 'Create Program'}
                    </Button>
                </div>
            </form>

            <ConfirmDialog
                open={showFacilityWarning}
                onOpenChange={setShowFacilityWarning}
                title="Cannot Remove Facility"
                description="This facility cannot be removed because it still has active or scheduled classes in this program. Please cancel or complete all classes before trying again."
                confirmLabel="Close"
                onConfirm={() => setShowFacilityWarning(false)}
            />
        </div>
    );
}
