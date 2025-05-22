import { forwardRef, useEffect, useRef, useState } from 'react';
import {
    closeModal,
    FormInputTypes,
    FormModal,
    Input,
    showModal,
    TextModalType,
    TextOnlyModal
} from '.';
import { Class, ServerResponseOne } from '@/common';
import API from '@/api/api';
import { FieldValues, SubmitHandler } from 'react-hook-form';
import { CalendarClassEvent } from '../EventCalendar';
import { KeyedMutator } from 'swr';
import { useCheckResponse } from '@/Hooks/useCheckResponse';
import { useAuth } from '@/useAuth';
import { RRule } from 'rrule';
import { fromZonedTime, toZonedTime } from 'date-fns-tz';

export const RescheduleClassEventModal = forwardRef(function (
    {
        calendarEvent,
        mutate
    }: {
        calendarEvent?: CalendarClassEvent;
        mutate: KeyedMutator<ServerResponseOne<Class>>;
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
    const rescheduleConfirmationRef = useRef<HTMLDialogElement>(null);
    const [dataToSubmit, setDataToSubmit] = useState<FieldValues | null>(null);
    const [startTime, setStartTime] = useState('');
    const [endTime, setEndTime] = useState('');
    const [timeErrors, setTimeErrors] = useState({
        startTime: '',
        endTime: '',
        startDateTime: ''
    });

    const rescheduleClassEvent: SubmitHandler<FieldValues> = async (data) => {
        if (!calendarEvent?.classEvent || !validateTimes(data)) return;
        const cancelledDate =
            calendarEvent.start
                .toISOString()
                .replace(/[-:]/g, '')
                .slice(0, 15) + 'Z';
        const cancelledRule = `DTSTART:${cancelledDate}\nRRULE:FREQ=DAILY;COUNT=1`;
        const programClassEvent = calendarEvent.classEvent;
        const cancelledEvent = {
            event_id: programClassEvent?.id,
            class_id: programClassEvent?.class_id,
            override_rrule: cancelledRule,
            duration: programClassEvent?.duration,
            room: programClassEvent?.room,
            is_cancelled: true,
            reason: 'rescheduled'
        };
        //reschedule logic
        const timeZoneStartDateTime = fromZonedTime(
            `${data.date}T${startTime}`,
            user.timezone
        );

        const rescheduledRule = new RRule({
            freq: RRule.DAILY,
            count: 1,
            dtstart: timeZoneStartDateTime
        }).toString();
        const totalMin = timeToMinutes(endTime) - timeToMinutes(startTime);
        const hours = Math.floor(totalMin / 60);
        const minutes = totalMin % 60;
        const duration = `${hours}h${minutes}m0s`;
        const rescheduledEvent = {
            event_id: programClassEvent?.id,
            class_id: programClassEvent?.class_id,
            override_rrule: rescheduledRule,
            duration: duration,
            room: data.room as string,
            is_cancelled: false
        };
        const response = await API.put(`events/${programClassEvent.id}`, [
            cancelledEvent,
            rescheduledEvent
        ]);

        checkResponse(
            response.success,
            'Failed to update event',
            'Successfully updated event'
        );
    };

    function clearForm() {
        resetErrors();
        setEndTime('');
        setStartTime('');
    }

    useEffect(() => {
        clearForm();
    }, [calendarEvent]);

    const StartTimeEndTimeInputs = () => {
        return (
            <>
                {timeErrors.startDateTime && (
                    <div className="text-error text-sm">
                        {timeErrors.startDateTime}
                    </div>
                )}
                <label className="label label-text">Start Time</label>
                <input
                    type="time"
                    value={startTime}
                    onChange={(e) => {
                        setStartTime(e.target.value);
                        resetErrors();
                    }}
                    className="input input-bordered w-full"
                />
                {timeErrors.startTime && (
                    <div className="text-error text-sm">
                        {timeErrors.startTime}
                    </div>
                )}

                <label className="label label-text">End Time</label>
                <input
                    type="time"
                    value={endTime}
                    onChange={(e) => {
                        setEndTime(e.target.value);
                        resetErrors();
                    }}
                    className="input input-bordered w-full"
                />
                {timeErrors.endTime && (
                    <div className="text-error text-sm">
                        {timeErrors.endTime}
                    </div>
                )}
            </>
        );
    };

    const validateTimes = (data?: FieldValues): boolean => {
        let isValid = true;
        const errors = { startTime: '', endTime: '', startDateTime: '' };
        setTimeErrors(errors);
        if (!startTime) {
            errors.startTime = 'Start time is required';
            isValid = false;
        }
        if (!endTime) {
            errors.endTime = 'End time is required';
            isValid = false;
        }

        if (startTime && endTime) {
            const startTotalMin = timeToMinutes(startTime);
            const endTotalMin = timeToMinutes(endTime);
            if (endTotalMin <= startTotalMin) {
                errors.endTime = 'End time must be after start time';
                isValid = false;
            }
        }

        const classEvent = calendarEvent?.classEvent;
        if (isValid && classEvent && data?.date) {
            const cleanBaseRule = classEvent.recurrence_rule.replace(
                /DTSTART;TZID=Local:/,
                'DTSTART:'
            );
            const baseRRule = RRule.fromString(cleanBaseRule);
            const baseStart = baseRRule.options.dtstart;
            const baseStartDateTime: Date = toZonedTime(
                baseStart,
                user.timezone
            );
            const newTimeZoneStartDateTime = fromZonedTime(
                `${data?.date}T${startTime}`,
                user.timezone
            );
            if (newTimeZoneStartDateTime < baseStartDateTime) {
                errors.startDateTime =
                    'Date and Start Time must be after the original Class Date and Start Time';
                isValid = false;
            }
        }

        return isValid;
    };

    function timeToMinutes(timeStr: string): number {
        const [hour, minute] = timeStr.split(':').map(Number);
        return hour * 60 + minute;
    }

    function resetErrors() {
        const errors = {
            startTime: '',
            endTime: '',
            startDateTime: ''
        };
        setTimeErrors(errors);
    }

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
            allowPastDate: false,
            label: 'Date',
            interfaceRef: 'date',
            required: true
        },
        {
            type: FormInputTypes.Unique,
            label: '',
            interfaceRef: '',
            required: true,
            uniqueComponent: <StartTimeEndTimeInputs />
        },
        {
            type: FormInputTypes.Text,
            label: 'Room',
            interfaceRef: 'room',
            required: true
        }
    ];

    return (
        <>
            <FormModal
                submitText="Save Changes"
                ref={ref}
                title={'Edit Event'}
                inputs={rescheduleClassEventInputs}
                showCancel={true}
                onSubmit={(data) => {
                    setDataToSubmit(data);
                    showModal(rescheduleConfirmationRef);
                    closeModal(ref);
                }}
                extValidationIsValid={validateTimes}
            />
            <TextOnlyModal
                ref={rescheduleConfirmationRef}
                type={TextModalType.Confirm}
                title="Confirm Reschedule"
                text={
                    <div>
                        <p>Are you sure you want to reschedule this event?</p>
                    </div>
                }
                onSubmit={() => {
                    if (dataToSubmit) {
                        void rescheduleClassEvent(dataToSubmit);
                        setDataToSubmit(null);
                        closeModal(rescheduleConfirmationRef);
                        clearForm();
                    }
                }}
                onClose={() => {
                    setDataToSubmit(null);
                    closeModal(rescheduleConfirmationRef);
                    clearForm();
                }}
            ></TextOnlyModal>
        </>
    );
});
