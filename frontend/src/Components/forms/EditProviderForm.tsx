import {
    ProviderPlatform,
    ProviderPlatformState,
    ProviderPlatformType,
    ToastState
} from '@/common';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/solid';
import { useState } from 'react';
import { SubmitHandler, useForm } from 'react-hook-form';
import { CloseX, DropdownInput, SubmitButton, TextInput } from '../inputs';
import API from '@/api/api';

interface ProviderInputs {
    [key: string]:
        | string
        | ProviderPlatformType
        | ProviderPlatformState
        | number;
    id: number;
    name: string;
    type: ProviderPlatformType;
    base_url: string;
    account_id: string;
    access_key: string;
    state: ProviderPlatformState;
}

export default function EditProviderForm({
    onSuccess,
    provider
}: {
    onSuccess: (state: ToastState, message: string) => void;
    provider: ProviderPlatform;
}) {
    const [errorMessage, setErrorMessage] = useState('');
    const [showAdditionalFields, setShowAdditionalFields] = useState(false);
    const [showAccessKey, setShowAccessKey] = useState(false);
    const [accessKey, setAccessKey] = useState<string>(provider.access_key);

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
            state: provider.state,
            access_key: provider.access_key
        }
    });

    const toggleAccessKey = () => {
        setShowAccessKey(!showAccessKey);
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
        onSuccess(ToastState.null, '');
        reset();
    }

    return (
        <div>
            <CloseX close={() => closeAndReset()} />
            <form onSubmit={(e) => void handleSubmit(onSubmit)(e)}>
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
                    <label className="form-control">
                        <div className="relative">
                            <div className="label">
                                <span className="label-text">Access Key</span>
                            </div>
                            {showAccessKey ? (
                                <>
                                    <input // TextInput component cannot be used because we need to modify class
                                        type="text"
                                        className="input input-bordered w-full pr-10"
                                        value={accessKey}
                                        {...register('access_key', {
                                            required: 'Access Key is required',
                                            value: accessKey,
                                            onChange: (
                                                e: React.ChangeEvent<HTMLInputElement>
                                            ) => setAccessKey(e.target.value)
                                        })}
                                    />
                                    <EyeSlashIcon
                                        className="w-4 z-10 bottom-4 right-4 absolute"
                                        onClick={toggleAccessKey}
                                        onMouseDown={(e) => e.preventDefault()}
                                    />
                                </>
                            ) : (
                                <>
                                    <input
                                        type="password"
                                        className="input input-bordered w-full"
                                        value="**********"
                                        readOnly
                                    />
                                    <EyeIcon
                                        className="w-4 z-10 bottom-4 right-4 absolute"
                                        onClick={toggleAccessKey}
                                        onMouseDown={(e) => e.preventDefault()}
                                    />
                                </>
                            )}
                        </div>
                        <div className="text-error text-sm">
                            {errors.access_key?.message}
                        </div>
                    </label>
                </div>
                <SubmitButton errorMessage={errorMessage} />
            </form>
        </div>
    );
}
