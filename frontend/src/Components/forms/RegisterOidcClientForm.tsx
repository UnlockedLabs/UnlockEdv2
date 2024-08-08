import { OidcClient, ProviderPlatform, ServerResponse } from '../../common';
import axios from 'axios';
import { useState } from 'react';
import { useForm, SubmitHandler } from 'react-hook-form';
import { TextInput } from '../inputs/TextInput';
import { SubmitButton } from '../inputs/SubmitButton';
import { CloseX } from '../inputs/CloseX';
import { ToastState } from '../Toast';

type Inputs = {
    redirect_url: string;
    provider_platform_id: number;
    auto_register: boolean;
};

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
        try {
            setErrorMessage('');
            data.auto_register = hasAuto;
            const response = await axios.post('/api/oidc/clients', data);
            if (response.status !== 201) {
                setErrorMessage('Failed to register OIDC client.');
                onSuccess(response.data, ToastState.error);
            }
            const client = response.data as ServerResponse<OidcClient>;
            onSuccess(client, ToastState.success);
        } catch (error: any) {
            setErrorMessage(error);
            onSuccess(error.response.data, ToastState.error);
        }
    };

    return (
        <>
            <CloseX close={() => onClose()} />
            <form onSubmit={handleSubmit(onSubmit)}>
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
