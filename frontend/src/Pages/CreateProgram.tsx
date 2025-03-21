import { useNavigate } from 'react-router-dom';
import {
    CreditType,
    Facility,
    ProgramStatus,
    ProgramType,
    ToastState,
    FundingType
} from '@/common';
import { SubmitHandler, useForm, Controller } from 'react-hook-form';
import { TextInput, TextAreaInput } from '@/Components/inputs';
import API from '@/api/api';
import Select, {
    StylesConfig,
    CSSObjectWithLabel,
    GroupBase
} from 'react-select';
import { canSwitchFacility, useAuth } from '@/useAuth';
import { useLoaderData } from 'react-router-dom';
import { useToast } from '@/Context/ToastCtx';

interface ProgramInputs {
    name: string;
    description: string;
    credit_type: GenericOption<CreditType>[];
    program_type: GenericOption<ProgramType>[];
    program_status: ProgramStatus;
    funding_type: GenericOption<FundingType>;
    facilities: GenericOption<number>[];
}

interface TransformedProgramInput {
    name: string;
    description: string;
    credit_type: CreditType[];
    program_type: ProgramType[];
    program_status: ProgramStatus;
    funding_type: FundingType;
    facilities: number[];
}

interface ProgramResponse {
    message: string;
    program_id: number;
}
function formatLabel(value: string) {
    return value.replace(/_/g, ' ');
}

const customSelectStyles: StylesConfig<
    GenericOption<unknown>,
    boolean,
    GroupBase<GenericOption<unknown>>
> = {
    control: (provided, state) => ({
        ...provided,
        backgroundColor: 'var(--base-100)',
        color: 'var(--body-text)',
        border: '1px solid var(--grey-1)',
        borderRadius: '0.375rem',
        minHeight: '42px',
        boxShadow: state.isFocused
            ? '0 0 0 2px var(--grey-1)' // subtle focus ring
            : 'none',
        transition: 'all 0.2s ease-in-out',
        '&:hover': {
            borderColor: 'var(--grey-3)'
        }
    }),
    input: (provided: CSSObjectWithLabel) => ({
        ...provided,
        color: 'var(--body-text)',
        outline: 'none',
        backgroundColor: 'var(--base-100)',
        boxShadow: 'var(--base-100)'
    }),
    singleValue: (provided: CSSObjectWithLabel) => ({
        ...provided,
        color: 'var(--body-text)'
    }),
    multiValue: (provided: CSSObjectWithLabel) => ({
        ...provided,
        backgroundColor: 'var(--grey-1)'
    }),
    valueContainer: (provided) => ({
        ...provided,
        backgroundColor: 'var(--base-100)'
    }),
    multiValueLabel: (provided: CSSObjectWithLabel) => ({
        ...provided,
        color: 'var(--body-text)'
    }),
    multiValueRemove: (provided: CSSObjectWithLabel) => ({
        ...provided,
        color: 'var(--body-text)',
        ':hover': {
            backgroundColor: 'var(--grey-2)',
            color: 'black'
        }
    }),
    menu: (provided) => ({
        ...provided,
        backgroundColor: 'var(--base-100)',
        border: '1px solid var(--grey-1)',
        boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)'
    }),
    menuList: (provided) => ({
        ...provided,
        backgroundColor: 'var(--inner-background) !important'
    }),
    option: (provided, state) => ({
        ...provided,
        backgroundColor: state.isSelected
            ? 'var(--grey-3)'
            : state.isFocused
              ? 'var(--grey-1)'
              : 'var(--base-100) !important',
        color: 'var(--body-text)',
        cursor: 'pointer'
    }),
    placeholder: (provided: CSSObjectWithLabel) => ({
        ...provided,
        color: 'var(--grey-3)'
    })
};
export interface GenericOption<T> {
    value: T;
    label: string;
}

