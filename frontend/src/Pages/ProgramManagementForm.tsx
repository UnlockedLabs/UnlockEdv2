import { useNavigate, useParams } from 'react-router-dom';
import {
    CreditType,
    Facility,
    ProgramType,
    ToastState,
    FundingType,
    Program,
    ServerResponseOne,
    ProgramCreditType,
    PgmType,
    ProgramOverview
} from '@/common';
import { SubmitHandler, useForm } from 'react-hook-form';
import {
    TextInput,
    TextAreaInput,
    CancelButton,
    SubmitButton
} from '@/Components/inputs';
import API from '@/api/api';
import { canSwitchFacility, useAuth } from '@/useAuth';
import { useLoaderData } from 'react-router-dom';
import { useToast } from '@/Context/ToastCtx';
import ULIComponent from '@/Components/ULIComponent';
import { InformationCircleIcon } from '@heroicons/react/24/outline';
import {
    GenericOption,
    MultiSelectInput
} from '@/Components/inputs/MultiSelectInput';
import { useEffect, useRef } from 'react';
import {
    TextOnlyModal,
    TextModalType,
    closeModal,
    showModal
} from '@/Components/modals';

interface ProgramInputs {
    name: string;
    description: string;
    credit_type: GenericOption<CreditType>[];
    program_type: GenericOption<ProgramType>[];
    is_active: boolean;
    funding_type: GenericOption<FundingType> | null;
    facilities: GenericOption<string>[];
}

interface TransformedProgramInput {
    name: string;
    description: string;
    credit_types: ProgramCreditType[];
    program_types: PgmType[];
    is_active: boolean;
    funding_type: FundingType;
    facilities: number[];
}

