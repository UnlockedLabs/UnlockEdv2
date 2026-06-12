import useSWR from 'swr';
import { Calendar, CalendarOff, CalendarClock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ServerResponseMany } from '@/types/server';
import { cn } from '@/lib/utils';

interface CanvasEvent {
    id: number;
    title: string;
    start_at: string;
    end_at: string;
    is_cancelled: boolean;
}

interface Props {
    classId: number;
}

function formatEventTime(start: string, end: string): string {
    const fmt = (s: string) =>
        new Date(s).toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit'
        });
    return `${fmt(start)} – ${fmt(end)}`;
}

function CanvasEventRow({ ev }: { ev: CanvasEvent }) {
    const now = new Date();
    const startDate = new Date(ev.start_at);
    const isToday = startDate.toDateString() === now.toDateString();
    const isPast = startDate < now && !isToday;

    const dateLabel = startDate.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric'
    });

    const borderClass = ev.is_cancelled
        ? 'border-gray-300 bg-gray-100'
        : isToday
          ? 'border-blue-200 bg-blue-50'
          : isPast
            ? 'border-gray-200'
            : 'border-gray-200 bg-gray-50';

    const Icon = ev.is_cancelled
        ? CalendarOff
        : isToday
          ? CalendarClock
          : Calendar;

    const iconClass = ev.is_cancelled
        ? 'text-gray-400'
        : isToday
          ? 'text-blue-600'
          : isPast
            ? 'text-gray-400'
            : 'text-[#556830]';

    return (
        <div
            className={cn(
                'flex items-center justify-between p-4 rounded-lg border',
                borderClass
            )}
        >
            <div className="flex items-center gap-4 min-w-0">
                <Icon className={cn('size-5 flex-shrink-0', iconClass)} />
                <div className="min-w-0">
                    <div className="text-sm font-medium text-[#203622]">
                        <span className={ev.is_cancelled ? 'line-through' : ''}>
                            {dateLabel}
                        </span>
                        {isToday && (
                            <Badge className="ml-2 bg-blue-500 text-white">
                                Today
                            </Badge>
                        )}
                        {ev.is_cancelled && (
                            <Badge
                                variant="outline"
                                className="ml-2 bg-gray-100 text-gray-600 border-gray-300"
                            >
                                Cancelled
                            </Badge>
                        )}
                    </div>
                    <div
                        className={cn(
                            'text-xs mt-0.5',
                            ev.is_cancelled
                                ? 'text-gray-400 line-through'
                                : 'text-gray-600'
                        )}
                    >
                        {formatEventTime(ev.start_at, ev.end_at)}
                    </div>
                </div>
            </div>
        </div>
    );
}

export function CanvasSessionsTab({ classId }: Props) {
    const today = new Date();
    const startDate = new Date(today);
    startDate.setFullYear(startDate.getFullYear() - 1);
    const endDate = new Date(today);
    endDate.setFullYear(endDate.getFullYear() + 1);

    const fmt = (d: Date) => d.toISOString().split('T')[0];
    const url = `/api/program-classes/${classId}/canvas-schedule?start_date=${fmt(startDate)}&end_date=${fmt(endDate)}&per_page=500`;

    const { data, isLoading } = useSWR<ServerResponseMany<CanvasEvent>>(url);
    const events = data?.data ?? [];

    const now = new Date();
    const past = events
        .filter((e) => new Date(e.start_at) < now)
        .sort((a, b) => new Date(b.start_at).getTime() - new Date(a.start_at).getTime());
    const upcoming = events
        .filter((e) => new Date(e.start_at) >= now)
        .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());

    if (isLoading) {
        return (
            <div className="bg-white rounded-lg border border-gray-200 p-12 text-center text-gray-400 text-sm">
                Loading sessions…
            </div>
        );
    }

    if (events.length === 0) {
        return (
            <div className="bg-white rounded-lg border border-gray-200 p-12 text-center text-gray-500">
                No Canvas events found for this class.
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {upcoming.length > 0 && (
                <div>
                    <h3 className="text-sm font-medium text-gray-700 mb-3">
                        Upcoming ({upcoming.length})
                    </h3>
                    <div className="space-y-2">
                        {upcoming.map((ev) => (
                            <CanvasEventRow key={ev.id} ev={ev} />
                        ))}
                    </div>
                </div>
            )}
            {past.length > 0 && (
                <div>
                    <h3 className="text-sm font-medium text-gray-700 mb-3">
                        Past ({past.length})
                    </h3>
                    <div className="space-y-2">
                        {past.map((ev) => (
                            <CanvasEventRow key={ev.id} ev={ev} />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