export function createOptions<T>(
    items: T[],
    formatter: (item: T) => string = String
): GenericOption<T>[] {
    return items.map((item) => ({
        value: item,
        label: formatter(item)
    }));
}
export default function CreateProgramPage() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { toaster } = useToast();

    const { facilities } = useLoaderData() as {
        facilities: Facility[];
    };

    const {
        register,
        control,
        handleSubmit,
        reset,
        formState: { errors }
    } = useForm<ProgramInputs>();
    const creditTypeOptions = createOptions(
        Object.values(CreditType),
        formatLabel
    );
    const programTypeOptions = createOptions(
        Object.values(ProgramType),
        formatLabel
    );
    const fundingTypeOptions = createOptions(
        Object.values(FundingType),
        formatLabel
    );
    const facilityOptions = facilities.map((fac) => ({
        value: fac.id,
        label: fac.name
    }));

    const onSubmit: SubmitHandler<ProgramInputs> = async (data) => {
        const transformedData: TransformedProgramInput = {
            ...data,
            credit_type: data.credit_type.map((opt) => opt.value),
            program_status: data.program_status,
            program_type: data.program_type.map((opt) => opt.value),
            funding_type: data.funding_type.value,
            facilities: data.facilities.map((fac) => fac.value)
        };

        const response = await API.post<
            ProgramResponse,
            TransformedProgramInput
        >('programs', transformedData);
        if (!response.success) {
            toaster('Failed to add program', ToastState.error);
            return;
        }
        const { program_id, message } = response?.data as ProgramResponse;
        toaster(message || 'Program created successfully', ToastState.success);
        navigate(`/programs/${program_id}`);
        reset();
    };
    return (
        <div className="container mx-auto p-4 py-8 space-y-6 remove-input-txt-border">
            {/* program info */}
            <div className="card p-6 rounded-lg shadow-md space-y-6 ">
                <h2 className="text-xl font-semibold">Program Information</h2>

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

                <div>
                    <label className="block font-medium mb-1">
                        Credit Type
                    </label>
                    <Controller
                        control={control}
                        name="credit_type"
                        rules={{ required: 'Credit Type is required' }}
                        render={({ field }) => (
                            <Select<GenericOption<CreditType>, true>
                                {...field}
                                isMulti
                                options={creditTypeOptions}
                                placeholder="Select Credit Types"
                                styles={
                                    customSelectStyles as StylesConfig<
                                        GenericOption<CreditType>,
                                        true,
                                        GroupBase<GenericOption<CreditType>>
                                    >
                                }
                            />
                        )}
                    />
                    {errors.credit_type && (
                        <p className="text-error text-sm">
                            {errors.credit_type.message}
                        </p>
                    )}
                </div>

                <div>
                    <label className="block font-medium mb-1">
                        Program Type
                    </label>
                    <Controller
                        control={control}
                        name="program_type"
                        rules={{ required: 'Program Type is required' }}
                        render={({ field }) => (
                            <Select<GenericOption<ProgramType>, true>
                                {...field}
                                isMulti
                                options={programTypeOptions}
                                placeholder="Select Program Types"
                                styles={
                                    customSelectStyles as StylesConfig<
                                        GenericOption<ProgramType>,
                                        true,
                                        GroupBase<GenericOption<ProgramType>>
                                    >
                                }
                            />
                        )}
                    />
                    {errors.program_type && (
                        <p className="text-error text-sm">
                            {errors.program_type.message}
                        </p>
                    )}
                </div>

                <div>
                    <label className="block font-medium mb-1">
                        Funding Type
                    </label>
                    <Controller
                        control={control}
                        name="funding_type"
                        rules={{ required: 'Funding Type is required' }}
                        render={({ field }) => (
                            <Select<GenericOption<FundingType>, true>
                                {...field}
                                options={fundingTypeOptions}
                                placeholder="Select Funding Type"
                                styles={
                                    customSelectStyles as StylesConfig<
                                        GenericOption<FundingType>,
                                        true,
                                        GroupBase<GenericOption<FundingType>>
                                    >
                                }
                            />
                        )}
                    />
                    {errors.funding_type && (
                        <p className="text-error text-sm">
                            {errors.funding_type.message}
                        </p>
                    )}
                </div>
            </div>

            <div className="card p-6 rounded-lg shadow-md space-y-6">
                <h2 className="text-xl font-semibold">Availability</h2>
                <div>
                    <label className="block font-medium mb-1">
                        Program Status
                    </label>
                    <div className="flex space-x-6">
                        <label className="flex items-center cursor-pointer">
                            <input
                                type="radio"
                                value="available"
                                {...register('program_status', {
                                    required: 'Program Status is required'
                                })}
                                className="radio radio-primary my-auto mr-2"
                            />
                            <span>Available</span>
                        </label>
                        <label className="flex items-center cursor-pointer">
                            <input
                                type="radio"
                                value="inactive"
                                {...register('program_status', {
                                    required: 'Program Status is required'
                                })}
                                className="radio radio-primary my-auto mr-2"
                            />
                            <span>Inactive</span>
                        </label>
                    </div>
                    {errors.program_status && (
                        <p className="text-error text-sm">
                            {errors.program_status.message}
                        </p>
                    )}
                </div>

                {user && canSwitchFacility(user) && (
                    <div>
                        <label className="block font-medium mb-1">
                            Facility selection:
                        </label>
                        <Controller
                            control={control}
                            name="facilities"
                            rules={{
                                required: 'Please select at least one facility'
                            }}
                            render={({ field }) => (
                                <Select
                                    {...field}
                                    isMulti
                                    options={facilityOptions}
                                    placeholder="Select Facilities"
                                    styles={customSelectStyles}
                                    classNames={{
                                        control: () =>
                                            'input input-bordered shadow-inner bg-base-100'
                                    }}
                                />
                            )}
                        />
                        {errors.facilities && (
                            <p className="text-error text-sm">
                                {errors.facilities.message}
                            </p>
                        )}
                    </div>
                )}
            </div>
            <div className="flex items-center justify-end gap-4 mt-4">
                <button
                    type="submit"
                    className="btn btn-secondary"
                    onClick={() => {
                        void handleSubmit(onSubmit)();
                    }}
                >
                    Create Program
                </button>
            </div>
        </div>
    );
}
