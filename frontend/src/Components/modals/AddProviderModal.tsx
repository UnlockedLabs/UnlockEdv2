import { forwardRef } from 'react';
import { CRUDModalProps, providerInputs, FormModal, FormInputTypes } from '.';
import {
    ProviderPlatform,
    ProviderResponse,
    ServerResponseOne
} from '@/common';
import { FieldValues, SubmitHandler } from 'react-hook-form';
import API from '@/api/api';
import { useCheckResponse } from '@/Hooks/useCheckResponse';

export const AddProviderModal = forwardRef(function (
    { mutate }: CRUDModalProps<ProviderPlatform>,
    addProviderModal: React.ForwardedRef<HTMLDialogElement>
) {
    const checkResponse = useCheckResponse({
        mutate,
        refModal: addProviderModal
    });
    const addProvider: SubmitHandler<FieldValues> = async (data) => {
        const response = (await API.post(
            'provider-platforms',
            data
        )) as ServerResponseOne<ProviderResponse>;
        checkResponse(
            response.success,
            'Failed to add provider platform',
            'Provider platform created successfully'
        );
        if (response.data.oauth2Url) {
            window.location.href = response.data.oauth2Url;
            return;
        }
    };
    return (
        <FormModal
            title={'Add Provider'}
            inputs={[
                ...providerInputs,
                ...[
                    {
                        type: FormInputTypes.Text,
                        label: 'Access Key',
                        interfaceRef: 'access_key',
                        required: true
                    }
                ]
            ]}
            onSubmit={addProvider}
            ref={addProviderModal}
        />
    );
});
