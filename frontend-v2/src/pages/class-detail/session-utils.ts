import { ClassEventInstance, ProgramClassEvent, ProgramClassEventOverride } from '@/types/events';
import { Attendance } from '@/types/attendance';

export interface SessionDisplay {
    instance: ClassEventInstance;
    dateObj: Date;
    dayName: string;
    isToday: boolean;
    isPast: boolean;
    isUpcoming: boolean;
    hasAttendance: boolean;
    isCancelled: boolean;
    isRescheduledFrom: boolean;
    isRescheduledTo: boolean;
    rescheduledDate?: string;
    rescheduledClassTime?: string;
    rescheduleOverrideId?: number;
    attendedCount: number;
    totalEnrolled: number;
}

interface RescheduleLink {
    date: string;
    overrideId: number;
    eventId: number;
    startTime?: string;
}

function parseLocalDate(dateStr: string): Date {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d);
}

function parseOverrideDate(rrule: string): string | null {
    const match = /DTSTART[^:]*:(\d{4})(\d{2})(\d{2})/.exec(rrule);
    if (!match) return null;
    return `${match[1]}-${match[2]}-${match[3]}`;
}

function parseOverrideStartTime(rrule: string): string | undefined {
    const match = /DTSTART[^:]*:\d{8}T(\d{2})(\d{2})/.exec(rrule);
    if (!match) return undefined;
    return `${match[1]}:${match[2]}`;
}

const WEEKDAY_LONG: Record<number, string> = {
    0: 'Sunday',
    1: 'Monday',
    2: 'Tuesday',
    3: 'Wednesday',
    4: 'Thursday',
    5: 'Friday',
    6: 'Saturday'
};

export function buildRoomOverrideMap(
    events: ProgramClassEvent[]
): Map<string, string> {
    const map = new Map<string, string>();
    for (const event of events) {
        for (const override of event.overrides ?? []) {
            if (!override.is_cancelled && override.room_id && override.room_ref) {
                const date = parseOverrideDate(override.override_rrule);
                if (date) map.set(date, override.room_ref.name);
            }
        }
    }
    return map;
}

export function buildRescheduleMaps(events: ProgramClassEvent[]): {
    fromTo: Map<string, RescheduleLink>;
    toFrom: Map<string, RescheduleLink>;
    appliedFutureDates: Set<string>;
} {
    const fromTo = new Map<string, RescheduleLink>();
    const toFrom = new Map<string, RescheduleLink>();
    const appliedFutureDates = new Set<string>();

    for (const event of events) {
        const cancelledOverrides = new Map<
            number,
            { date: string; override: ProgramClassEventOverride }
        >();
        const rescheduledOverrides = new Map<
            number,
            { date: string; override: ProgramClassEventOverride }
        >();

        for (const override of event.overrides ?? []) {
            const date = parseOverrideDate(override.override_rrule);
            if (!date) continue;

            if (
                override.is_cancelled &&
                override.reason === 'applied_future'
            ) {
                appliedFutureDates.add(date);
            } else if (
                override.is_cancelled &&
                override.reason === 'rescheduled'
            ) {
                cancelledOverrides.set(override.id, { date, override });
            } else if (
                !override.is_cancelled &&
                override.linked_override_event_id
            ) {
                rescheduledOverrides.set(
                    override.linked_override_event_id,
                    { date, override }
                );
            }
        }

        for (const [cancelledId, cancelled] of cancelledOverrides) {
            const rescheduled = rescheduledOverrides.get(cancelledId);
            if (rescheduled) {
                const startTime = parseOverrideStartTime(
                    rescheduled.override.override_rrule
                );
                fromTo.set(cancelled.date, {
                    date: rescheduled.date,
                    overrideId: rescheduled.override.id,
                    eventId: event.id
                });
                toFrom.set(rescheduled.date, {
                    date: cancelled.date,
                    overrideId: rescheduled.override.id,
                    eventId: event.id,
                    startTime
                });
            }
        }
    }

    return { fromTo, toFrom, appliedFutureDates };
}

