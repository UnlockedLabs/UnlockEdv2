import { forwardRef } from 'react';
import { requestContentInputs } from '.';
import FormModal from './FormModal';
import { FieldValues, SubmitHandler } from 'react-hook-form';

export const RequestContentModal = forwardRef(function (
    _props,
    ref: React.ForwardedRef<HTMLDialogElement>
) {
    const submitContentRequest: SubmitHandler<FieldValues> = (data) => {
        // const response = await API.post('facilities', data);
        // checkResponse(
        //     response.success,
        //     'Failed to add facility',
        //     'Facility created successfully'
        // );
        console.log(data);
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
