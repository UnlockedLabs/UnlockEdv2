import { forwardRef } from 'react';
import { CRUDModalProps, providerInputs } from '.';
import {
    ProviderPlatform,
    ProviderResponse,
    ServerResponseOne,
    ToastState
} from '@/common';
import { useToast } from '@/Context/ToastCtx';
import { FieldValues, SubmitHandler } from 'react-hook-form';
import API from '@/api/api';
import NewModal from '../Modaltest';

export const AddProviderModal = forwardRef(function (
    { mutate }: CRUDModalProps<ProviderPlatform>,
    addProviderModal: React.ForwardedRef<HTMLDialogElement>
) {
    const { toaster } = useToast();
    const addProvider: SubmitHandler<FieldValues> = async (data) => {
        const response = (await API.post(
            'provider-platforms',
            data
        )) as ServerResponseOne<ProviderResponse>;
        if (!response.success) {
            toaster('Failed to add provider platform', ToastState.error);
            return;
        }
        if (response.data.oauth2Url) {
            window.location.href = response.data.oauth2Url;
            return;
        }
        toaster('Provider platform created successfully', ToastState.success);
        await mutate();
    };
    return (
        <NewModal
            title={'Add Provider'}
            inputs={providerInputs}
            onSubmit={addProvider}
            ref={addProviderModal}
        />
    );
});
