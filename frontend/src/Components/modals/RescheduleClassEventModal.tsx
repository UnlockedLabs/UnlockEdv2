import { forwardRef, useRef, useState } from 'react';
import {
    closeModal,
    FormInputTypes,
    FormModal,
    Input,
    showModal,
    TextModalType,
    TextOnlyModal
} from '.';
import { ServerResponseMany } from '@/common';
import API from '@/api/api';
import { FieldValues, SubmitHandler, UseFormGetValues } from 'react-hook-form';
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
    }>();
    const rescheduleConfirmationRef = useRef<HTMLDialogElement>(null);
    const [dataToSubmit, setDataToSubmit] = useState<FieldValues | null>(null);
    const [confirmMessage, setConfirmMessage] = useState<string | null>(null);
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
        const timeZoneStartDateTime = fromZonedTime(
            `${data.date}T${data.start_time}`,
            user.timezone
        );

        const rescheduledRule = new RRule({
            freq: RRule.DAILY,
            count: 1,
            dtstart: timeZoneStartDateTime
        }).toString();
        const duration = formatDuration(
            data.start_time as string,
            data.end_time as string
        );
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
            room: data.room as string,
            is_cancelled: false
        };

        const payload = [];
        if (cancelledEventObj) payload.push(cancelledEventObj);
        payload.push(rescheduledEvent);
        const response = await API.put(
            `program-classes/${calendarEvent.class_id}/events/${calendarEvent.id}`,
            payload
        );

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
                <>
                    <p className="mb-4">
                        You are editing a single event for this class. Changes
                        made here will apply <b>only to this occurrence</b> and
                        will not affect the rest of the schedule.
                    </p>
                </>
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
            type: FormInputTypes.Text,
            label: 'Room',
            interfaceRef: 'room',
            required: true
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
        setDataToSubmit(data);
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
        </>
    );
});
