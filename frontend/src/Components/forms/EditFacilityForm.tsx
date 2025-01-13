import { Facility, ToastState, Timezones } from '@/common';
import { useState, useEffect } from 'react';
import { SubmitHandler, useForm } from 'react-hook-form';
import { CloseX, SubmitButton, DropdownInput, TextInput } from '../inputs';
import API from '@/api/api';

interface FacilityInputs {
    [key: string]: string;
    name: string;
    timezone: string;
}

export default function EditFacilityForm({
    onSuccess,
    facility
}: {
    onSuccess: (state: ToastState, message: string) => void;
    facility: Facility;
}) {
    const [errorMessage, setErrorMessage] = useState('');

    const {
        register,
        handleSubmit,
        reset,
        formState: { errors }
    } = useForm<FacilityInputs>({
        defaultValues: {
            name: facility.name,
            timezone: facility.timezone
        }
    });

    function diffFormData(formData: FacilityInputs, currentUserData: Facility) {
        const changes: Partial<Facility> = {};
        Object.keys(formData).forEach((key) => {
            if (
                formData[key] !== currentUserData[key] &&
                formData[key] !== undefined
            ) {
                changes[key] = formData[key];
            }
        });
        return changes;
    }

    const onSubmit: SubmitHandler<FacilityInputs> = async (data) => {
        const cleanData = diffFormData(data, facility);
        setErrorMessage('');
        const response = await API.patch(
            `facilities/${facility?.id}`,
            cleanData
        );
        if (!response.success) {
            onSuccess(ToastState.error, 'Failed to update facility');
            return;
        }
        reset();
        onSuccess(ToastState.success, 'Facility updated successfully');
    };

    useEffect(() => {
        reset({
            name: facility.name || '',
            timezone: facility.timezone || ''
        });
    }, [facility, reset]);

    function closeAndReset() {
        onSuccess(ToastState.null, '');
        reset();
    }

    return (
        <div>
            <CloseX close={() => closeAndReset()} />
            <form
                onSubmit={(e) => {
                    void handleSubmit(onSubmit)(e);
                }}
            >
                <TextInput
                    label="Name"
                    register={register}
                    interfaceRef="name"
                    required
                    length={255}
                    errors={errors}
                />
                <DropdownInput
                    label="Timezone"
                    register={register}
                    interfaceRef="timezone"
                    required
                    errors={errors}
                    enumType={Timezones}
                />
                <SubmitButton errorMessage={errorMessage} />
            </form>
        </div>
    );
}
