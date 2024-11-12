import {
    OidcClient,
    ProviderPlatform,
    ServerResponse,
    ToastState
} from '../../common';
import { useState } from 'react';
import { SubmitHandler, useForm } from 'react-hook-form';
import { TextInput } from '../inputs/TextInput';
import { SubmitButton } from '../inputs/SubmitButton';
import { CloseX } from '../inputs/CloseX';
import API from '@/api/api';

interface Inputs {
    redirect_url: string;
    provider_platform_id: number;
    auto_register: boolean;
}

export default function RegisterOidcClientForm({
    onSuccess,
    provider,
    onClose
}: {
    onSuccess: (
        response: ServerResponse<OidcClient>,
        state: ToastState
    ) => void;
    provider: ProviderPlatform;
    onClose: () => void;
}) {
    const [errorMessage, setErrorMessage] = useState('');
    const [hasAuto, setHasAuto] = useState(false);
    const {
        register,
        handleSubmit,
        formState: { errors }
    } = useForm<Inputs>({
        defaultValues: {
            redirect_url: '',
            provider_platform_id: provider.id
        }
    });

    const onSubmit: SubmitHandler<Inputs> = async (data) => {
        setErrorMessage('');
        data.auto_register = hasAuto;
        const response = await API.post<OidcClient, Inputs>(
            'oidc/clients',
            data
        );
        if (!response.success) {
            setErrorMessage('Failed to register OIDC client.');
            onSuccess(response, ToastState.error);
        }
        const client = response;
        onSuccess(client, ToastState.success);
    };

    return (
        <>
            <CloseX close={() => onClose()} />
            <form
                onSubmit={(e) => {
                    void handleSubmit(onSubmit)(e);
                }}
            >
                {!hasAuto && (
                    <div className="label-text text-warning font-semibold">
                        If you do not choose to auto register, you must manually
                        setup authentication for UnlockEd the provider
                        platform's settings.
                    </div>
                )}
                <label className="label-text text-md font-semibold">
                    Auto Register:
                </label>
                <br />
                <input
                    type="checkbox"
                    className="checkbox"
                    {...register('auto_register')}
                    onChange={() => setHasAuto(!hasAuto)}
                />
                <TextInput
                    label={'Redirect URL:'}
                    interfaceRef={'redirect_url'}
                    required={false}
                    length={100}
                    errors={errors}
                    register={register}
                />
                <label className="label-text text-md font-semibold">
                    If you are unsure about the redirect URL, leave it blank.
                </label>
                <SubmitButton errorMessage={errorMessage} />
            </form>
        </>
    );
}
