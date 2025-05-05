import { useNavigate } from 'react-router-dom';
import {
    CreditType,
    Facility,
    ProgramType,
    ToastState,
    FundingType,
    Program,
    ServerResponseOne,
    ProgramCreditType,
    PgmType
} from '@/common';
import { SubmitHandler, useForm } from 'react-hook-form';
import { TextInput, TextAreaInput, SubmitButton } from '@/Components/inputs';
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

export default function CreateProgramPage() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { toaster } = useToast();
    const selectAllOption: GenericOption<string> = {
        value: 'all',
        label: 'Select All'
    };
    const { facilities } = useLoaderData() as {
        facilities: Facility[];
    };

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
            is_active: new Boolean(data.is_active).valueOf(),
            credit_types: data.credit_type.map((opt) => ({
                credit_type: opt.value
            })),
            program_types: data.program_type.map((opt) => ({
                program_type: opt.value
            })),
            funding_type: data.funding_type
                ? data.funding_type.value
                : FundingType.OTHER,
            facilities: data.facilities.map((fac) => Number(fac.value))
        };

        const response = (await API.post<Program, TransformedProgramInput>(
            'programs',
            transformedData
        )) as ServerResponseOne<Program>;
        if (!response.success) {
            toaster('Failed to add program', ToastState.error);
            return;
        }
        const program = response?.data;
        toaster('Program created successfully', ToastState.success);
        navigate(`/programs/${program.id}`);
        reset();
    };
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
                                onChangeOverride={(selected, options) => {
                                    if (
                                        Array.isArray(selected) &&
                                        selected.find(
                                            (opt) => opt.value === 'all' // eslint-disable-line
                                        )
                                    ) {
                                        return options.filter(
                                            (opt) => String(opt.value) !== 'all'
                                        );
                                    }
                                    return selected; // eslint-disable-line
                                }}
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
                                    'Active programs appear in the admin view of selected facilities and can be scheduled. Inactive programs remain hidden until activated.'
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
                                    value=""
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
                <div className="flex items-center justify-end gap-4 mt-4">
                    <button
                        type="submit"
                        className="button-grey"
                        onClick={() =>
                            reset({
                                name: '',
                                description: '',
                                credit_type: [],
                                program_type: [],
                                is_active: undefined,
                                funding_type: null,
                                facilities: []
                            })
                        }
                    >
                        Cancel
                    </button>
                    <SubmitButton label="Create Program" />
                </div>
            </form>
        </div>
    );
}
