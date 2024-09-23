import {
    ProviderPlatform,
    ProviderPlatformState,
    ProviderPlatformType
} from '@/common';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/solid';
import { useState } from 'react';
import { SubmitHandler, useForm } from 'react-hook-form';
import { CloseX, TextInput, DropdownInput, SubmitButton } from '../inputs';
import { ToastState } from '../Toast';
import API from '@/api/api';

type ProviderInputs = {
    id: number;
    name: string;
    type: ProviderPlatformType;
    base_url: string;
    account_id: string;
    access_key: string;
    state: ProviderPlatformState;
};

export default function EditProviderForm({
    onSuccess,
    provider
}: {
    onSuccess: Function; //TODO: pass function for type
    provider: ProviderPlatform;
}) {
    const [errorMessage, setErrorMessage] = useState('');
    const [showAdditionalFields, setShowAdditionalFields] = useState(false);
    const [showAccessKey, setShowAccessKey] = useState(false);
    const [accessKey, setAccessKey] = useState('');
    const {
        register,
        handleSubmit,
        reset,
        formState: { errors }
    } = useForm<ProviderInputs>({
        defaultValues: {
            name: provider.name,
            type: provider.type,
            base_url: provider.base_url,
            account_id: provider.account_id,
            state: provider.state
        }
    });

    const getAccessKey = async () => {
        if (showAccessKey) {
            setShowAccessKey(false);
            return;
        }
        if (accessKey) {
            setShowAccessKey(true);
            return;
        }
        const response = await API.get<ProviderPlatform>(
            `provider-platforms/${provider.id}`
        );
        if (!response.success) {
            setErrorMessage('Failed to get access key');
            return;
        }
        setAccessKey(response.data['access_key']);
        setShowAccessKey(true);
    };

    function diffFormData(
        formData: ProviderInputs,
        currentUserData: ProviderPlatform
    ) {
        const changes: Partial<ProviderPlatform> = {};
        Object.keys(formData).forEach((key) => {
            if (
                formData[key] !== currentUserData[key] &&
                formData[key] !== undefined
            ) {
                changes[key] = formData[key];
            }
        });
        return changes;
    }

    const onSubmit: SubmitHandler<ProviderInputs> = async (data) => {
        const cleanData = diffFormData(data, provider);
        setErrorMessage('');
        const response = await API.patch(
            `provider-platforms/${provider?.id}`,
            cleanData
        );
        if (!response.success) {
            onSuccess(ToastState.error, 'Failed to update provider platform');
            return;
        }
        reset();
        onSuccess(ToastState.success, 'Provider platform updated successfully');
    };

    function closeAndReset() {
        onSuccess();
        reset();
    }

    return (
        <div>
            <CloseX close={() => closeAndReset()} />
            <form onSubmit={handleSubmit(onSubmit)}>
                <TextInput
                    label="Name"
                    register={register}
                    interfaceRef="name"
                    required={true}
                    length={25}
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

                {/* Button to toggle additional fields */}
                <div className="pt-4">
                    <button
                        className="btn btn-ghost"
                        type="button"
                        onClick={() =>
                            setShowAdditionalFields(!showAdditionalFields)
                        }
                    >
                        {showAdditionalFields ? 'Show Less' : 'Show More'}
                    </button>
                </div>

                <div className={showAdditionalFields ? 'contents' : 'hidden'}>
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
                    <label className="form-control">
                        <div className="label">
                            <span className="label-text">Access Key</span>
                        </div>
                        <div className="relative">
                            {showAccessKey ? (
                                <input
                                    type="text"
                                    className="input input-bordered w-full pr-10"
                                    value={accessKey}
                                    {...register('access_key', {
                                        required: 'Access Key is required',
                                        value: accessKey,
                                        onChange: (e) =>
                                            setAccessKey(e.target.value)
                                    })}
                                />
                            ) : (
                                <input
                                    type="password"
                                    className="input input-bordered w-full"
                                    value="**********"
                                    readOnly // Make the input read-only when showAccessKey is false
                                />
                            )}
                            {showAccessKey ? (
                                <EyeSlashIcon
                                    className="w-4 z-10 top-4 right-4 absolute"
                                    onClick={() => {
                                        console.log(accessKey),
                                            setAccessKey(accessKey),
                                            setShowAccessKey(false);
                                    }}
                                />
                            ) : (
                                <EyeIcon
                                    className="w-4 z-10 top-4 right-4 absolute"
                                    onClick={getAccessKey}
                                />
                            )}
                        </div>
                        <div className="text-error text-sm">
                            {errors.access_key && errors.access_key?.message}
                        </div>
                    </label>
                </div>
                <SubmitButton errorMessage={errorMessage} />
            </form>
        </div>
    );
}
