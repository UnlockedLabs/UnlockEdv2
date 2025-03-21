import { useNavigate, useParams } from 'react-router-dom';
import {
    DropdownInput,
    NumberInput,
    SubmitButton,
    TextAreaInput,
    TextInput,
    DurationInput,
    DateInput,
    ResetButton
} from '@/Components/inputs';
import { PrgSectionStatus } from '@/common';
import { SubmitHandler, useForm } from 'react-hook-form';
import { useState } from 'react';
import API from '@/api/api';

interface SectionInputs {
    capacity: number;
    name: string;
    instructor_name: string;
    description: string;
    duration: string;
    duration_unit: string;
    start_dt: Date;
    section_status: string;
    credit_hours: number;
}

export default function SectionManagementForm() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [errorMessage, setErrorMessage] = useState('');
    const {
        register,
        handleSubmit,
        reset,
        formState: { errors }
    } = useForm<SectionInputs>();

    const onSubmit: SubmitHandler<SectionInputs> = async (data) => {
        setErrorMessage('');
        const formattedJson = {
            ...data,
            duration: data.duration + data.duration_unit,
            start_dt: new Date(data.start_dt),
            capacity: Number(data.capacity),
            credit_hours: Number(data.credit_hours)
        };
        const response = await API.post(
            `programs/${id}/sections`,
            formattedJson
        );
        if (!response.success) {
            //should we put a toast message here??
            console.log('error occurred, ', response.message);
            return;
        }
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
                <div className="grid grid-cols-[2.5fr_1.5fr_1fr_1fr] gap-4 p-4">
                    <div>
                        <TextInput
                            label="Name"
                            register={register}
                            interfaceRef="name"
                            required
                            length={255}
                            errors={errors}
                        />
                    </div>
                    <div>
                        <DateInput
                            label="Start Date"
                            register={register}
                            interfaceRef="start_dt"
                            required
                            errors={errors}
                        />
                    </div>
                    <div className="col-span-2">
                        <DurationInput
                            label="Duration"
                            register={register}
                            interfaceRefUnit="duration_unit"
                            interfaceRef="duration"
                            isMonthsHours={true}
                            required
                            length={3}
                            errors={errors}
                        />
                    </div>
                    <div>
                        <TextInput
                            label="Instructor Name"
                            register={register}
                            interfaceRef="instructor_name"
                            required
                            length={255}
                            errors={errors}
                        />
                    </div>
                    <div>
                        <DropdownInput
                            label="Status"
                            register={register}
                            enumType={PrgSectionStatus}
                            interfaceRef="section_status"
                            required
                            errors={errors}
                        />
                    </div>
                    <div>
                        <NumberInput
                            label="Capacity"
                            register={register}
                            interfaceRef="capacity"
                            length={3}
                            required
                            errors={errors}
                        />
                    </div>
                    <div>
                        <NumberInput
                            label="Credit Hours"
                            register={register}
                            interfaceRef="credit_hours"
                            length={3}
                            errors={errors}
                        />
                    </div>
                    <div className="col-span-4">
                        <TextAreaInput
                            label="Description"
                            interfaceRef="description"
                            required
                            length={255}
                            errors={errors}
                            register={register}
                        />
                    </div>
                    <div className="col-span-4 flex justify-end gap-4 mt-4">
                        <div className="w-32">
                            <ResetButton reset={reset} />
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
