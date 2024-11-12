import {
    CreditType,
    Facility,
    ProgramStatus,
    ProgramType,
    ToastState
} from '@/common';
import { useState } from 'react';
import { SubmitHandler, useForm } from 'react-hook-form';
import { CloseX, DropdownInput, SubmitButton, TextInput } from '../inputs';
import API from '@/api/api';

interface ProgramInputs {
    name: string;
    description: string;
    credit_type: string;
    program_status: string;
    program_type: string;
    facilities: number[];
}

export default function CreateProgramForm({
    onSuccess,
    facilities
}: {
    onSuccess: (state: ToastState, message: string) => void;
    facilities: Facility[];
}) {
    const [errorMessage, setErrorMessage] = useState('');
    const [selectedFacilities, setSelectedFacilities] = useState<number[]>([]);
    const [hasAll, setHasAll] = useState(false);
    const {
        register,
        handleSubmit,
        reset,
        formState: { errors }
    } = useForm<ProgramInputs>();

    const onSubmit: SubmitHandler<ProgramInputs> = async (data) => {
        setErrorMessage('');
        data.facilities = selectedFacilities;
        const response = await API.post('programs', data);
        if (!response.success) {
            onSuccess(ToastState.error, 'Failed to add program');
            return;
        }
        reset();
        onSuccess(ToastState.success, 'programs');
    };

    return (
        <div>
            <CloseX close={() => reset()} />
            <form
                onSubmit={(e) => {
                    void handleSubmit(onSubmit)(e);
                }}
            >
                <TextInput
                    label="Name"
                    register={register}
                    interfaceRef="name"
                    required
                    length={255}
                    errors={errors}
                />
                <TextInput
                    label="Description"
                    register={register}
                    interfaceRef="description"
                    required
                    length={255}
                    errors={errors}
                />
                <DropdownInput
                    label="Credit-Type"
                    register={register}
                    enumType={CreditType}
                    interfaceRef="credit_type"
                    required
                    errors={errors}
                />
                <DropdownInput
                    label="Program-Type"
                    register={register}
                    enumType={ProgramType}
                    interfaceRef="program_type"
                    required
                    errors={errors}
                />
                <DropdownInput
                    label="Program-Status"
                    register={register}
                    enumType={ProgramStatus}
                    interfaceRef="program_status"
                    required
                    errors={errors}
                />
                <label className="label">
                    Facilities to make program available:
                </label>
                <div className="m-2 columns-2">
                    <input
                        type="checkbox"
                        className="checkbox mb-4 mr-1"
                        id={'all'}
                        name={'all'}
                        value={'all'}
                        onChange={() => {
                            setHasAll(!hasAll);
                            if (hasAll) setSelectedFacilities([]);
                            else
                                setSelectedFacilities(
                                    facilities.map((fac) => {
                                        return fac.id;
                                    })
                                );
                        }}
                    />
                    <label htmlFor={'all'}>{'Select All'}</label>

                    {facilities?.map((facility) => (
                        <div key={facility.id}>
                            <input
                                type="checkbox"
                                className="checkbox mb-4 mr-1"
                                id={facility.name}
                                name={facility.name}
                                value={facility.id}
                                disabled={hasAll}
                                onChange={
                                    selectedFacilities.includes(facility.id)
                                        ? () =>
                                              setSelectedFacilities(
                                                  selectedFacilities.filter(
                                                      (id) => id !== facility.id
                                                  )
                                              )
                                        : () =>
                                              setSelectedFacilities([
                                                  ...selectedFacilities,
                                                  facility.id
                                              ])
                                }
                            />
                            <label htmlFor={facility.name}>
                                {facility.name}
                            </label>
                        </div>
                    ))}
                </div>
                <SubmitButton errorMessage={errorMessage} />
            </form>
        </div>
    );
}
