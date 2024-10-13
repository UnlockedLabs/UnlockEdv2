import {
    ProviderPlatformState,
    ProviderPlatformType,
    ToastState
} from '@/common';
import { useState } from 'react';
import { SubmitHandler, useForm } from 'react-hook-form';
import { CloseX, DropdownInput, SubmitButton, TextInput } from '../inputs';
import API from '@/api/api';

interface ProviderInputs {
    name: string;
    type: ProviderPlatformType;
    base_url: string;
    account_id: string;
    access_key: string;
    state: ProviderPlatformState;
}

export default function AddProviderForm({
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
    } = useForm<ProviderInputs>();

    const onSubmit: SubmitHandler<ProviderInputs> = async (data) => {
        if (!data.base_url.startsWith('http')) {
            data.base_url = 'https://' + data.base_url;
        }
        setErrorMessage('');
        const response = await API.post('provider-platforms', data);
        if (!response.success) {
            onSuccess(ToastState.error, 'Failed to add provider platform');
            return;
        }
        reset();
        onSuccess(ToastState.success, 'Provider platform created successfully');
    };

    return (
        <div>
            <CloseX close={() => reset()} />
            <form
                onSubmit={() => {
                    void handleSubmit(onSubmit);
                }}
            >
                <TextInput
                    label="Name"
                    register={register}
                    interfaceRef="name"
                    required
                    length={25}
                    errors={errors}
                />
                <DropdownInput
                    label="Type"
                    register={register}
                    enumType={ProviderPlatformType}
                    interfaceRef="type"
                    required
                    errors={errors}
                />
                <DropdownInput
                    label="State"
                    register={register}
                    enumType={ProviderPlatformState}
                    interfaceRef="state"
                    required
                    errors={errors}
                />
                <TextInput
                    label="Base URL"
                    register={register}
                    interfaceRef="base_url"
                    required
                    length={undefined}
                    errors={errors}
                />
                <TextInput
                    label="Account Id"
                    register={register}
                    interfaceRef="account_id"
                    required
                    length={undefined}
                    errors={errors}
                />
                <TextInput
                    label="Access Key"
                    register={register}
                    interfaceRef="access_key"
                    required
                    length={undefined}
                    errors={errors}
                />
                <SubmitButton errorMessage={errorMessage} />
            </form>
        </div>
    );
}
