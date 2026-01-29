import { forwardRef, useRef, useState } from 'react';
import {
    closeModal,
    FormInputTypes,
    FormModal,
    Input,
    RoomConflictModal,
    showModal,
    TextModalType,
    TextOnlyModal
} from '.';
import { RoomConflict, ServerResponseMany } from '@/common';
import API from '@/api/api';
import {
    Control,
    FieldValues,
    SubmitHandler,
    UseFormGetValues,
    UseFormRegister,
    UseFormWatch
} from 'react-hook-form';
import { KeyedMutator } from 'swr';
import { useCheckResponse } from '@/Hooks/useCheckResponse';
import { useAuth } from '@/useAuth';
import { RRule } from 'rrule';
import { fromZonedTime, toZonedTime } from 'date-fns-tz';
import { createCancelledEvent } from './CancelClassEventModal';
import {
    formatDuration,
    fromLocalDateToNumericDateFormat
} from '../helperFunctions';
import { FacilityProgramClassEvent } from '@/types/events';
import { RoomSelector } from '../inputs/RoomSelector';

export const RescheduleClassEventModal = forwardRef(function (
    {
        calendarEvent,
        mutate,
        handleCallback
    }: {
        calendarEvent?: FacilityProgramClassEvent;
        mutate: KeyedMutator<ServerResponseMany<FacilityProgramClassEvent>>;
        handleCallback?: () => void;
    },
    ref: React.ForwardedRef<HTMLDialogElement>
) {
    const { user } = useAuth();
    if (!user) {
        return null;
    }
    const checkResponse = useCheckResponse({
        mutate: mutate,
        refModal: ref
    });
    const [formDataRef, setFormDataRef] = useState<{
        getValues: UseFormGetValues<any>; // eslint-disable-line
        register: UseFormRegister<any>; // eslint-disable-line
        control: Control<any>; // eslint-disable-line
        watch: UseFormWatch<any>; // eslint-disable-line
    }>();
    const rescheduleConfirmationRef = useRef<HTMLDialogElement>(null);
    const conflictModalRef = useRef<HTMLDialogElement>(null);
    const [dataToSubmit, setDataToSubmit] = useState<FieldValues | null>(null);
    const [confirmMessage, setConfirmMessage] = useState<string | null>(null);
    const [conflicts, setConflicts] = useState<RoomConflict[]>([]);
    const [selectedRoomId, setSelectedRoomId] = useState<number | null>(
        calendarEvent?.room_id ?? null
    );
    const [selectedRoomName, setSelectedRoomName] = useState<
        string | undefined
    >(calendarEvent?.room);

    const rescheduleClassEvent: SubmitHandler<FieldValues> = async (data) => {
        if (!calendarEvent) {
            return;
        }
        let cancelledEventObj;
        if (!calendarEvent.is_override) {
            cancelledEventObj = createCancelledEvent(
                calendarEvent,
                'rescheduled',
                user?.timezone
            );
        }

        //reschedule logic
        const dateStr = (data.date as string).replace(/-/g, '');
        const timeStr = (data.start_time as string).replace(':', '') + '00';
        const rescheduledRule = `DTSTART;TZID=${user.timezone}:${dateStr}T${timeStr}\nRRULE:FREQ=DAILY;COUNT=1`;
        const duration = formatDuration(
            data.start_time as string,
            data.end_time as string
        );
        const roomIdToUse =
            (data.selectedRoomId as number | null) ?? calendarEvent.room_id;
        const rescheduledEvent = {
            ...(calendarEvent.linked_override_event && {
                linked_override_event_id:
                    calendarEvent.linked_override_event.override_id
            }),
            ...(calendarEvent.is_override && { id: calendarEvent.override_id }),
            event_id: calendarEvent.id,
            class_id: calendarEvent.class_id,
            override_rrule: rescheduledRule,
            duration: duration,
            room_id: roomIdToUse,
            is_cancelled: false
        };

        const payload = [];
        if (cancelledEventObj) payload.push(cancelledEventObj);
        payload.push(rescheduledEvent);
        const response = await API.put(
            `program-classes/${calendarEvent.class_id}/events/${calendarEvent.id}`,
            payload
        );

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
        }

        checkResponse(
            response.success,
            'Failed to update event',
            'Successfully updated event'
        );

        if (response.success && handleCallback) {
            handleCallback();
        }
    };

    const rescheduleClassEventInputs: Input[] = [
        {
            type: FormInputTypes.Unique,
            label: '',
            interfaceRef: '',
            required: true,
            uniqueComponent: (
                <p className="mb-4">
                    You are editing a single event for this class. Changes made
                    here will apply <b>only to this occurrence</b> and will not
                    affect the rest of the schedule.
                </p>
            )
        },
        {
            type: FormInputTypes.Date,
            allowPastDate: true,
            label: 'Date',
            interfaceRef: 'date',
            required: true
        },
        {
            type: FormInputTypes.Time,
            label: 'Start Time',
            interfaceRef: 'start_time',
            required: true,
            getValues: formDataRef?.getValues
        },
        {
            type: FormInputTypes.Time,
            label: 'End Time',
            interfaceRef: 'end_time',
            required: true,
            getValues: formDataRef?.getValues
        },
        {
            type: FormInputTypes.Unique,
            label: '',
            interfaceRef: '',
            required: false,
            uniqueComponent: (
                <RoomSelector
                    label="Room"
                    value={selectedRoomId}
                    onChange={(id, name) => {
                        setSelectedRoomId(id);
                        setSelectedRoomName(name);
                    }}
                    required
                />
            )
        }
    ];

    const verifyDatesAndShowModal = (data: FieldValues) => {
        if (!calendarEvent?.recurrence_rule) return;

        const originalRRule = RRule.fromString(calendarEvent.recurrence_rule);
        const originalStart = toZonedTime(
            originalRRule.options.dtstart,
            user.timezone
        );
        const newDate = fromZonedTime(
            `${data.date}T${data.start_time}`,
            user.timezone
        );

        if (newDate < originalStart) {
            setConfirmMessage(
                `You are scheduling this event before the planned start date of ${fromLocalDateToNumericDateFormat(originalStart, 'UTC')}.`
            );
        } else if (originalRRule.options.until) {
            const originalEndDate = toZonedTime(
                originalRRule.options.until,
                user.timezone
            );
            if (newDate > originalEndDate) {
                setConfirmMessage(
                    `You are scheduling this event beyond the planned end date of ${fromLocalDateToNumericDateFormat(originalEndDate, 'UTC')}.`
                );
            }
        }
        const dataWithRoom = { ...data, selectedRoomId };
        setDataToSubmit(dataWithRoom);
        showModal(rescheduleConfirmationRef);
        closeModal(ref);
    };

    return (
        <>
            <FormModal
                setFormDataRef={setFormDataRef}
                submitText="Save Changes"
                ref={ref}
                title={'Edit Event'}
                inputs={rescheduleClassEventInputs}
                showCancel={true}
                onSubmit={(data) => {
                    verifyDatesAndShowModal(data);
                }}
            />
            <TextOnlyModal
                ref={rescheduleConfirmationRef}
                type={TextModalType.Confirm}
                title="Confirm Reschedule"
                text={
                    <div>
                        <p>
                            {confirmMessage
                                ? confirmMessage
                                : 'Are you sure you want to reschedule this event?'}
                        </p>
                    </div>
                }
                onSubmit={() => {
                    if (dataToSubmit) {
                        void rescheduleClassEvent(dataToSubmit);
                        setDataToSubmit(null);
                        closeModal(rescheduleConfirmationRef);
                    }
                }}
                onClose={() => {
                    setDataToSubmit(null);
                    closeModal(rescheduleConfirmationRef);
                }}
            ></TextOnlyModal>
            <RoomConflictModal
                ref={conflictModalRef}
                conflicts={conflicts}
                timezone={user.timezone}
                roomName={selectedRoomName}
                onClose={() => {
                    conflictModalRef.current?.close();
                    setConflicts([]);
                }}
            />
        </>
    );
});
