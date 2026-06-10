import { Link } from 'react-router-dom';
import { format, isToday, isTomorrow } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { ArrowRight, CalendarDays } from 'lucide-react';
import { FacilityProgramClassEvent } from '@/types';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

const UPCOMING_HORIZON_DAYS = 56;

function formatCompactTimeRange(start: Date, end: Date): string {
    const startFull = start.toLocaleTimeString(undefined, {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });
    const endFull = end.toLocaleTimeString(undefined, {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });

    const startPeriod = startFull.match(/\s(AM|PM)$/i)?.[1];
    const endPeriod = endFull.match(/\s(AM|PM)$/i)?.[1];
    const startTime = startFull.replace(/\s(AM|PM)$/i, '');
    const endTime = endFull.replace(/\s(AM|PM)$/i, '');

    if (startPeriod && startPeriod === endPeriod) {
        return `${startTime}–${endTime} ${endPeriod}`;
    }

    return `${startFull}–${endFull}`;
}

function formatSessionDay(zoned: Date): string {
    if (isToday(zoned)) return 'Today';
    if (isTomorrow(zoned)) return 'Tomorrow';
    return format(zoned, 'EEEE, MMMM d');
}

function formatSessionAtAGlance(
    start: Date,
    end: Date,
    room?: string | null
): string {
    const parts = [
        formatSessionDay(start),
        formatCompactTimeRange(start, end),
        room?.trim() || null
    ].filter(Boolean);

    return parts.join(' · ');
}

export function findNextUpcomingSession(
    events: FacilityProgramClassEvent[],
    timezone: string
): FacilityProgramClassEvent | null {
    const now = new Date();
    const horizon = new Date(now);
    horizon.setDate(horizon.getDate() + UPCOMING_HORIZON_DAYS);

    const upcoming = events
        .filter((event) => {
            if (event.is_cancelled) return false;
            const start = new Date(event.start);
            const end = new Date(event.end);
            if (end < now) return false;
            if (start > horizon) return false;
            return true;
        })
        .sort(
            (a, b) =>
                new Date(a.start).getTime() - new Date(b.start).getTime()
        );

    return upcoming[0] ?? null;
}

export interface UpcomingClassSessionCardProps {
    events: FacilityProgramClassEvent[];
    timezone: string;
    isLoading: boolean;
}

export default function UpcomingClassSessionCard({
    events,
    timezone,
    isLoading
}: UpcomingClassSessionCardProps) {
    const nextSession = findNextUpcomingSession(events, timezone);

    if (isLoading) {
        return (
            <Skeleton className="h-8 w-56 max-w-full shrink-0 rounded-full sm:w-72" />
        );
    }

    if (!nextSession) {
        return null;
    }

    const start = toZonedTime(new Date(nextSession.start), timezone);
    const end = toZonedTime(new Date(nextSession.end), timezone);
    const now = new Date();
    const inProgress =
        now >= new Date(nextSession.start) && now <= new Date(nextSession.end);
    const atAGlance = formatSessionAtAGlance(start, end, nextSession.room);

    return (
        <Link
            to="/resident-programs"
            className={cn(
                'inline-flex max-w-full shrink-0 items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1.5',
                'text-sm shadow-sm transition-colors',
                'hover:border-[#556830]/40 hover:bg-[#556830]/5',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
            )}
            aria-label={`${nextSession.title}, ${atAGlance}. View schedule`}
        >
            <CalendarDays
                className="size-4 shrink-0 text-[#556830] dark:text-primary"
                aria-hidden
            />
            <span className="min-w-0 truncate">
                <span className="font-medium text-foreground">
                    {nextSession.title}
                </span>
                <span className="text-muted-foreground"> · {atAGlance}</span>
            </span>
            {inProgress ? (
                <span className="shrink-0 rounded-full bg-[#556830]/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[#556830]">
                    Now
                </span>
            ) : null}
            <ArrowRight
                className="size-3.5 shrink-0 text-[#556830] dark:text-primary"
                aria-hidden
            />
        </Link>
    );
}
