import { useMemo } from 'react';
import type { SessionDisplay } from './session-utils';

export type StatusFilter = 'all' | 'completed' | 'missing' | 'upcoming' | 'cancelled';
export type TimeFilter = 'week' | '2weeks' | 'month' | 'all';

export const PAST_DISPLAY_LIMIT = 15;
export const UPCOMING_DISPLAY_LIMIT = 10;

const TIME_FILTER_DAYS: Record<Exclude<TimeFilter, 'all'>, number> = {
    week: 7,
    '2weeks': 14,
    month: 28
};

function getTimeCutoff(tf: TimeFilter): Date | null {
    if (tf === 'all') return null;
    const cutoff = new Date();
    cutoff.setHours(0, 0, 0, 0);
    cutoff.setDate(cutoff.getDate() - TIME_FILTER_DAYS[tf]);
    return cutoff;
}

interface UseSessionFiltersArgs {
    allSessions: SessionDisplay[];
    statusFilter: StatusFilter;
    timeFilter: TimeFilter;
    showAllPast: boolean;
}

interface UseSessionFiltersResult {
    filtered: SessionDisplay[];
    pastAndTodaySessions: SessionDisplay[];
    upcomingSessions: SessionDisplay[];
    displayedPast: SessionDisplay[];
    displayedUpcoming: SessionDisplay[];
}

export function useSessionFilters({
    allSessions,
    statusFilter,
    timeFilter,
    showAllPast
}: UseSessionFiltersArgs): UseSessionFiltersResult {
    const filtered = useMemo(() => {
        let result = allSessions;
        const cutoff = getTimeCutoff(timeFilter);

        const today = new Date();
        today.setHours(23, 59, 59, 999);

        if (statusFilter === 'all') {
            if (cutoff) {
                result = result.filter(
                    (s) => s.dateObj >= cutoff && s.dateObj <= today
                );
            }
        } else if (statusFilter === 'completed') {
            result = result.filter(
                (s) =>
                    (s.isPast || s.isToday) &&
                    s.hasAttendance &&
                    !s.isCancelled &&
                    !s.isRescheduledFrom
            );
            if (cutoff) {
                result = result.filter((s) => s.dateObj >= cutoff);
            }
        } else if (statusFilter === 'missing') {
            result = result.filter(
                (s) =>
                    s.isPast &&
                    !s.hasAttendance &&
                    !s.isCancelled &&
                    !s.isRescheduledFrom
            );
            if (cutoff) {
                result = result.filter((s) => s.dateObj >= cutoff);
            }
        } else if (statusFilter === 'upcoming') {
            result = result.filter(
                (s) => s.isUpcoming && !s.isCancelled && !s.isRescheduledFrom
            );
            result = [...result].reverse();
        } else if (statusFilter === 'cancelled') {
            result = result.filter(
                (s) => s.isCancelled && !s.isRescheduledFrom
            );
            if (cutoff) {
                result = result.filter((s) => s.dateObj >= cutoff);
            }
        }

        return result;
    }, [allSessions, statusFilter, timeFilter]);

    const pastAndTodaySessions = useMemo(
        () => filtered.filter((s) => s.isPast || s.isToday),
        [filtered]
    );

    const upcomingSessions = useMemo(
        () =>
            filtered
                .filter((s) => s.isUpcoming)
                .sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime()),
        [filtered]
    );

    const displayedPast = showAllPast
        ? pastAndTodaySessions
        : pastAndTodaySessions.slice(0, PAST_DISPLAY_LIMIT);

    const displayedUpcoming = upcomingSessions.slice(0, UPCOMING_DISPLAY_LIMIT);

    return {
        filtered,
        pastAndTodaySessions,
        upcomingSessions,
        displayedPast,
        displayedUpcoming
    };
}
