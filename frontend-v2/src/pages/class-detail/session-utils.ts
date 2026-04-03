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
    isCancelledReschedule: boolean;
    rescheduledDate?: string;
    rescheduledClassTime?: string;
    rescheduleOverrideId?: number;
    cancellationReason?: string;
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

const CANCELLATION_REASON_LABELS: Record<string, string> = {
    instructor_unavailable: 'Instructor Unavailable',
    instructor_illness: 'Instructor Illness',
    facility_issue_or_lockdown: 'Facility Issue or Lockdown',
    holiday_or_scheduled_break: 'Holiday or Scheduled Break',
    technology_issue: 'Technology Issue'
};

function formatCancellationReason(reason: string): string {
    return CANCELLATION_REASON_LABELS[reason] ?? reason;
}

export function buildCancellationReasonMap(
    events: ProgramClassEvent[]
): Map<string, string> {
    const map = new Map<string, string>();
    for (const event of events) {
        for (const override of event.overrides ?? []) {
            if (
                override.is_cancelled &&
                override.reason &&
                override.reason !== 'rescheduled' &&
                override.reason !== 'applied_future'
            ) {
                const date = parseOverrideDate(override.override_rrule);
                if (date) map.set(date, formatCancellationReason(override.reason));
            }
        }
    }
    return map;
}

export function buildRoomOverrideMap(
    events: ProgramClassEvent[]
): Map<string, string> {
    const map = new Map<string, string>();
    for (const event of events) {
        for (const override of event.overrides ?? []) {
            if (!override.is_cancelled && override.room_id && override.room_ref) {
                const date = parseOverrideDate(override.override_rrule);
                const time = parseOverrideStartTime(override.override_rrule);
                if (date) {
                    const key = time ? `${date}|${time}` : date;
                    map.set(key, override.room_ref.name);
                }
            }
        }
    }
    return map;
}

