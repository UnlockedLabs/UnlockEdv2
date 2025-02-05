import { forwardRef } from 'react';
import { CRUDModalProps, FormModal, linkInputs } from '.';
import { HelpfulLink, HelpfulLinkAndSort } from '@/common';
import { FieldValues, SubmitHandler } from 'react-hook-form';
import API from '@/api/api';
import { useCheckResponse } from '@/Hooks/useCheckResponse';

export const EditHelpfulLinkModal = forwardRef(function (
    {
        mutate,
        targetLink
    }: CRUDModalProps<HelpfulLinkAndSort> & { targetLink: HelpfulLink },
    editHelpfulLinkModal: React.ForwardedRef<HTMLDialogElement>
) {
    const checkResponse = useCheckResponse({
        mutate: mutate,
        refModal: editHelpfulLinkModal
    });
    const updateLink: SubmitHandler<FieldValues> = async (data) => {
        const response = await API.patch(
            `helpful-links/${targetLink?.id}/edit`,
            data
        );
        checkResponse(
            response.success,
            'Error updating helpful link',
            'Updated helpful link successfully'
        );
    };
    return (
        <FormModal
            title={'Edit Helpful Link'}
            inputs={linkInputs}
            defaultValues={targetLink ?? undefined}
            onSubmit={updateLink}
            ref={editHelpfulLinkModal}
        />
    );
});