export default function ProgramManagementForm() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { program_id } = useParams<{ program_id?: string }>();
    const { toaster } = useToast();
    const activeClassesExistModal = useRef<HTMLDialogElement>(null);
    const selectAllOption: GenericOption<string> = {
        value: 'all',
        label: 'Select All'
    };
    const { facilities, program, redirect } = useLoaderData() as {
        facilities: Facility[];
        program: ProgramOverview;
        redirect: string;
    };

    if (redirect) {
        navigate(redirect);
    }

    const {
        register,
        control,
        handleSubmit,
        reset,
        formState: { errors }
    } = useForm<ProgramInputs>({});
    const facilityOptions = facilities.map((fac) => ({
        value: fac.id.toString(),
        label: fac.name
    }));
    const facilityOptionsSelectAll = [selectAllOption, ...facilityOptions];
    const onSubmit: SubmitHandler<ProgramInputs> = async (
        data: ProgramInputs
    ) => {
        const transformedData: TransformedProgramInput = {
            ...data,
            ...(program_id && { id: Number(program_id) }),
            is_active:
                String(data.is_active) === 'true' || data.is_active === true,
            credit_types: data.credit_type.map((opt) => ({
                ...(program_id && { id: Number(program_id) }),
                credit_type: opt.value
            })),
            program_types: data.program_type.map((opt) => ({
                ...(program_id && { id: Number(program_id) }),
                program_type: opt.value
            })),
            funding_type: data.funding_type
                ? data.funding_type.value
                : FundingType.OTHER,
            ...(data.facilities && {
                facilities: data.facilities.map((fac) => Number(fac.value))
            })
        };

        const response = program_id
            ? ((await API.patch(
                  `programs/${program_id}`,
                  transformedData
              )) as ServerResponseOne<Program>)
            : ((await API.post<Program, TransformedProgramInput>(
                  'programs',
                  transformedData
              )) as ServerResponseOne<Program>);
        if (!response.success) {
            const toasterMsg = program_id
                ? 'Failed to update program'
                : 'Failed to add program';
            toaster(toasterMsg, ToastState.error);
            return;
        }

        const program = response?.data;
        const toasterMsg = program_id
            ? 'Program updated successfully'
            : 'Program created successfully';
        toaster(toasterMsg, ToastState.success);
        navigate(`/programs/${program.id}`);
    };

    useEffect(() => {
        if (program) {
            setEditFormValues();
        }
    }, [program_id]);

    function setEditFormValues() {
        const formValues: ProgramInputs = {
            name: program.name,
            description: program.description,
            credit_type: program.credit_types.map((ct) => ({
                label: String(ct.credit_type).replace(/_/g, ' '),
                value: ct.credit_type // or ct.type or ct.id, depending on shape
            })),
            program_type: program.program_types.map((pt) => ({
                label: String(pt.program_type).replace(/_/g, ' '),
                value: pt.program_type // or pt.type or pt.id
            })),
            is_active: program.is_active,
            funding_type: program.funding_type
                ? {
                      label: String(program.funding_type).replace(/_/g, ' '),
                      value: program.funding_type
                  }
                : null,
            facilities: program.facilities.map((facility) => ({
                label: facility.name,
                value: facility.id.toString()
            }))
        };
        reset({
            ...formValues,
            is_active: program.is_active.toString() as unknown as boolean
        });
    }

    function handleClassChange(
        selected: GenericOption<string | number>[],
        options: GenericOption<GenericOption<string>>[]
    ) {
        const activeClassIDs = program
            ? program.active_class_facility_ids.map(String)
            : [];
        const selectedIDs = selected.map((selectedOpt) =>
            String(selectedOpt.value)
        );
        const currentIDs = options.map((option) => String(option.value));
        const removedIDs = currentIDs.filter((id) => !selectedIDs.includes(id));
        const disabledIDs = removedIDs.filter((id) =>
            activeClassIDs.includes(id)
        );
        if (disabledIDs.length > 0) {
            showModal(activeClassesExistModal); //clicked a facility that has active classes
            const preservedSet = new Set([
                ...selected.map((selectedOpt) => String(selectedOpt.value)),
                ...disabledIDs
            ]);

            return options.filter((option) =>
                preservedSet.has(String(option.value))
            );
        }

        if (selected.find((opt) => opt.value === 'all')) {
            return options.filter((opt) => String(opt.value) !== 'all');
        }
        return selected;
    }

    return (
        <div className="container mx-auto p-4 py-8 space-y-6 remove-input-txt-border">
            {/* program info */}
            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    void handleSubmit(onSubmit)(e);
                }}
            >
                <div className="card p-6 rounded-lg shadow-md space-y-6 ">
                    <h2 className="text-xl font-semibold">
                        Program Information
                    </h2>

                    <div>
                        <TextInput
                            label="Name"
                            register={register}
                            interfaceRef="name"
                            required
                            length={255}
                            errors={errors}
                        />
                    </div>

                    <div>
                        <TextAreaInput
                            label="Description"
                            register={register}
                            interfaceRef="description"
                            required
                            length={255}
                            errors={errors}
                        />
                    </div>
                    <MultiSelectInput
                        placeholder="Select Credit Types"
                        name="credit_type"
                        label="Credit Type"
                        control={control}
                        optionList={Object.values(CreditType)}
                        isMulti
                        required
                        errors={errors}
                    />
                    <MultiSelectInput
                        placeholder="Select Program Types"
                        name="program_type"
                        label="Program Type"
                        control={control}
                        optionList={Object.values(ProgramType)}
                        isMulti
                        required
                        errors={errors}
                    />
                    <MultiSelectInput
                        placeholder="Select Funding Type"
                        name="funding_type"
                        label="Funding Type"
                        control={control}
                        optionList={Object.values(FundingType)}
                        required
                        errors={errors}
                    />
                </div>

                <div className="card p-6 rounded-lg shadow-md space-y-6">
                    <h2 className="text-xl font-semibold">Availability</h2>

                    {user && canSwitchFacility(user) && (
                        <div>
                            <MultiSelectInput
                                name="facilities"
                                label="Facility selection:"
                                placeholder="Select Facilities"
                                control={control}
                                required
                                optionList={facilityOptionsSelectAll}
                                preformattedOptions
                                isMulti
                                onChangeOverride={handleClassChange}
                                errors={errors}
                            />
                        </div>
                    )}
                    <div>
                        <label className="flex items-start gap-1 font-medium mb-2 relative">
                            <span>Program Status</span>
                            <ULIComponent
                                icon={InformationCircleIcon}
                                dataTip={
                                    'Available programs appear in the admin view of selected facilities and can be scheduled. Inactive programs remain hidden until activated.'
                                }
                                iconClassName="tooltip absolute  mt-[2px] ml-[2px]"
                            />
                        </label>
                        <div className="flex space-x-6">
                            <label className="flex items-center cursor-pointer">
                                <input
                                    type="radio"
                                    value="true"
                                    {...register('is_active', {
                                        required: 'Program Status is required'
                                    })}
                                    className="radio radio-primary my-auto mr-2"
                                />
                                <span>Available</span>
                            </label>
                            <label className="flex items-center cursor-pointer">
                                <input
                                    type="radio"
                                    value="false"
                                    {...register('is_active', {
                                        required: 'Program Status is required'
                                    })}
                                    className="radio radio-primary my-auto mr-2"
                                />
                                <span>Inactive</span>
                            </label>
                        </div>
                        {errors.is_active && (
                            <p className="text-error text-sm">
                                {errors.is_active.message}
                            </p>
                        )}
                    </div>
                </div>
                {program ? (
                    <div className="flex justify-end mt-4">
                        <p className="body-small text-teal-3">
                            This change will not impact historical data.
                        </p>
                    </div>
                ) : (
                    ''
                )}
                <div className="flex items-center justify-end gap-4 mt-2">
                    <CancelButton onClick={() => navigate(`/programs`)} />
                    <SubmitButton label="Submit" />
                </div>
            </form>
            <TextOnlyModal
                ref={activeClassesExistModal}
                type={TextModalType.Information}
                title={'Cannot Remove Facility'}
                text={
                    <div>
                        <div className="text-error">
                            <p className="text-error">
                                You can't remove this facility because it still
                                has active or scheduled classes in this program.
                                Cancel or complete all classes before trying
                                again.
                            </p>
                        </div>
                        <div className="mt-4 text-center">
                            <CancelButton
                                label="Close"
                                onClick={() =>
                                    closeModal(activeClassesExistModal)
                                }
                            />
                        </div>
                    </div>
                }
                onSubmit={() => {}} //eslint-disable-line
                onClose={() => {
                    closeModal(activeClassesExistModal);
                }}
            ></TextOnlyModal>
        </div>
    );
}