export function findCancelOverrideId(
    events: ProgramClassEvent[],
    date: string
): number | undefined {
    const dateCompact = date.replace(/-/g, '');
    for (const event of events) {
        for (const override of event.overrides ?? []) {
            if (
                override.is_cancelled &&
                override.reason !== 'rescheduled' &&
                override.override_rrule.includes(dateCompact)
            ) {
                return override.id;
            }
        }
    }
    return undefined;
}

export function buildSessionDisplays(
    instances: ClassEventInstance[],
    enrolled: number,
    fromTo: Map<string, RescheduleLink>,
    toFrom: Map<string, RescheduleLink>,
    appliedFutureDates: Set<string>
): SessionDisplay[] {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const cancelledByDate = new Map<string, string[]>();
    for (const inst of instances) {
        if (inst.is_cancelled) {
            const times = cancelledByDate.get(inst.date);
            if (times) times.push(inst.class_time);
            else cancelledByDate.set(inst.date, [inst.class_time]);
        }
    }

    const activeDatesWithDifferentTime = new Set<string>();
    for (const inst of instances) {
        if (!inst.is_cancelled) {
            const cancelledTimes = cancelledByDate.get(inst.date);
            if (cancelledTimes?.some((t) => t !== inst.class_time)) {
                activeDatesWithDifferentTime.add(inst.date);
            }
        }
    }

    const sessions = instances
        .filter((inst) => {
            if (
                inst.is_cancelled &&
                appliedFutureDates.has(inst.date)
            ) {
                return false;
            }
            if (
                inst.is_cancelled &&
                activeDatesWithDifferentTime.has(inst.date) &&
                !fromTo.has(inst.date)
            ) {
                return false;
            }
            return true;
        })
        .map((inst) => {
            const dateObj = parseLocalDate(inst.date);
            const isToday = dateObj.getTime() === today.getTime();
            const isPast = dateObj < today;
            const isUpcoming = dateObj > today;

            const attendedCount =
                inst.attendance_records?.filter(
                    (r) =>
                        r.attendance_status === Attendance.Present ||
                        r.attendance_status === Attendance.Partial
                ).length ?? 0;

            const hasAttendance = (inst.attendance_records?.length ?? 0) > 0;

            const rescheduleFrom = fromTo.get(inst.date);
            const rescheduleTo = toFrom.get(inst.date);
            const isRescheduledFrom =
                rescheduleFrom != null && inst.is_cancelled;
            const isRescheduledTo =
                rescheduleTo != null &&
                !inst.is_cancelled &&
                (!rescheduleTo.startTime ||
                    inst.class_time.startsWith(rescheduleTo.startTime));

            return {
                instance: inst,
                dateObj,
                dayName: WEEKDAY_LONG[dateObj.getDay()] ?? '',
                isToday,
                isPast,
                isUpcoming,
                hasAttendance,
                isCancelled: inst.is_cancelled && !isRescheduledFrom,
                isRescheduledFrom,
                isRescheduledTo,
                rescheduledDate: isRescheduledFrom
                    ? rescheduleFrom.date
                    : isRescheduledTo
                      ? rescheduleTo.date
                      : undefined,
                rescheduleOverrideId: isRescheduledFrom
                    ? rescheduleFrom.overrideId
                    : isRescheduledTo
                      ? rescheduleTo.overrideId
                      : undefined,
                attendedCount,
                totalEnrolled: enrolled
            };
        })
        .sort((a, b) => b.dateObj.getTime() - a.dateObj.getTime());

    const byDate = new Map(sessions.map((s) => [s.instance.date, s]));
    for (const s of sessions) {
        if (s.isRescheduledFrom && s.rescheduledDate) {
            const target = byDate.get(s.rescheduledDate);
            if (target) s.rescheduledClassTime = target.instance.class_time;
        }
    }

    return sessions;
}
