import { useLoaderData, useNavigate, useParams } from 'react-router-dom';
import {
    DropdownInput,
    NumberInput,
    SubmitButton,
    TextAreaInput,
    TextInput,
    CancelButton,
    CloseX,
    RoomSelector,
    ObjectDropdownInput
} from '@/Components/inputs';
import {
    ProgClassStatus,
    Class,
    ToastState,
    ClassLoaderData,
    Room,
    RoomConflict
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
import { RoomConflictModal, showModal } from '@/Components/modals';
import { parseDurationToMs } from '@/Components/helperFunctions/formatting';
import { RRule } from 'rrule';
import moment from 'moment';
import { toZonedTime } from 'date-fns-tz';
import { useAuth } from '@/useAuth';
import { ShortCalendarEvent, Instructor } from '@/types/events';
import useSWR from 'swr';

export default function ClassManagementForm() {
    const { user } = useAuth();
    if (!user) {
        return null;
    }
    const clsLoader = useLoaderData() as ClassLoaderData;
    const [rooms, setRooms] = useState<Room[]>(clsLoader.rooms ?? []);
    const [rruleIsValid, setRruleIsValid] = useState(false);
    const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null);
    const rruleFormRef = useRef<RRuleFormHandle>(null);
    const conflictModalRef = useRef<HTMLDialogElement>(null);
    const [conflicts, setConflicts] = useState<RoomConflict[]>([]);
    const [events, setEvents] = useState<ShortCalendarEvent[]>([]);
    const { id, class_id } = useParams<{ id: string; class_id?: string }>();
    const navigate = useNavigate();
    const [showCalendar, setShowCalendar] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const { toaster } = useToast();
    const isNewClass = class_id === 'new' || !class_id;
    const {
        register,
        handleSubmit,
        getValues,
        watch,
        reset,
        unregister,
        formState: { errors }
    } = useForm<Class>({
        defaultValues: {
            instructor_id: 0,
            events: [{ recurrence_rule: '', duration: '' }]
        }
    });
    useEffect(() => {
        if (!isNewClass && clsLoader.class) {
            setEditFormValues(clsLoader.class);
        }
    }, [clsLoader, isNewClass]);
    if (clsLoader.redirect) {
        navigate(clsLoader.redirect);
    }

    const nameValue = watch('name');
    const [canOpenCalendar, setCanOpenCalendar] = useState(false);

    const {
        data: instructorsResponse,
        error: instructorsError,
        isLoading: instructorsLoading
    } = useSWR<{ message: string; data: Instructor[] }, Error>(
        user?.facility?.id
            ? `/api/facilities/${user.facility.id}/instructors`
            : null
    );

    const instructors = instructorsResponse?.data ?? [];

    const onSubmit: SubmitHandler<Class> = async (data) => {
        setErrorMessage('');
        const rruleString = rruleFormRef.current?.createRule();
        if (isNewClass && rruleString?.rule === '') {
            return;
        }
        const creditHours = Number(data.credit_hours);
        const formattedJson = {
            ...data,
            ...(class_id && { id: Number(class_id) }),
            instructor_id:
                data.instructor_id !== undefined &&
                data.instructor_id !== null &&
                data.instructor_id !== 0
                    ? Number(data.instructor_id)
                    : null,
            start_dt: new Date(data.start_dt),
            end_dt: data.end_dt ? new Date(data.end_dt) : null,
            capacity: Number(data.capacity),
            credit_hours: creditHours > 0 ? creditHours : null,
            events: isNewClass
                ? [
                      {
                          ...(class_id && { id: Number(data?.events[0].id) }),
                          ...(class_id && { class_id: Number(class_id) }),
                          recurrence_rule: rruleString?.rule,
                          room_id: selectedRoomId,
                          duration: rruleString?.duration
                      }
                  ]
                : [
                      {
                          id: clsLoader.class!.events[0].id,
                          class_id: clsLoader.class!.events[0].class_id,
                          duration: clsLoader.class!.events[0].duration,
                          recurrence_rule:
                              clsLoader.class!.events[0].recurrence_rule,
                          room_id:
                              selectedRoomId ??
                              clsLoader.class!.events[0].room_id
                      },
                      ...clsLoader.class!.events.slice(1)
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
            const isRoomConflict =
                response.status === 409 &&
                Array.isArray(response.data) &&
                response.data.length > 0;
            if (isRoomConflict) {
                setConflicts(response.data as RoomConflict[]);
                showModal(conflictModalRef);
                return;
            }
            const toasterMsg =
                class_id && response.message.includes('unenrolling')
                    ? 'Cannot update class until unenrolling residents'
                    : response.message.includes('inactive')
                      ? 'Cannot create class for an inactive program'
                      : class_id
                        ? 'Failed to update class'
                        : 'Failed to create class';
            toaster(toasterMsg, ToastState.error);
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
        if (instructorsError) {
            toaster('Failed to load instructors', ToastState.error);
            console.error('Error fetching instructors:', instructorsError);
        }
    }, [instructorsError, toaster]);

    // Set form values for editing - wait for instructors to load first
    useEffect(() => {
        if (isNewClass) return;

        if (clsLoader.class && instructors.length > 0) {
            unregister('events');
            setEditFormValues(clsLoader.class);
        }
    }, [isNewClass, clsLoader.class, instructors.length]);

    function setEditFormValues(editCls: Class) {
        const { credit_hours, ...values } = editCls;
        const rule = RRule.fromString(editCls.events[0].recurrence_rule);
        let ruleEndDate = '';
        if (!editCls.end_dt && rule.options.until && user) {
            ruleEndDate = toZonedTime(rule.options.until, user.timezone)
                .toISOString()
                .split('T')[0];
        }

        setSelectedRoomId(editCls.events[0].room_id ?? null);
        const instructorId = editCls.instructor_id ?? editCls.instructor?.id;
        reset({
            ...values,
            instructor_id:
                instructorId && instructorId > 0 ? instructorId : 0,
            ...(credit_hours > 0 ? { credit_hours } : {}),
            start_dt: new Date(editCls.start_dt).toISOString().split('T')[0],
            end_dt: editCls.end_dt
                ? new Date(editCls.end_dt).toISOString().split('T')[0]
                : ruleEndDate
        });
    }
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
        const generated = occurrences.map((occurrence) => {
            const displayStart = toZonedTime(
                occurrence,
                user?.timezone ?? 'UTC'
            );
            return {
                title,
                start: displayStart,
                end: new Date(displayStart.getTime() + durationMs)
            };
        });
        setEvents(generated);
        setShowCalendar(true);
    }

    return (
        <div className="p-4 px-5">
            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    if (isNewClass) {
                        rruleFormRef.current?.validate();
                    }
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
                        <ObjectDropdownInput
                            label="Instructor"
                            interfaceRef="instructor_id"
                            required
                            errors={errors}
                            register={register}
                            options={instructors}
                            valueKey="id"
                            labelFn={(instructor) =>
                                `${instructor.name_first} ${instructor.name_last}`.trim()
                            }
                            isLoading={instructorsLoading}
                            placeholder="Select an instructor"
                            validation={{
                                required: 'Instructor selection is required',
                                validate: (value) => {
                                    if (
                                        value === 0 ||
                                        value === undefined ||
                                        value === null
                                    ) {
                                        return 'Please select an instructor (Unassigned is not allowed)';
                                    }
                                    return true;
                                }
                            }}
                            filterFn={(instructor) => instructor.id !== 0}
                        />
                        <NumberInput
                            label="Capacity"
                            register={register}
                            interfaceRef="capacity"
                            length={3}
                            required
                            errors={errors}
                        />
                        <RoomSelector
                            label="Room"
                            value={selectedRoomId}
                            onChange={(id) => setSelectedRoomId(id)}
                            onRoomCreated={(room) =>
                                setRooms((prev) => [...prev, room])
                            }
                            required
                        />

                        <NumberInput
                            label="Credit Hours"
                            register={register}
                            interfaceRef="credit_hours"
                            length={3}
                            errors={errors}
                        />
                    </div>
                    {isNewClass && (
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
                                formErrors={errors}
                                register={register}
                                onChange={setRruleIsValid}
                                disabled={!isNewClass}
                                initialDuration={
                                    clsLoader.class?.events[0].duration
                                }
                                initialRule={
                                    clsLoader.class?.events[0].recurrence_rule
                                }
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
                    )}

                    <div className="col-span-4 flex justify-end gap-4 mt-4">
                        <div className="w-32">
                            <label className="form-control pt-4">
                                <CancelButton
                                    onClick={() => navigate(`/programs/${id}`)}
                                />
                            </label>
                        </div>
                        <div className="w-32 pt-4">
                            <SubmitButton
                                label={
                                    isNewClass ? 'Create Class' : 'Save Changes'
                                }
                                errorMessage={errorMessage}
                            />
                        </div>
                    </div>
                </div>
            </form>
            {isNewClass && showCalendar && (
                <div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex items-center justify-center">
                    <div className="card w-[90vw] max-w-[1024px] max-h-[90vh] overflow-auto p-6 relative">
                        <CloseX close={() => setShowCalendar(false)} />
                        <EventCalendar events={events} />
                    </div>
                </div>
            )}
            <RoomConflictModal
                ref={conflictModalRef}
                conflicts={conflicts}
                timezone={user.timezone}
                roomName={rooms.find((r) => r.id === selectedRoomId)?.name}
                onClose={() => {
                    conflictModalRef.current?.close();
                    setConflicts([]);
                }}
            />
        </div>
    );
}
