import { ToastState, Timezones } from '@/common';
import { useState } from 'react';
import { SubmitHandler, useForm } from 'react-hook-form';
import { CloseX, DropdownInput, SubmitButton, TextInput } from '../inputs';
import API from '@/api/api';

interface FacilityInputs {
    name: string;
    timezone: string;
}

export default function AddFacilityForm({
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
    } = useForm<FacilityInputs>();

    const onSubmit: SubmitHandler<FacilityInputs> = async (data) => {
        setErrorMessage('');
        const response = await API.post('facilities', data);
        if (!response.success) {
            onSuccess(ToastState.error, 'Failed to add facility');
            return;
        }
        reset();
        onSuccess(ToastState.success, 'Facility created successfully');
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
                <DropdownInput
                    label="Timezone"
                    register={register}
                    interfaceRef="timezone"
                    required
                    errors={errors}
                    enumType={Timezones}
                />
                <SubmitButton errorMessage={errorMessage} />
            </form>
        </div>
    );
}
