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
import { FacilityProgramClassEvent, ServerResponseMany } from '@/common';
import API from '@/api/api';
import {
    FieldValues,
    SubmitHandler,
    UseFormGetValues,
    UseFormRegister
} from 'react-hook-form';
import { KeyedMutator } from 'swr';
import { useCheckResponse } from '@/Hooks/useCheckResponse';
import { useAuth } from '@/useAuth';
import { RRule } from 'rrule';
import { fromZonedTime, toZonedTime } from 'date-fns-tz';
import { RRuleControl, RRuleFormHandle } from '../inputs/RRuleControl';
import { addDays } from 'date-fns';
import { parseRRuleUntiDate } from '../helperFunctions';

export const RescheduleClassEventSeriesModal = forwardRef(function (
    {
        calendarEvent,
        mutate
    }: {
        calendarEvent?: FacilityProgramClassEvent;
        mutate: KeyedMutator<ServerResponseMany<FacilityProgramClassEvent>>;
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
    const rruleFormRef = useRef<RRuleFormHandle>(null);
    const [formDataRef, setFormDataRef] = useState<{
        getValues: UseFormGetValues<any>; // eslint-disable-line
        register: UseFormRegister<any>; // eslint-disable-line
    }>();
    const rescheduleSeriesConfirmationRef = useRef<HTMLDialogElement>(null);
    const [rruleObj, setRruleObj] = useState<{
        rule: string;
        duration: string;
    } | null>(null);
    const [dataToSubmit, setDataToSubmit] = useState<FieldValues | null>(null);
    const rescheduleClassEventSeries: SubmitHandler<FieldValues> = async (
        data
    ) => {
        if (!calendarEvent || !rruleObj) {
            return;
        }
        const rescheduledEventSeries = {
            id: 0,
            class_id: calendarEvent.class_id,
            duration: rruleObj?.duration,
            room: data.room as string,
            recurrence_rule: rruleObj?.rule
        };

        const currentRRule = RRule.fromString(calendarEvent.recurrence_rule);
        const startDate = data.start_dt as string;
        const untilRuleDate = addDays(new Date(`${startDate}T00:00:00`), -1);
        const untilDate = fromZonedTime(untilRuleDate, user.timezone);
        const updatedOptions = {
            ...currentRRule.origOptions,
            until: untilDate
        };
        const closedOriginalRule = new RRule(updatedOptions).toString();
        const closeOriginalEventSeries = {
            id: calendarEvent.id,
            class_id: calendarEvent.class_id,
            recurrence_rule: closedOriginalRule
        };
        const response = await API.put(
            `program-classes/${calendarEvent.class_id}/events`,
            {
                event_series: rescheduledEventSeries,
                closed_event_series: closeOriginalEventSeries
            }
        );

        checkResponse(
            response.success,
            'Failed to create rescheduled event series',
            'Successfully created resecheduled event series'
        );
    };

    const rescheduleClassEventSeriesInputs: Input[] = [
        {
            type: FormInputTypes.Unique,
            label: '',
            interfaceRef: '',
            required: true,
            uniqueComponent: (
                <>
                    <p className="mb-4">
                        You are editing the recurring schedule for this class.
                        Changes will apply to this session and{' '}
                        <b>all future occurrences.</b>
                    </p>
                </>
            )
        },
        ...(formDataRef
            ? [
                  {
                      type: FormInputTypes.Unique,
                      label: '',
                      interfaceRef: '',
                      required: false,
                      uniqueComponent: (
                          <RRuleControl
                              ref={rruleFormRef}
                              getValues={formDataRef.getValues}
                              register={formDataRef.register}
                              startDateRef="start_dt"
                              endDateRef="end_dt"
                              initialDuration={calendarEvent?.duration}
                              initialRule={calendarEvent?.recurrence_rule}
                              startDateVal={
                                  calendarEvent?.start &&
                                  toZonedTime(
                                      calendarEvent?.start,
                                      user?.timezone
                                  )
                                      .toISOString()
                                      .split('T')[0]
                              }
                              endDateVal={
                                  calendarEvent &&
                                  parseRRuleUntiDate(
                                      calendarEvent.recurrence_rule,
                                      user?.timezone
                                  )
                              }
                          />
                      )
                  }
              ]
            : []),
        {
            type: FormInputTypes.Text,
            label: 'Room',
            interfaceRef: 'room',
            required: true,
            defaultValue: calendarEvent?.room
        }
    ];

    function verify(): boolean {
        let verified = false;
        if (rruleFormRef.current && formDataRef?.getValues) {
            verified = rruleFormRef.current.validate();
        }
        return verified;
    }

    function clearFormAndCloseModal() {
        setDataToSubmit(null);
        setRruleObj(null);
        closeModal(rescheduleSeriesConfirmationRef);
    }
    return (
        <>
            <FormModal
                setFormDataRef={setFormDataRef}
                submitText="Update Schedule"
                ref={ref}
                title={'Edit Schedule (Recurring)'}
                inputs={rescheduleClassEventSeriesInputs}
                showCancel={true}
                extValidationIsValid={verify}
                onSubmit={(data) => {
                    if (rruleFormRef?.current) {
                        setRruleObj(rruleFormRef.current?.createRule());
                        setDataToSubmit(data);
                        showModal(rescheduleSeriesConfirmationRef);
                        closeModal(ref);
                    }
                }}
            />
            <TextOnlyModal
                ref={rescheduleSeriesConfirmationRef}
                type={TextModalType.Confirm}
                title="Confirm Reschedule"
                text={
                    <div>
                        <p>Are you sure you want to reschedule this event?</p>
                    </div>
                }
                onSubmit={() => {
                    if (dataToSubmit) {
                        void rescheduleClassEventSeries(dataToSubmit);
                        clearFormAndCloseModal();
                        rruleFormRef?.current?.resetForm();
                    }
                }}
                onClose={() => {
                    clearFormAndCloseModal();
                }}
            ></TextOnlyModal>
        </>
    );
});
