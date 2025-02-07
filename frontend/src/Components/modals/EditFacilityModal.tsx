import { forwardRef } from 'react';
import { CRUDModalProps } from './AddFacilityModal';
import { Facility, ToastState } from '@/common';
import NewModal from '../Modaltest';
import { facilityInputs } from './index';
import { FieldValues, SubmitHandler } from 'react-hook-form';
import API from '@/api/api';
import { useToast } from '@/Context/ToastCtx';

export const EditFacilityModal = forwardRef(function (
    { mutate, target }: CRUDModalProps<Facility>,
    editFacilityModal: React.ForwardedRef<HTMLDialogElement>
) {
    const { toaster } = useToast();
    const updateFacility: SubmitHandler<FieldValues> = async (data) => {
        const response = await API.patch(`facilities/${target?.id}`, data);
        if (!response.success) {
            toaster('Failed to update facility', ToastState.error);
            return;
        }
        toaster('Facility updated successfully', ToastState.success);
        if (
            editFacilityModal &&
            'current' in editFacilityModal &&
            editFacilityModal.current
        ) {
            editFacilityModal.current.close();
        }
        void mutate();
    };
    return (
        <NewModal
            title="Edit Facility"
            inputs={facilityInputs}
            defaultValues={target ? target : undefined}
            onSubmit={updateFacility}
            ref={editFacilityModal}
        />
    );
});
