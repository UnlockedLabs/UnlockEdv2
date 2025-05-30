import { useLoaderData, useNavigate, useParams } from 'react-router-dom';
import {
    DropdownInput,
    NumberInput,
    SubmitButton,
    TextAreaInput,
    TextInput,
    CancelButton,
    CloseX
} from '@/Components/inputs';
import {
    ProgClassStatus,
    Class,
    ToastState,
    ClassLoaderData,
    ShortCalendarEvent
} from '@/common';
import { SubmitHandler, useForm } from 'react-hook-form';
import { useState, useRef, useEffect } from 'react';
import API from '@/api/api';
import { useToast } from '@/Context/ToastCtx';
import EventCalendar from '@/Components/EventCalendar';
import {
    RRuleControl,
    RRuleFormHandle
} from '@/Components/inputs/RRuleControl';
import { isCompletedCancelledOrArchived } from './ProgramOverviewDashboard';
import { parseDurationToMs } from '@/Components/helperFunctions/formatting';
import { RRule } from 'rrule';
import moment from 'moment';

export default function ClassManagementForm() {
    const clsLoader = useLoaderData() as ClassLoaderData;
    const [rruleIsValid, setRruleIsValid] = useState(false);
    const rruleFormRef = useRef<RRuleFormHandle>(null);
    const [events, setEvents] = useState<ShortCalendarEvent[]>([]);
    const { id, class_id } = useParams<{ id: string; class_id?: string }>();
    const navigate = useNavigate();
    const [showCalendar, setShowCalendar] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const { toaster } = useToast();
    const {
        register,
        handleSubmit,
        getValues,
        watch,
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

    const nameValue = watch('name');
    const [canOpenCalendar, setCanOpenCalendar] = useState(false);
    const onSubmit: SubmitHandler<Class> = async (data) => {
        setErrorMessage('');
        const rruleString = rruleFormRef.current?.createRule();
        if (rruleString?.rule === '') {
            return;
        }
        const creditHours = Number(data.credit_hours);
        const formattedJson = {
            ...data,
            ...(class_id && { id: Number(class_id) }),
            start_dt: new Date(data.start_dt),
            end_dt: data.end_dt ? new Date(data.end_dt) : null,
            capacity: Number(data.capacity),
            credit_hours: creditHours > 0 ? creditHours : null,
            events: [
                {
                    ...(class_id && { id: Number(data?.events[0].id) }),
                    ...(class_id && { class_id: Number(class_id) }),
                    recurrence_rule: rruleString?.rule,
                    room: data.events[0].room,
                    duration: rruleString?.duration
                }
            ]
        };

        const canEditClass = isCompletedCancelledOrArchived(
            clsLoader.class ?? ({} as Class)
        );
        let response;
        if (isNewClass) {
            response = await API.post(`programs/${id}/classes`, formattedJson);
        } else if (canEditClass) {
            response = await API.patch(
                `program-classes/${class_id}`,
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
        setCanOpenCalendar(!!nameValue && rruleIsValid);
    }, [nameValue, rruleIsValid]);

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
            ...(credit_hours > 0 ? { credit_hours } : {}),
            start_dt: new Date(editCls.start_dt).toISOString().split('T')[0],
            end_dt: editCls.end_dt
                ? new Date(editCls.end_dt).toISOString().split('T')[0]
                : editCls.end_dt
        });
    }

    const isNewClass = class_id === 'new' || !class_id;
    const filteredEnumType: Partial<typeof ProgClassStatus> = isNewClass
        ? {
              SCHEDULED: ProgClassStatus.SCHEDULED,
              ACTIVE: ProgClassStatus.ACTIVE
          }
        : { ...ProgClassStatus };

    function openCalendar() {
        const createdRule = rruleFormRef.current?.createRule();
        if (!createdRule)
            return toaster('Unable to open calendar', ToastState.error);
        const title = getValues('name');
        const duration = createdRule.duration;
        const calendarRule = createdRule.rule;

        const durationMs = parseDurationToMs(duration);
        const cleanRule = calendarRule.replace(
            /DTSTART;TZID=Local:/,
            'DTSTART:'
        );
        const rule = RRule.fromString(cleanRule);
        const occurrences = rule.between(
            new Date(),
            moment().add(1, 'year').toDate()
        );
        const generated = occurrences.map((occurrence) => ({
            title,
            start: occurrence,
            end: new Date(occurrence.getTime() + durationMs)
        }));
        setEvents(generated);
        setShowCalendar(true);
    }

    return (
        <div className="p-4 px-5">
            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    rruleFormRef.current?.validate();
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
                    <div className="card p-6 rounded-lg shadow-md space-y-6">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-semibold">
                                Scheduling
                            </h2>
                            <div className="flex justify-end mb-4">
                                <input
                                    type="button"
                                    onClick={() => openCalendar()}
                                    disabled={!canOpenCalendar}
                                    className="button"
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
                            onChange={setRruleIsValid}
                            disabled={!isNewClass}
                        />
                        <DropdownInput
                            label="Status"
                            register={register}
                            enumType={filteredEnumType}
                            interfaceRef="status"
                            required
                            errors={errors}
                            disabled={!isNewClass}
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
            {showCalendar && (
                <div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex items-center justify-center">
                    <div className="card w-[90vw] max-w-[1024px] max-h-[90vh] overflow-auto p-6 relative">
                        <CloseX close={() => setShowCalendar(false)} />
                        <EventCalendar events={events} />
                    </div>
                </div>
            )}
        </div>
    );
}
