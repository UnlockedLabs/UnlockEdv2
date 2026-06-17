import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import useSWR from 'swr';
import { toast } from 'sonner';
import API from '@/api/api';
import { useAuth, canSwitchFacility } from '@/auth/useAuth';
import {
    ProgramOverview,
    PgmType,
    ProgramCreditType,
    ServerResponseOne,
    Program,
    Facility,
    FundingType
} from '@/types';
import { programFormSchema, ProgramFormInput } from '@/lib/validation';
import {
    ANALYTICS_EVENTS,
    captureEvent,
    flowTimerSeconds
} from '@/lib/analytics';
import { useFlowTimer } from '@/lib/useFlowTimer';
import { PageHeader } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
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
import { ConfirmDialog } from '@/components/shared';
import {
    ALL_PROGRAM_TYPES,
    ALL_CREDIT_TYPES,
    ALL_FUNDING_TYPES
} from '@/pages/program-detail/constants';

function buildDefaultValues(program?: ProgramOverview): ProgramFormInput {
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
    const startMsRef = useFlowTimer(
        isEditing ? null : ANALYTICS_EVENTS.ProgramCreationStarted
    );

    const { data: programResp } = useSWR<ServerResponseOne<ProgramOverview>>(
        program_id ? `/api/programs/${program_id}` : null
    );
    const program = programResp?.data;

    const form = useForm<ProgramFormInput>({
        resolver: zodResolver(programFormSchema),
        defaultValues: buildDefaultValues()
    });
    const {
        control,
        handleSubmit,
        reset,
        formState: { isSubmitting }
    } = form;

    useEffect(() => {
        if (program) {
            reset(buildDefaultValues(program));
        }
    }, [program, reset]);

    const facilities: Facility[] = user?.facilities ?? [];

    async function onSubmit(data: ProgramFormInput) {
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
                isEditing
                    ? 'Failed to update program'
                    : 'Failed to create program'
            );
            return;
        }

        toast.success(
            isEditing
                ? 'Program updated successfully'
                : 'Program created successfully'
        );
        if (!isEditing) {
            captureEvent(ANALYTICS_EVENTS.ProgramCreationCompleted, {
                duration_seconds: flowTimerSeconds(startMsRef.current)
            });
        }
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

            <Form {...form}>
                <form
                    onSubmit={(event) => {
                        void handleSubmit(onSubmit)(event);
                    }}
                    className="space-y-6"
                >
                    <div className="section-card">
                        <h2 className="text-lg font-semibold text-foreground">
                            Program Information
                        </h2>

                        <FormField
                            control={control}
                            name="name"
                            render={({ field }) => (
                                <FormItem className="space-y-2">
                                    <FormLabel>Name</FormLabel>
                                    <FormControl>
                                        <Input {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={control}
                            name="description"
                            render={({ field }) => (
                                <FormItem className="space-y-2">
                                    <FormLabel>Description</FormLabel>
                                    <FormControl>
                                        <Textarea rows={3} {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="grid grid-cols-2 gap-6">
                            <FormField
                                control={control}
                                name="program_types"
                                render={({ field }) => (
                                    <FormItem className="space-y-2">
                                        <FormLabel>Program Types</FormLabel>
                                        <div className="space-y-2 mt-1">
                                            {ALL_PROGRAM_TYPES.map((type) => (
                                                <label
                                                    key={type}
                                                    className="flex items-center gap-2 cursor-pointer"
                                                >
                                                    <Checkbox
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
                                                    <span className="text-sm text-foreground">
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
                                    <FormItem className="space-y-2">
                                        <FormLabel>Credit Types</FormLabel>
                                        <div className="space-y-2 mt-1">
                                            {ALL_CREDIT_TYPES.map((type) => (
                                                <label
                                                    key={type}
                                                    className="flex items-center gap-2 cursor-pointer"
                                                >
                                                    <Checkbox
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
                                                    <span className="text-sm text-foreground">
                                                        {type}
                                                    </span>
                                                </label>
                                            ))}
                                        </div>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <FormField
                            control={control}
                            name="funding_type"
                            render={({ field }) => (
                                <FormItem className="space-y-2">
                                    <FormLabel>Funding Type</FormLabel>
                                    <Select
                                        value={field.value}
                                        onValueChange={field.onChange}
                                    >
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select funding type" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {ALL_FUNDING_TYPES.map((ft) => (
                                                <SelectItem key={ft} value={ft}>
                                                    {ft.replace(/_/g, ' ')}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>

                    <div className="section-card">
                        <h2 className="text-lg font-semibold text-foreground">
                            Availability
                        </h2>

                        {user &&
                            canSwitchFacility(user) &&
                            facilities.length > 0 && (
                                <FormField
                                    control={control}
                                    name="facility_ids"
                                    render={({ field }) => (
                                        <FormItem className="space-y-2">
                                            <FormLabel>Facilities</FormLabel>
                                            <div className="space-y-2 mt-1">
                                                {facilities.map((fac) => (
                                                    <label
                                                        key={fac.id}
                                                        className="flex items-center gap-2 cursor-pointer"
                                                    >
                                                        <Checkbox
                                                            checked={field.value?.includes(
                                                                fac.id
                                                            )}
                                                            onCheckedChange={(
                                                                checked
                                                            ) => {
                                                                if (
                                                                    !checked &&
                                                                    program
                                                                ) {
                                                                    const activeClassIds =
                                                                        program.active_class_facility_ids ??
                                                                        [];
                                                                    if (
                                                                        activeClassIds.includes(
                                                                            fac.id
                                                                        )
                                                                    ) {
                                                                        setShowFacilityWarning(
                                                                            true
                                                                        );
                                                                        return;
                                                                    }
                                                                }
                                                                field.onChange(
                                                                    checked ===
                                                                        true
                                                                        ? [
                                                                              ...field.value,
                                                                              fac.id
                                                                          ]
                                                                        : field.value.filter(
                                                                              (
                                                                                  id
                                                                              ) =>
                                                                                  id !==
                                                                                  fac.id
                                                                          )
                                                                );
                                                            }}
                                                        />
                                                        <span className="text-sm text-foreground">
                                                            {fac.name}
                                                        </span>
                                                    </label>
                                                ))}
                                            </div>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            )}

                        <FormField
                            control={control}
                            name="is_active"
                            render={({ field }) => (
                                <FormItem className="space-y-2">
                                    <Label>Program Status</Label>
                                    <Select
                                        value={
                                            field.value ? 'active' : 'inactive'
                                        }
                                        onValueChange={(v) =>
                                            field.onChange(v === 'active')
                                        }
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="active">
                                                Available
                                            </SelectItem>
                                            <SelectItem value="inactive">
                                                Inactive
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <p className="text-xs text-muted-foreground">
                                        Set to &apos;Available&apos; to let
                                        facility admins schedule classes.
                                        &apos;Inactive&apos; programs stay
                                        hidden.
                                    </p>
                                </FormItem>
                            )}
                        />
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
                            className="btn-gold-thin"
                        >
                            {isSubmitting
                                ? 'Saving...'
                                : isEditing
                                  ? 'Save Changes'
                                  : 'Create Program'}
                        </Button>
                    </div>
                </form>
            </Form>

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
