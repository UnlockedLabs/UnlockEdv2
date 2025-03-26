import { useNavigate, useParams } from 'react-router-dom';
import {
    DropdownInput,
    NumberInput,
    SubmitButton,
    TextAreaInput,
    TextInput,
    DateInput,
    CancelButton
} from '@/Components/inputs';
import { PrgSectionStatus, ToastState } from '@/common';
import { SubmitHandler, useForm } from 'react-hook-form';
import { useState } from 'react';
import API from '@/api/api';
import { useToast } from '@/Context/ToastCtx';

interface SectionInputs {
    capacity: number;
    name: string;
    instructor_name: string;
    description: string;
    start_dt: Date;
    end_dt: Date;
    section_status: string;
    credit_hours: number;
}

export default function SectionManagementForm() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [errorMessage, setErrorMessage] = useState('');
    const { toaster } = useToast();
    const {
        register,
        handleSubmit,
        reset,
        getValues,
        formState: { errors }
    } = useForm<SectionInputs>();

    const onSubmit: SubmitHandler<SectionInputs> = async (data) => {
        setErrorMessage('');
        const formattedJson = {
            ...data,
            start_dt: new Date(data.start_dt),
            end_dt: new Date(data.end_dt),
            capacity: Number(data.capacity),
            credit_hours: Number(data.credit_hours)
        };
        const response = await API.post(
            `programs/${id}/sections`,
            formattedJson
        );
        if (!response.success) {
            toaster('Failed to create class', ToastState.error);
            console.log(
                `error occurred while trying to create class, error message: ${response.message}`
            );
            return;
        }
        toaster('Class created successfully', ToastState.success);
        reset();
        navigate(`/programs/${id}`);
    };

    return (
        <div className="p-4 px-5">
            <form
                onSubmit={(e) => {
                    void handleSubmit(onSubmit)(e);
                }}
            >
                <div className="card p-6 rounded-lg shadow-md space-y-6">
                    <h2 className="text-xl font-semibold">Class Information</h2>
                    <TextInput
                        label="Name"
                        register={register}
                        interfaceRef="name"
                        required
                        length={255}
                        errors={errors}
                    />
                    <TextAreaInput
                        label="Description"
                        interfaceRef="description"
                        required
                        length={255}
                        errors={errors}
                        register={register}
                    />
                    <TextInput
                        label="Instructor"
                        register={register}
                        interfaceRef="instructor_name"
                        required
                        length={255}
                        errors={errors}
                    />
                    <NumberInput
                        label="Capacity"
                        register={register}
                        interfaceRef="capacity"
                        length={3}
                        required
                        errors={errors}
                    />
                    <DateInput
                        label="Start Date"
                        register={register}
                        interfaceRef="start_dt"
                        required
                        errors={errors}
                    />
                    <DateInput
                        label="End Date"
                        register={register}
                        interfaceRef="end_dt"
                        getValues={getValues}
                        errors={errors}
                    />
                    <NumberInput
                        label="Credit Hours"
                        register={register}
                        interfaceRef="credit_hours"
                        length={3}
                        errors={errors}
                    />
                    <DropdownInput
                        label="Status"
                        register={register}
                        enumType={PrgSectionStatus}
                        interfaceRef="section_status"
                        required
                        errors={errors}
                    />
                    <div className="col-span-4 flex justify-end gap-4 mt-4">
                        <div className="w-32">
                            <label className="form-control pt-4">
                                <CancelButton
                                    onClick={() => navigate(`/programs/${id}`)}
                                />
                            </label>
                        </div>
                        <div className="w-32">
                            <SubmitButton errorMessage={errorMessage} />
                        </div>
                    </div>
                </div>
            </form>
        </div>
    );
}
