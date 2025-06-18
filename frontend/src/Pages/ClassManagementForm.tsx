import { useLoaderData, useNavigate, useParams } from 'react-router-dom';
import {
    NumberInput,
    SubmitButton,
    TextAreaInput,
    TextInput,
    CancelButton
} from '@/Components/inputs';
import { Class, ToastState, ClassLoaderData } from '@/common';
import { SubmitHandler, useForm } from 'react-hook-form';
import { useState, useEffect } from 'react';
import API from '@/api/api';
import { useToast } from '@/Context/ToastCtx';
import { isCompletedCancelledOrArchived } from './ProgramOverviewDashboard';
import { useAuth } from '@/useAuth';

export default function ClassManagementForm() {
    const { user } = useAuth();
    if (!user) {
        return null;
    }
    const clsLoader = useLoaderData() as ClassLoaderData;
    const { id, class_id } = useParams<{ id: string; class_id?: string }>();
    const navigate = useNavigate();
    const [errorMessage, setErrorMessage] = useState('');
    const { toaster } = useToast();
    const {
        register,
        handleSubmit,
        reset,
        formState: { errors }
    } = useForm<Class>({
        defaultValues: {
            events: [{ room: '', recurrence_rule: '', duration: '' }]
        }
    });
    if (clsLoader.redirect) {
        navigate(clsLoader.redirect);
    }
    const onSubmit: SubmitHandler<Class> = async (data) => {
        setErrorMessage('');
        const creditHours = Number(data.credit_hours);
        const formattedJson = {
            ...data,
            ...(class_id && { id: Number(class_id) }),
            capacity: Number(data.capacity),
            credit_hours: creditHours > 0 ? creditHours : null,
            events: [
                {
                    ...(class_id && { id: Number(data?.events[0].id) }),
                    ...(class_id && { class_id: Number(class_id) }),
                    room: data.events[0].room
                }
            ]
        };

        const blockEdits = isCompletedCancelledOrArchived(
            clsLoader.class ?? ({} as Class)
        );
        let response;
        if (isNewClass) {
            response = await API.post(`programs/${id}/classes`, formattedJson);
        } else if (!blockEdits) {
            response = await API.patch(
                `programs/${id}/classes/${class_id}`,
                formattedJson
            );
        } else {
            toaster(
                'Cannot update classes that are complete or cancelled',
                ToastState.error
            );
            return;
        }

        if (!response.success) {
            const toasterMsg =
                class_id && response.message.includes('unenrolling')
                    ? 'Cannot update class until unenrolling residents'
                    : response.message.includes('inactive')
                      ? 'Cannot create class for an inactive program'
                      : class_id
                        ? 'Failed to update class'
                        : 'Failed to create class';
            toaster(toasterMsg, ToastState.error);
            console.error(
                `error occurred while trying to create/update class, error message: ${response.message}`
            );
            return;
        }
        toaster(
            class_id
                ? 'Class updated successfully'
                : 'Class created successfully',
            ToastState.success
        );
        reset();
        if (isNewClass) {
            navigate(`/programs/${id}`);
        } else {
            navigate(`/program-classes/${class_id}/dashboard`);
        }
    };

    useEffect(() => {
        if (isNewClass) return;
        if (clsLoader.class) {
            setEditFormValues(clsLoader.class);
        }
    }, [id, class_id, reset]);

    function setEditFormValues(editCls: Class) {
        const { credit_hours, ...values } = editCls;
        reset({
            ...values,
            ...(credit_hours > 0 ? { credit_hours } : {})
        });
    }

    const isNewClass = class_id === 'new' || !class_id;
    return (
        <div className="p-4 px-5">
            <form
                onSubmit={(e) => {
                    e.preventDefault();
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
                            interfaceRef="events.0.room"
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
                    <div className="col-span-4 flex justify-end gap-4 mt-4">
                        <div className="w-32">
                            <label className="form-control pt-4">
                                <CancelButton
                                    onClick={() => navigate(`/programs/${id}`)}
                                />
                            </label>
                        </div>
                        <div className="w-32 pt-4">
                            <SubmitButton errorMessage={errorMessage} />
                        </div>
                    </div>
                </div>
            </form>
        </div>
    );
}
