import { forwardRef, useEffect, useState } from 'react';
import { FormInputTypes, FormModal, Input } from '.';
import { CancelEventReason, Class, ServerResponseOne } from '@/common';
import API from '@/api/api';
import { FieldValues, SubmitHandler } from 'react-hook-form';
import { CalendarClassEvent } from '../EventCalendar';
import { KeyedMutator } from 'swr';
import { useCheckResponse } from '@/Hooks/useCheckResponse';

export const CancelClassEventModal = forwardRef(function (
    {
        calendarEvent,
        mutate
    }: {
        calendarEvent?: CalendarClassEvent;
        mutate: KeyedMutator<ServerResponseOne<Class>>;
    },
    ref: React.ForwardedRef<HTMLDialogElement>
) {
    const checkResponse = useCheckResponse({
        mutate: mutate,
        refModal: ref
    });
    const [reason, setReason] = useState<string>('');

    const cancelClassEvent: SubmitHandler<FieldValues> = async (data) => {
        if (!calendarEvent?.classEvent) return;
        const iso =
            calendarEvent.start
                .toISOString()
                .replace(/[-:]/g, '')
                .slice(0, 15) + 'Z';

        const overrideRule = `DTSTART:${iso}\nRRULE:FREQ=DAILY;COUNT=1`;
        const programClassEvent = calendarEvent.classEvent;

        let reason = data.reason as string;
        if (reason === 'Other (add note)') {
            reason = data.note as string;
        }
        const formattedJson = {
            event_id: programClassEvent?.id,
            class_id: programClassEvent?.class_id,
            override_rrule: overrideRule,
            duration: programClassEvent?.duration,
            location: programClassEvent?.room,
            is_cancelled: true,
            reason: reason
        };
        const response = await API.put(
            `events/${programClassEvent.id}`,
            formattedJson
        );

        checkResponse(
            response.success,
            'Failed to cancel event',
            'Successfully cancelled event'
        );
    };

    useEffect(() => {
        setReason('');
    }, [calendarEvent]);

    const cancelClassEventInputs: Input[] = [
        {
            type: FormInputTypes.Unique,
            label: '',
            interfaceRef: '',
            required: true,
            uniqueComponent: (
                <>
                    <p className="mb-4">
                        You are about to cancel this event. This action will
                        remove the event from the facility's schedule.{' '}
                        <b>Only this occurrence</b> will be affected.
                    </p>
                </>
            )
        },
        {
            type: FormInputTypes.Dropdown,
            label: 'Reason for cancelling',
            interfaceRef: 'reason',
            enumType: CancelEventReason,
            required: true,
            onChangeSelection: (e) => setReason(e.target.value)
        },
        ...(reason === 'Other (add note)'
            ? [
                  {
                      type: FormInputTypes.TextArea,
                      label: 'Add Note',
                      length: 255,
                      interfaceRef: 'note',
                      required: true
                  }
              ]
            : [])
    ];

    return (
        <FormModal
            submitText="Cancel Event"
            ref={ref}
            title={'Cancel Event'}
            inputs={cancelClassEventInputs}
            showCancel={true}
            onSubmit={cancelClassEvent}
        />
    );
});
