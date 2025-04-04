import { useNavigate } from 'react-router-dom';
import {
    CreditType,
    Facility,
    ProgramType,
    ToastState,
    FundingType,
    Program,
    ServerResponseOne
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
import ULIComponent from '@/Components/ULIComponent';
import { InformationCircleIcon } from '@heroicons/react/24/outline';

interface ProgramInputs {
    name: string;
    description: string;
    credit_type: GenericOption<CreditType>[];
    program_type: GenericOption<ProgramType>[];
    is_active: boolean;
    funding_type: GenericOption<FundingType> | null;
    facilities: GenericOption<number>[];
}

interface TransformedProgramInput {
    name: string;
    description: string;
    credit_type: CreditType[];
    program_type: ProgramType[];
    is_active: boolean;
    funding_type: FundingType;
    facilities: number[];
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
        boxShadow: state.isFocused ? '0 0 0 2px var(--grey-1)' : 'none',
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
        backgroundColor: 'var(--inner-background) '
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
    const selectAllOption: GenericOption<number | 'all'> = {
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

    const facilityOptionsSelectAll = [selectAllOption, ...facilityOptions];

    const onSubmit: SubmitHandler<ProgramInputs> = async (data) => {
        const transformedData: TransformedProgramInput = {
            ...data,
            is_active: new Boolean(data.is_active).valueOf(),
            credit_type: data.credit_type.map((opt) => opt.value),
            program_type: data.program_type.map((opt) => opt.value),
            funding_type: data.funding_type
                ? data.funding_type.value
                : FundingType.OTHER,
            facilities: data.facilities.map((fac) => fac.value)
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
                                    options={facilityOptionsSelectAll}
                                    placeholder="Select Facilities"
                                    styles={customSelectStyles}
                                    classNames={{
                                        control: () =>
                                            'input input-bordered shadow-inner bg-base-100'
                                    }}
                                    onChange={(selectedOptions) => {
                                        if (
                                            selectedOptions.find(
                                                (option) =>
                                                    option.value === 'all'
                                            )
                                        ) {
                                            field.onChange(facilityOptions);
                                        } else {
                                            field.onChange(selectedOptions);
                                        }
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
                    className="btn btn-secondary"
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
