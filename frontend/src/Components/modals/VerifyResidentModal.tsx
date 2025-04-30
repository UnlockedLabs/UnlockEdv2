import { forwardRef, useState } from 'react';
import {
    closeModal,
    CRUDModalProps,
    FormInputTypes,
    FormModal,
    Input
} from '.';
import { FieldValues, SubmitHandler } from 'react-hook-form';
import {
    Facility,
    ResidentEngagementProfile,
    ServerResponseOne,
    ToastState,
    ValidResident
} from '@/common';
import API from '@/api/api';
import { useLoaderData } from 'react-router-dom';
import { useToast } from '@/Context/ToastCtx';
export const VerifyResidentModal = forwardRef(function (
    {
        onSuccess,
        target
    }: CRUDModalProps<ResidentEngagementProfile> & {
        onSuccess: (resident: ValidResident) => void;
    },
    verifyResidentModal: React.ForwardedRef<HTMLDialogElement>
) {
    const { toaster } = useToast();
    const [errors, setErrors] = useState('');
    const [facility, setFacility] = useState('');
    const facilities = useLoaderData() as Facility[];
    const target_user = target?.user.doc_id;

    const executeResidentCheck: SubmitHandler<FieldValues> = async (data) => {
        if (!validateFacility()) {
            return;
        }

        const response = (await API.get(
            `users/resident-verify?user_id=${target?.user.id}&doc_id=${data.doc_id}&facility_id=${facility}`
        )) as ServerResponseOne<ValidResident>;

        if (response.success) {
            response.data.transfer_from = facilities?.find(
                (fac) => fac.id === target?.user.facility_id
            )?.name;
            response.data.transfer_to = facilities?.find(
                (fac) => fac.id === Number(facility)
            )?.name;
            onSuccess(response.data);
            setFacility('');
            closeModal(verifyResidentModal);
        } else {
            toaster('Resident not found, try again', ToastState.error);
        }
    };
    const validateFacility = (): boolean => {
        if (facility === '') {
            setErrors('Facility is required');
            return false;
        }
        setErrors('');
        return true;
    };
    const FacilityDropdown = () => {
        return (
            <>
                <h2>Step 1: Select New Facility</h2>
                <label className="form-control w-full">
                    <select
                        id="facility"
                        className="select select-bordered"
                        value={facility}
                        onChange={(e) => {
                            setFacility(e.target.value);
                            setErrors('');
                        }}
                    >
                        <option key={'999'} value={''}>
                            Select Facility
                        </option>
                        {facilities
                            ?.filter(
                                (facility) =>
                                    facility.id !== target?.user.facility_id
                            )
                            .map((facility) => (
                                <option key={facility.id} value={facility.id}>
                                    {facility.name}
                                </option>
                            ))}
                    </select>
                    <div className="text-error text-sm">{errors}</div>
                </label>
            </>
        );
    };

    const residentInputs: Input[] = [
        {
            type: FormInputTypes.Unique,
            label: '',
            interfaceRef: '',
            required: true,
            uniqueComponent: (
                <h2 className="mt-8">Step 2: Confirm Resident to transfer</h2>
            )
        },
        {
            type: FormInputTypes.Text,
            label: 'Type the ID number of the resident to transfer:',
            interfaceRef: 'doc_id',
            required: true,
            onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
                const match = event.target.value === target_user?.toString();
                setIsDocIDMatch(match);
            }
        }
    ];
    const [isDocIDMatch, setIsDocIDMatch] = useState(false);
    return (
        <FormModal
            title={'Transfer Resident'}
            inputs={[
                {
                    type: FormInputTypes.Unique,
                    label: '',
                    interfaceRef: '',
                    required: true,
                    uniqueComponent: <FacilityDropdown />
                },
                ...residentInputs
            ]}
            extValidationIsValid={validateFacility}
            onSubmit={executeResidentCheck}
            ref={verifyResidentModal}
            showCancel={true}
            submitText="Continue to confirmation"
            verifyResidentDOCIDMode
            isDocIDMatch={isDocIDMatch}
        />
    );
});
