import { forwardRef } from 'react';
import { requestContentInputs } from '.';
import FormModal from './FormModal';
import { FieldValues, SubmitHandler } from 'react-hook-form';
import API from '@/api/api';

export const RequestContentModal = forwardRef(function (
    _props,
    ref: React.ForwardedRef<HTMLDialogElement>
) {
    const submitContentRequest: SubmitHandler<FieldValues> = async (data) => {
        const response = await API.post('open-content/request-content', data);
        // checkResponse(
        //     response.success,
        //     'Failed to add facility',
        //     'Facility created successfully'
        // );
        console.log(response);
    };
    return (
        <FormModal
            title={'Request Content'}
            inputs={requestContentInputs}
            onSubmit={submitContentRequest}
            ref={ref}
        ></FormModal>
    );
});
