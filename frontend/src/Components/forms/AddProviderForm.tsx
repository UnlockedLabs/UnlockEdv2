import { ProviderPlatformState, ProviderPlatformType } from '@/common';
import axios from 'axios';
import { useState } from 'react';
import { SubmitHandler, useForm } from 'react-hook-form';
import {
    CloseX,
    DropdownInput,
    SubmitButton,
    TextAreaInput,
    TextInput
} from '../inputs';
import { ToastState } from '../Toast';

type ProviderInputs = {
    name: string;
    type: ProviderPlatformType;
    description: string;
    base_url: string;
    account_id: string;
    access_key: string;
    icon_url: string;
    state: ProviderPlatformState;
};

export default function AddProviderForm({
    onSuccess
}: {
    onSuccess: Function;
}) {
    const [errorMessage, setErrorMessage] = useState('');

    const {
        register,
        handleSubmit,
        reset,
        formState: { errors }
    } = useForm<ProviderInputs>();

    const onSubmit: SubmitHandler<ProviderInputs> = async (data) => {
        try {
            if (!data.base_url.startsWith('http')) {
                data.base_url = 'https://' + data.base_url;
            }
            setErrorMessage('');
            const response = await axios.post('/api/provider-platforms', data);
            if (response.status !== 201) {
                onSuccess(ToastState.error, 'Failed to add provider platform');
            }
            reset();
            onSuccess(
                ToastState.success,
                'Provider platform created successfully'
            );
        } catch (error: any) {
            setErrorMessage(error.response.data.message);
        }
    };

    return (
        <div>
            <CloseX close={() => reset()} />
            <form onSubmit={handleSubmit(onSubmit)}>
                <TextInput
                    label="Name"
                    register={register}
                    interfaceRef="name"
                    required={true}
                    length={25}
                    errors={errors}
                />
                <TextAreaInput
                    label="Description"
                    register={register}
                    interfaceRef="description"
                    required={true}
                    length={255}
                    errors={errors}
                />
                <DropdownInput
                    label="Type"
                    register={register}
                    enumType={ProviderPlatformType}
                    interfaceRef="type"
                    required={true}
                    errors={errors}
                />
                <DropdownInput
                    label="State"
                    register={register}
                    enumType={ProviderPlatformState}
                    interfaceRef="state"
                    required={true}
                    errors={errors}
                />
                <TextInput
                    label="Base URL"
                    register={register}
                    interfaceRef="base_url"
                    required={true}
                    length={null}
                    errors={errors}
                />
                <TextInput
                    label="Account Id"
                    register={register}
                    interfaceRef="account_id"
                    required={true}
                    length={null}
                    errors={errors}
                />
                <TextInput
                    label="Access Key"
                    register={register}
                    interfaceRef="access_key"
                    required={true}
                    length={null}
                    errors={errors}
                />
                <TextInput
                    label="Icon URL"
                    register={register}
                    interfaceRef="icon_url"
                    required={false}
                    length={null}
                    errors={errors}
                />
                <SubmitButton errorMessage={errorMessage} />
            </form>
        </div>
    );
}
