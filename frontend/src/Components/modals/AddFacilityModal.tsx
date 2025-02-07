import { forwardRef } from 'react';
import NewModal from '../Modaltest';
import { FieldValues, SubmitHandler } from 'react-hook-form';
import API from '@/api/api';
import { useToast } from '@/Context/ToastCtx';
import { Facility, ServerResponseMany, ToastState } from '@/common';
import { KeyedMutator } from 'swr';
import { facilityInputs } from './index';

export interface CRUDModalProps<T> {
    mutate: KeyedMutator<ServerResponseMany<T>>;
    target?: T;
}
export const AddFacilityModal = forwardRef(function (
    { mutate }: CRUDModalProps<Facility>,
    addFacilityModal: React.ForwardedRef<HTMLDialogElement>
) {
    const { toaster } = useToast();
    const addFacility: SubmitHandler<FieldValues> = async (data) => {
        const response = await API.post('facilities', data);
        if (!response.success) {
            toaster('Failed to add facility', ToastState.error);
            return;
        }
        toaster('Facility created successfully', ToastState.success);
        void mutate();
    };

    return (
        <NewModal
            title="Add Facility"
            inputs={facilityInputs}
            onSubmit={addFacility}
            ref={addFacilityModal}
        />
    );
});
