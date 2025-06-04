import { forwardRef } from 'react';
import { FormInputTypes, Input, requestContentInputs } from '.';
import FormModal from './FormModal';
import { FieldValues, SubmitHandler } from 'react-hook-form';
import API from '@/api/api';
import { useToast } from '@/Context/ToastCtx';
import { ToastState } from '@/common';

export const RequestContentModal = forwardRef(function (
    { successRequestContent }: { successRequestContent: () => void },
    ref: React.ForwardedRef<HTMLDialogElement>
) {
    const { toaster } = useToast();

    const submitContentRequest: SubmitHandler<FieldValues> = async (data) => {
        const response = await API.post('open-content/request-content', data);
        if (response.success) {
            successRequestContent();
        } else {
            toaster(
                'Failed to submit content request. Please try again later.',
                ToastState.error
            );
        }
    };
    const anonymityNote: Input = {
        type: FormInputTypes.Unique,
        label: '',
        interfaceRef: '',
        required: false,
        uniqueComponent: (
            <p className="body-small italic pt-4">
                Note: Requests are shared with your name so we can follow up if
                we need more information.
            </p>
        )
    };
    return (
        <FormModal
            title={'Request Content'}
            inputs={[...requestContentInputs, anonymityNote]}
            onSubmit={submitContentRequest}
            ref={ref}
        ></FormModal>
    );
});
