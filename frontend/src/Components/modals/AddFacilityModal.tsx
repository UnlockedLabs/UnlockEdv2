import { forwardRef } from 'react';
import { FieldValues, SubmitHandler } from 'react-hook-form';
import API from '@/api/api';
import { Facility } from '@/common';
import { CRUDModalProps, facilityInputs, FormModal } from '.';
import { useCheckResponse } from '@/Hooks/useCheckResponse';

export const AddFacilityModal = forwardRef(function (
    { mutate }: CRUDModalProps<Facility>,
    addFacilityModal: React.ForwardedRef<HTMLDialogElement>
) {
    const checkResponse = useCheckResponse({
        mutate,
        refModal: addFacilityModal
    });
    const addFacility: SubmitHandler<FieldValues> = async (data) => {
        const response = await API.post('facilities', data);
        checkResponse(
            response.success,
            'Failed to add facility',
            'Facility created successfully'
        );
    };

    return (
        <FormModal
            title="Add Facility"
            inputs={facilityInputs}
            onSubmit={addFacility}
            ref={addFacilityModal}
        />
    );
});
