import { forwardRef } from 'react';
import { closeModal, TextModalType, TextOnlyModal } from '.';
import { FacilityProgramClassEvent, ServerResponseMany } from '@/common';
import API from '@/api/api';
import { KeyedMutator } from 'swr';
import { useCheckResponse } from '@/Hooks/useCheckResponse';
// import { fromZonedTime } from 'date-fns-tz';
import { useAuth } from '@/useAuth';
import {
    fromLocalDateToNumericDateFormat,
    fromLocalDateToTime
} from '../helperFunctions';
import { toZonedTime } from 'date-fns-tz';

export const RestoreClassEventModal = forwardRef(function (
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

    function buildRestoreEventMessage(): string {
        let scheduledDate = '';
        let startTime = '';
        let endTime = '';
        let frequency = '';
        let recurrencePhrase = '';
        const timezone = user ? user.timezone : '';
        if (calendarEvent) {
            const isLinkedEvent = calendarEvent.linked_override_event
                ? true
                : false;
            scheduledDate = isLinkedEvent
                ? fromLocalDateToNumericDateFormat(
                      toZonedTime(
                          calendarEvent.linked_override_event.start,
                          timezone
                      ),
                      timezone
                  )
                : fromLocalDateToNumericDateFormat(
                      calendarEvent.start,
                      timezone
                  );
            frequency = calendarEvent.frequency;
            startTime = fromLocalDateToTime(
                isLinkedEvent
                    ? toZonedTime(
                          calendarEvent.linked_override_event.start,
                          timezone
                      )
                    : calendarEvent.start
            );
            endTime = fromLocalDateToTime(
                isLinkedEvent
                    ? toZonedTime(
                          calendarEvent.linked_override_event.end,
                          timezone
                      )
                    : calendarEvent.end
            );
            const rulePartMap = parseRRule(calendarEvent.recurrence_rule);
            recurrencePhrase = buildRecurrencePhrase(rulePartMap);
        }
        const message = `This event was originally scheduled for ${scheduledDate} as part of a ${frequency} series that meets every ${recurrencePhrase} at ${startTime} - ${endTime}`;
        return message;
    }

    function parseRRule(rRule: string) {
        const ruleSplit = rRule.split('\n');
        const rRuleOnly =
            ruleSplit.length > 1
                ? rRule.split('\n')[1].replace('RRULE:', '')
                : '';
        const rruleParts: Record<string, string> = {};
        rRuleOnly.split(';').forEach((part) => {
            const [key, value] = part.split('=');
            rruleParts[key] = value;
        });
        return rruleParts;
    }

    function getDayNames(bydayStr: string): string[] {
        if (!bydayStr) return [];
        const dayMap: Record<string, string> = {
            MO: 'Monday',
            TU: 'Tuesday',
            WE: 'Wednesday',
            TH: 'Thursday',
            FR: 'Friday',
            SA: 'Saturday',
            SU: 'Sunday'
        };
        return bydayStr.split(',').map((d) => dayMap[d]);
    }

    function buildRecurrencePhrase(rrule: Record<string, string>) {
        const freq = rrule.FREQ;
        const interval = Number(rrule.INTERVAL || '1');
        const byday = getDayNames(rrule.BYDAY);
        const freqMap: Record<string, string> = {
            DAILY: 'day',
            WEEKLY: 'week',
            MONTHLY: 'month',
            YEARLY: 'year'
        };

        const byUnit = freqMap[freq] || 'period';
        let rRulePhrase = '';
        if (interval === 1) {
            rRulePhrase = `every ${byUnit}`;
        } else if (interval === 2) {
            rRulePhrase = `every other ${byUnit}`;
        } else {
            rRulePhrase = `every ${interval} ${interval === 1 ? byUnit : byUnit + 's'}`;
        }

        if ((freq === 'WEEKLY' || freq === 'MONTHLY') && byday.length) {
            rRulePhrase +=
                ' on ' +
                (byday.length > 1
                    ? byday.join(', ').replace(/, ([^,]*)$/, ' and $1')
                    : byday[0]);
        }
        return rRulePhrase;
    }

    async function onConfirm() {
        if (!calendarEvent) return;
        const response = await API.delete(
            `program-classes/${calendarEvent.class_id}/events/${calendarEvent.override_id}`
        );
        checkResponse(
            response.success,
            'Failed to restore event',
            'Successfully restored event'
        );
        if (response.success && handleCallback) {
            handleCallback();
        }
    }

    return (
        <TextOnlyModal
            ref={ref}
            type={TextModalType.Confirm}
            title={'Restore Event'}
            text={
                <div>
                    <p className="mb-4">
                        {calendarEvent?.is_cancelled ||
                        calendarEvent?.is_override
                            ? buildRestoreEventMessage()
                            : ''}
                    </p>
                    <p>
                        Restoring will move this event back to its original time
                        on the schedule.
                    </p>
                </div>
            }
            onSubmit={() => void onConfirm()}
            onClose={() => closeModal(ref)}
        />
    );
});
