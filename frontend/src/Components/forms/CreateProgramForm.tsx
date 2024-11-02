import { ProgramStatus, ProgramType, ToastState } from '@/common';
import { useState } from 'react';
import { SubmitHandler, useForm } from 'react-hook-form';
import { CloseX, DropdownInput, SubmitButton, TextInput } from '../inputs';
import API from '@/api/api';

interface ProgramInputs {
    name: string;
    description: string;
    credit_type: string;
    program_status: string;
}

export default function CreateProgramForm({
    onSuccess
}: {
    onSuccess: (state: ToastState, message: string) => void;
}) {
    const [errorMessage, setErrorMessage] = useState('');

    const {
        register,
        handleSubmit,
        reset,
        formState: { errors }
    } = useForm<ProgramInputs>();

    const onSubmit: SubmitHandler<ProgramInputs> = async (data) => {
        setErrorMessage('');
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
                    enumType={ProgramType}
                    interfaceRef="credit_type"
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
                <SubmitButton errorMessage={errorMessage} />
            </form>
        </div>
    );
}
