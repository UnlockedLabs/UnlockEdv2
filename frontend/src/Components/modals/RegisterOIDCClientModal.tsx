import { forwardRef } from 'react';
import {
    CRUDModalProps,
    FormInputTypes,
    FormModal,
    registerProviderInputs
} from '.';
import { OidcClient, ProviderPlatform } from '@/common';
import { FieldValues, SubmitHandler } from 'react-hook-form';
import API from '@/api/api';
import { useCheckResponse } from '@/Hooks/useCheckResponse';

export const RegisterOIDCClientModal = forwardRef(function (
    {
        mutate,
        target,
        onSuccess
    }: CRUDModalProps<ProviderPlatform> & {
        onSuccess: (oidcClient: OidcClient) => void;
    },
    registerProviderModal: React.ForwardedRef<HTMLDialogElement>
) {
    const checkResponse = useCheckResponse({
        mutate: mutate,
        refModal: registerProviderModal
    });
    const registerProvider: SubmitHandler<FieldValues> = async (data) => {
        data.provider_platform_id = target?.id;
        const response = await API.post<OidcClient, FieldValues>(
            'oidc/clients',
            data
        );
        checkResponse(
            response.success,
            'Failed to register OIDC client',
            'Successfully registered OIDC client'
        );
        onSuccess(response.data as OidcClient);
    };

    const OIDCWarning = () => {
        return (
            <>
                <p className="body text-error pb-2">
                    If you do not choose to auto register, you must manually
                    setup authentication for UnlockEd the provider platform's
                    settings.
                </p>
                <p className="body">
                    If you are unsure about the redirect URL, leave it blank.
                </p>
            </>
        );
    };

    return (
        <FormModal
            ref={registerProviderModal}
            title={'Register Provider'}
            inputs={[
                {
                    type: FormInputTypes.Unique,
                    label: '',
                    interfaceRef: '',
                    required: false,
                    uniqueComponent: <OIDCWarning />
                },
                ...registerProviderInputs
            ]}
            onSubmit={registerProvider}
        />
    );
});
