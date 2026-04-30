import { format, addDays } from 'date-fns';
import { fromZonedTime } from 'date-fns-tz';
import { RRule } from 'rrule';
import API from '@/api/api';
import { useAuth } from '@/auth/useAuth';
import { FacilityProgramClassEvent } from '@/types';

export interface FieldPatch {
    room_id?: number | null;
    instructor_id?: number | null;
    is_cancelled?: boolean;
}

export interface ChangeResult {
    success: boolean;
    status?: number;
    data?: unknown;
    message?: string;
}

export function useChangeEventField(
    event: FacilityProgramClassEvent,
    fieldPatch: FieldPatch,
    reason: string
) {
    const { user } = useAuth();

    async function submitSingleSessionChange(): Promise<ChangeResult> {
        if (!user) return { success: false };

        const dt = format(event.start, "yyyyMMdd'T'HHmmss");
        const overrideRule = `DTSTART;TZID=${user.timezone}:${dt}\nRRULE:FREQ=DAILY;COUNT=1`;

        const overrideEvent = {
            ...(event.linked_override_event && {
                linked_override_event_id: event.linked_override_event.override_id
            }),
            ...(event.is_override && { id: event.override_id }),
            event_id: event.id,
            class_id: event.class_id,
            override_rrule: overrideRule,
            duration: event.duration,
            room_id: event.room_id ?? null,
            instructor_id: event.instructor_id ?? null,
            ...fieldPatch,
            reason: reason || null,
            is_cancelled: fieldPatch.is_cancelled ?? false
        };

        const resp = await API.put(
            `program-classes/${event.class_id}/events/${event.id}`,
            [overrideEvent]
        );

        return { success: resp.success, status: resp.status, data: (resp as { data?: unknown }).data, message: resp.message };
    }

    async function submitSeriesChange(): Promise<ChangeResult> {
        if (!user) return { success: false };

        const currentRRule = RRule.fromString(event.recurrence_rule);

        const lines = event.recurrence_rule.split('\n');
        const dtStartLine = lines.find((l) => l.startsWith('DTSTART')) ?? '';
        const rruleLine = lines.find((l) => l.startsWith('RRULE:')) ?? '';
        const newDate = format(event.start, 'yyyyMMdd');
        const newDtStartLine = dtStartLine.replace(/\d{8}(?=T)/, newDate);
        const newSeriesRule = `${newDtStartLine}\n${rruleLine}`;

        const newEventSeries = {
            id: 0,
            class_id: event.class_id,
            duration: event.duration,
            room_id: event.room_id ?? null,
            instructor_id: event.instructor_id ?? null,
            ...fieldPatch,
            reason: reason || null,
            recurrence_rule: newSeriesRule
        };

        const startDate = format(event.start, 'yyyy-MM-dd');
        const untilDate = fromZonedTime(
            addDays(new Date(`${startDate}T00:00:00`), -1),
            user.timezone
        );
        const closedEventSeries = {
            id: event.id,
            class_id: event.class_id,
            recurrence_rule: new RRule({
                ...currentRRule.origOptions,
                until: untilDate
            }).toString()
        };

        const resp = await API.put(`program-classes/${event.class_id}/events`, {
            event_series: newEventSeries,
            closed_event_series: closedEventSeries
        });

        return { success: resp.success, status: resp.status, data: (resp as { data?: unknown }).data, message: resp.message };
    }

    async function submitCancelSeriesChange(): Promise<ChangeResult> {
        if (!user) return { success: false };

        const currentRRule = RRule.fromString(event.recurrence_rule);

        const lines = event.recurrence_rule.split('\n');
        const dtStartLine = lines.find((l) => l.startsWith('DTSTART')) ?? '';
        const rruleLine = lines.find((l) => l.startsWith('RRULE:')) ?? '';
        const newDate = format(event.start, 'yyyyMMdd');
        const newDtStartLine = dtStartLine.replace(/\d{8}(?=T)/, newDate);
        const newSeriesRule = `${newDtStartLine}\n${rruleLine}`;

        const newEventSeries = {
            id: 0,
            class_id: event.class_id,
            duration: event.duration,
            room_id: event.room_id ?? null,
            instructor_id: event.instructor_id ?? null,
            is_cancelled: true,
            reason: reason || null,
            recurrence_rule: newSeriesRule
        };

        const startDate = format(event.start, 'yyyy-MM-dd');
        const untilDate = fromZonedTime(
            addDays(new Date(`${startDate}T00:00:00`), -1),
            user.timezone
        );
        const closedEventSeries = {
            id: event.id,
            class_id: event.class_id,
            recurrence_rule: new RRule({
                ...currentRRule.origOptions,
                until: untilDate
            }).toString()
        };

        const resp = await API.put(`program-classes/${event.class_id}/events`, {
            event_series: newEventSeries,
            closed_event_series: closedEventSeries
        });

        return { success: resp.success, status: resp.status, data: (resp as { data?: unknown }).data, message: resp.message };
    }

    return { submitSingleSessionChange, submitSeriesChange, submitCancelSeriesChange };
}
