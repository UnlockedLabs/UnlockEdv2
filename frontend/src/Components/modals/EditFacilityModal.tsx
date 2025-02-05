import { forwardRef } from 'react';
import { Facility } from '@/common';
import { CRUDModalProps, facilityInputs, FormModal } from '.';
import { FieldValues, SubmitHandler } from 'react-hook-form';
import API from '@/api/api';
import { useCheckResponse } from '@/Hooks/useCheckResponse';

export const EditFacilityModal = forwardRef(function (
    { mutate, target }: CRUDModalProps<Facility>,
    editFacilityModal: React.ForwardedRef<HTMLDialogElement>
) {
    const checkResponse = useCheckResponse({
        mutate: mutate,
        refModal: editFacilityModal
    });
    const updateFacility: SubmitHandler<FieldValues> = async (data) => {
        const response = await API.patch(`facilities/${target?.id}`, data);
        checkResponse(
            response.success,
            'Failed to update facility',
            'Facility updated successfully'
        );
    };
    return (
        <FormModal
            title="Edit Facility"
            inputs={facilityInputs}
            defaultValues={target ? target : undefined}
            onSubmit={updateFacility}
            ref={editFacilityModal}
        />
    );
});
