import { forwardRef } from 'react';
import { CRUDModalProps, FormModal, linkInputs } from '.';
import { HelpfulLinkAndSort } from '@/common';
import { FieldValues, SubmitHandler } from 'react-hook-form';
import API from '@/api/api';
import { useCheckResponse } from '@/Hooks/useCheckResponse';

export const AddHelpfulLinkModal = forwardRef(function (
    { mutate }: CRUDModalProps<HelpfulLinkAndSort>,
    addLinkModal: React.ForwardedRef<HTMLDialogElement>
) {
    const checkResponse = useCheckResponse({
        mutate,
        refModal: addLinkModal
    });
    const addLink: SubmitHandler<FieldValues> = async (data) => {
        const response = await API.put(`helpful-links`, data);
        const errorMessage =
            response.message === 'existing_helpful_link'
                ? 'Link already exists'
                : 'Error adding helpful link';
        checkResponse(
            response.success,
            errorMessage,
            'Helpful link added successfully'
        );
    };
    return (
        <FormModal
            title={'Add Helpful Link'}
            inputs={linkInputs}
            onSubmit={addLink}
            ref={addLinkModal}
        />
    );
});