export function buildRescheduleMaps(events: ProgramClassEvent[]): {
    fromTo: Map<string, RescheduleLink>;
    toFrom: Map<string, RescheduleLink>;
    appliedFutureDates: Set<string>;
    intermediateDates: Set<string>;
} {
    const fromTo = new Map<string, RescheduleLink>();
    const toFrom = new Map<string, RescheduleLink>();
    const appliedFutureDates = new Set<string>();
    const intermediateDates = new Set<string>();

    for (const event of events) {
        // Index overrides by ID for chain traversal
        const cancelledOverrides = new Map<
            number,
            { date: string; override: ProgramClassEventOverride }
        >();
        const targetOverrides = new Map<
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
                continue;
            }
            // Cancelled with reason="rescheduled" — this is a cancel source
            if (override.is_cancelled && override.reason === 'rescheduled') {
                cancelledOverrides.set(override.id, { date, override });
            }
            // Any override with a linked ID is a target (can be BOTH a cancel
            // source AND a target — e.g., B in A→B→C is cancelled+rescheduled
            // and linked to A's cancel)
            if (override.linked_override_event_id) {
                targetOverrides.set(
                    override.linked_override_event_id,
                    { date, override }
                );
            }
        }

        // Build pairs, following chains to find ORIGINAL → FINAL like the prototype.
        // For A→B→C: A's cancel(id=X) → B's cancel(id=Y, linked=X) → C's target(linked=Y)
        // We want fromTo = {A→C}, not {A→B, B→C}
        for (const [cancelledId, cancelled] of cancelledOverrides) {
            // Check if this cancel is itself linked FROM another cancel (it's an intermediate)
            if (cancelled.override.linked_override_event_id) continue;

            // This cancel has no parent link — it's a chain root (the ORIGINAL date)
            // Follow the chain: find the target linked to this cancel
            let currentCancelId = cancelledId;
            const visited = new Set<number>([currentCancelId]);

            // Follow through intermediate cancels
            while (true) {
                const target = targetOverrides.get(currentCancelId);
                if (!target) break;

                if (!target.override.is_cancelled) {
                    // Final non-cancelled target (normal reschedule or end of chain)
                    const startTime = parseOverrideStartTime(
                        target.override.override_rrule
                    );
                    fromTo.set(cancelled.date, {
                        date: target.date,
                        overrideId: target.override.id,
                        eventId: event.id
                    });
                    toFrom.set(target.date, {
                        date: cancelled.date,
                        overrideId: target.override.id,
                        eventId: event.id,
                        startTime
                    });
                    break;
                } else if (target.override.reason === 'rescheduled') {
                    // Intermediate in re-reschedule chain (B in A→B→C)
                    // B was re-rescheduled, so it's not the final destination
                    intermediateDates.add(target.date);
                    if (visited.has(target.override.id)) break;
                    visited.add(target.override.id);
                    currentCancelId = target.override.id;
                } else {
                    // Cancelled reschedule target (Scenario 1: A→B, B cancelled by user)
                    // B IS the final destination — it just happens to be cancelled too
                    const startTime = parseOverrideStartTime(
                        target.override.override_rrule
                    );
                    fromTo.set(cancelled.date, {
                        date: target.date,
                        overrideId: target.override.id,
                        eventId: event.id
                    });
                    toFrom.set(target.date, {
                        date: cancelled.date,
                        overrideId: target.override.id,
                        eventId: event.id,
                        startTime
                    });
                    break;
                }
            }
        }
    }

    return { fromTo, toFrom, appliedFutureDates, intermediateDates };
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
    appliedFutureDates: Set<string>,
    intermediateDates: Set<string>,
    cancellationReasons?: Map<string, string>
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
                !fromTo.has(inst.date) &&
                !toFrom.has(inst.date)
            ) {
                return false;
            }
            return true;
        })
        .map((inst) => {
            const dateOnly = parseLocalDate(inst.date);
            const isToday = dateOnly.getTime() === today.getTime();
            const isPast = dateOnly < today;
            const isUpcoming = dateOnly > today;
            // Include start time from class_time (e.g., "10:00-11:00") for
            // correct sort order when multiple sessions fall on the same date
            const startTimeParts = inst.class_time?.split('-')[0]?.split(':');
            const dateObj = startTimeParts?.length === 2
                ? new Date(dateOnly.getFullYear(), dateOnly.getMonth(), dateOnly.getDate(),
                    Number(startTimeParts[0]), Number(startTimeParts[1]))
                : dateOnly;

            const attendedCount =
                inst.attendance_records?.filter(
                    (r) =>
                        r.attendance_status === Attendance.Present ||
                        r.attendance_status === Attendance.Partial
                ).length ?? 0;

            const hasAttendance = (inst.attendance_records?.length ?? 0) > 0;

            const rescheduleFrom = fromTo.get(inst.date);
            const rescheduleTo = toFrom.get(inst.date);
            let isRescheduledFrom =
                rescheduleFrom != null && inst.is_cancelled;
            const isRescheduledTo =
                rescheduleTo != null &&
                (!rescheduleTo.startTime ||
                    inst.class_time.startsWith(rescheduleTo.startTime));
            // Same-date time-only reschedule: the backend dedup replaces the cancelled
            // instance with the non-cancelled one, so only the "to" instance exists.
            // Mark it as BOTH isRescheduledFrom and isRescheduledTo (matching prototype).
            const isSameDateReschedule =
                isRescheduledTo &&
                !isRescheduledFrom &&
                rescheduleTo != null &&
                rescheduleTo.date === inst.date;
            if (isSameDateReschedule && rescheduleFrom) {
                isRescheduledFrom = true;
            }
            // Dual state: session is both a reschedule target AND cancelled (Scenario 1)
            const isCancelledReschedule =
                isRescheduledTo && inst.is_cancelled && !isRescheduledFrom;

            return {
                instance: inst,
                dateObj,
                dayName: WEEKDAY_LONG[dateObj.getDay()] ?? '',
                isToday,
                isPast,
                isUpcoming,
                hasAttendance,
                isCancelled: inst.is_cancelled && !isRescheduledFrom && !isCancelledReschedule,
                isRescheduledFrom,
                isRescheduledTo: isRescheduledTo && !isCancelledReschedule,
                isCancelledReschedule,
                rescheduledDate: isRescheduledFrom && rescheduleFrom
                    ? rescheduleFrom.date
                    : (isRescheduledTo || isCancelledReschedule) && rescheduleTo
                      ? rescheduleTo.date
                      : undefined,
                rescheduleOverrideId: isRescheduledFrom && rescheduleFrom
                    ? rescheduleFrom.overrideId
                    : (isRescheduledTo || isCancelledReschedule) && rescheduleTo
                      ? rescheduleTo.overrideId
                      : undefined,
                cancellationReason:
                    inst.is_cancelled && !isRescheduledFrom
                        ? cancellationReasons?.get(inst.date)
                        : undefined,
                attendedCount,
                totalEnrolled: enrolled
            };
        })
        .sort((a, b) => b.dateObj.getTime() - a.dateObj.getTime());

    // Filter out intermediate dates (B in A→B→C chains) identified by buildRescheduleMaps
    let filtered = sessions.filter(
        (s) => !intermediateDates.has(s.instance.date)
    );

    // Set rescheduledClassTime and handle same-date reschedules.
    // For same-date time-only reschedules, the prototype shows ONE row with both
    // "Rescheduled" and "Rescheduled Class" badges and "Moved to [date] at [time]".
    const sameDateTargets = new Set<SessionDisplay>();
    for (const s of filtered) {
        if (s.isRescheduledFrom && s.rescheduledDate) {
            // Same-date time reschedule: single instance is both "from" and "to"
            if (s.instance.date === s.rescheduledDate) {
                s.rescheduledClassTime = s.instance.class_time;
                continue;
            }
            // Different-date reschedule: find the separate target row
            const target = filtered.find(
                (t) =>
                    t.instance.date === s.rescheduledDate &&
                    t !== s &&
                    (t.isRescheduledTo || t.isCancelledReschedule)
            );
            if (target) {
                if (target.instance.class_time !== s.instance.class_time) {
                    s.rescheduledClassTime = target.instance.class_time;
                }
            }
        }
    }
    if (sameDateTargets.size > 0) {
        filtered = filtered.filter((s) => !sameDateTargets.has(s));
    }

    return filtered;
}
