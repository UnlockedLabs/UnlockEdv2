import { useState } from 'react';
import useSWR from 'swr';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ServerResponseMany } from '@/types/server';
import { cn } from '@/lib/utils';

interface CanvasScheduleEvent {
    id: number;
    title: string;
    start_at: string;
    end_at: string;
    is_cancelled: boolean;
}

interface Props {
    classId: number;
}

const DAY_HEADERS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function formatTime(isoStr: string): string {
    const d = new Date(isoStr);
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export function CanvasScheduleTab({ classId }: Props) {
    const [viewDate, setViewDate] = useState(() => new Date());
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth() + 1;

    const { data: eventsResp, isLoading } = useSWR<ServerResponseMany<CanvasScheduleEvent>>(
        `/api/program-classes/${classId}/canvas-schedule?month=${String(month).padStart(2, '0')}&year=${year}`
    );

    const eventsByDate = new Map<string, CanvasScheduleEvent[]>();
    for (const ev of eventsResp?.data ?? []) {
        const dateStr = ev.start_at.split('T')[0];
        if (!eventsByDate.has(dateStr)) eventsByDate.set(dateStr, []);
        eventsByDate.get(dateStr)!.push(ev);
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const startOfMonth = new Date(year, month - 1, 1);
    const calStart = new Date(startOfMonth);
    calStart.setDate(calStart.getDate() - calStart.getDay());

    const weeks: { date: Date; dateStr: string; isCurrentMonth: boolean }[][] = [];
    const cursor = new Date(calStart);
    for (let w = 0; w < 6; w++) {
        if (w > 4 && cursor.getMonth() !== month - 1) break;
        const week = [];
        for (let d = 0; d < 7; d++) {
            week.push({
                date: new Date(cursor),
                dateStr: cursor.toISOString().split('T')[0],
                isCurrentMonth: cursor.getMonth() === month - 1
            });
            cursor.setDate(cursor.getDate() + 1);
        }
        weeks.push(week);
    }

    const monthLabel = viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    const prevMonth = () => setViewDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1));
    const nextMonth = () => setViewDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1));

    return (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-[#203622]">Canvas Calendar Events</h3>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={prevMonth}>
                        <ChevronLeft className="size-4" />
                    </Button>
                    <span className="text-sm font-medium w-36 text-center">{monthLabel}</span>
                    <Button variant="outline" size="sm" onClick={nextMonth}>
                        <ChevronRight className="size-4" />
                    </Button>
                </div>
            </div>

            {isLoading ? (
                <div className="h-64 flex items-center justify-center text-gray-400 text-sm">
                    Loading events…
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <div className="min-w-[500px] border border-gray-200 rounded-lg overflow-hidden">
                        <div className="grid grid-cols-7 bg-gray-50">
                            {DAY_HEADERS.map(d => (
                                <div key={d} className="p-2 text-center text-sm font-medium text-gray-600 border-r border-gray-200 last:border-r-0">
                                    {d}
                                </div>
                            ))}
                        </div>
                        {weeks.map((week, wi) => (
                            <div key={wi} className="grid grid-cols-7">
                                {week.map(day => {
                                    const evs = eventsByDate.get(day.dateStr) ?? [];
                                    const isToday = day.dateStr === todayStr;
                                    return (
                                        <div
                                            key={day.dateStr}
                                            className={cn(
                                                'min-h-[80px] p-2 border-t border-r border-gray-200 last:border-r-0',
                                                !day.isCurrentMonth && 'bg-gray-50',
                                                isToday && 'bg-blue-50',
                                                day.isCurrentMonth && evs.length > 0 && !isToday && 'bg-green-50'
                                            )}
                                        >
                                            <span className={cn(
                                                'text-sm',
                                                !day.isCurrentMonth && 'text-gray-400',
                                                isToday && 'font-bold text-blue-700'
                                            )}>
                                                {day.date.getDate()}
                                            </span>
                                            {day.isCurrentMonth && evs.map(ev => (
                                                <div key={ev.id} className={cn(
                                                    'mt-1 text-xs rounded px-1.5 py-0.5',
                                                    ev.is_cancelled
                                                        ? 'bg-gray-200 text-gray-500 line-through'
                                                        : 'bg-[#556830] text-white'
                                                )}>
                                                    {formatTime(ev.start_at)}
                                                </div>
                                            ))}
                                        </div>
                                    );
                                })}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="flex gap-4 mt-3 text-sm text-gray-600">
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-green-50 border border-green-200 rounded" />
                    <span>Event Day</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-blue-50 border border-blue-200 rounded" />
                    <span>Today</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-gray-200 border border-gray-300 rounded" />
                    <span>Cancelled</span>
                </div>
            </div>
        </div>
    );
}
