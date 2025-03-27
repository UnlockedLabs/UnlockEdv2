import { useNavigate, useParams } from 'react-router-dom';
import {
    DropdownInput,
    NumberInput,
    SubmitButton,
    TextAreaInput,
    TextInput,
    CancelButton,
    CloseX
} from '@/Components/inputs';
import { PrgSectionStatus, ToastState } from '@/common';
import { SubmitHandler, useForm } from 'react-hook-form';
import { useState, useRef } from 'react';
import API from '@/api/api';
import { useToast } from '@/Context/ToastCtx';
import EventCalendar from '@/Components/EventCalendar';
import {
    RRuleControl,
    RRuleFormHandle
} from '@/Components/inputs/RRuleControl';

interface SectionInputs {
    capacity: number;
    name: string;
    instructor_name: string;
    description: string;
    start_dt: Date;
    end_dt: Date;
    section_id: number;
    room: string;
    section_status: string;
    credit_hours: number;
    recurrence_rule: string;
}

export default function SectionManagementForm() {
    const rruleFormRef = useRef<RRuleFormHandle>(null);
    const [calendarRule, setCalendarRule] = useState('');
    const [calendarDuration, setCalendarDuration] = useState('');
    const [calendarEventTitle, setCalendarEventTitle] = useState('');
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [showCalendar, setShowCalendar] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const { toaster } = useToast();
    const {
        register,
        handleSubmit,
        getValues,
        reset,
        formState: { errors }
    } = useForm<SectionInputs>();

    const onSubmit: SubmitHandler<SectionInputs> = async (data) => {
        setErrorMessage('');
        const rruleString = rruleFormRef.current?.createRule();
        if (rruleString?.rule === '') {
            return;
        }
        const formattedJson = {
            ...data,
            start_dt: new Date(data.start_dt),
            end_dt: new Date(data.end_dt),
            capacity: Number(data.capacity),
            credit_hours: Number(data.credit_hours),
            events: [
                {
                    recurrence_rule: rruleString?.rule,
                    room: data.room,
                    duration: rruleString?.duration
                }
            ]
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
                <div className="flex flex-col gap-4">
                    <div className="card p-6 rounded-lg shadow-md space-y-6">
                        <h2 className="text-xl font-semibold">
                            Class Information
                        </h2>
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
                        <TextInput
                            label="Room"
                            register={register}
                            interfaceRef="room"
                            required
                            length={255}
                            errors={errors}
                        />

                        <NumberInput
                            label="Credit Hours"
                            register={register}
                            interfaceRef="credit_hours"
                            length={3}
                            errors={errors}
                        />
                    </div>
                    <div className="card p-6 rounded-lg shadow-md space-y-6">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-semibold">
                                Scheduling
                            </h2>
                            <div className="flex justify-end mb-4">
                                <input
                                    type="button"
                                    onClick={() => {
                                        const rule =
                                            rruleFormRef.current?.createRule();
                                        const title = getValues('name');
                                        if (rule?.rule && title) {
                                            setCalendarRule(rule.rule);
                                            setCalendarDuration(rule.duration);
                                            setCalendarEventTitle(title);
                                            setShowCalendar(true);
                                        }
                                    }}
                                    className="btn btn-primary"
                                    value="View Calendar"
                                />
                            </div>
                        </div>
                        <RRuleControl
                            ref={rruleFormRef}
                            getValues={getValues}
                            endDateRef="end_dt"
                            startDateRef="start_dt"
                            errors={errors}
                            register={register}
                        />
                        <DropdownInput
                            label="Status"
                            register={register}
                            enumType={PrgSectionStatus}
                            interfaceRef="section_status"
                            required
                            errors={errors}
                        />
                    </div>
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
            {showCalendar && (
                <div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex items-center justify-center">
                    <div className="card w-[90vw] max-w-[1024px] max-h-[90vh] overflow-auto p-6 relative">
                        <CloseX close={() => setShowCalendar(false)} />
                        <EventCalendar
                            recurrenceRule={calendarRule}
                            durationStr={calendarDuration}
                            title={calendarEventTitle}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
