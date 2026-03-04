import { useState, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import useSWR from 'swr';
import { ChevronLeft, ChevronRight, Eye, ClipboardList } from 'lucide-react';
import {
    Class,
    SelectedClassStatus,
    ServerResponseMany,
    ServerResponseOne
} from '@/types';
import { ClassEventInstance } from '@/types/events';
import { isCompletedCancelledOrArchived } from '@/lib/classStatus';
import { StatusBadge } from '@/components/shared';
import { Button } from '@/components/ui/button';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@/components/ui/table';

function toLocalMidnight(dateOnly: string): Date {
    const [year, month, day] = dateOnly.split('-').map(Number);
    return new Date(year!, month! - 1, day);
}

function getPreviousMonth(ym: string): string {
    const [y, m] = ym.split('-').map(Number);
    if (m === 1) return `${y! - 1}-12`;
    return `${y}-${String(m! - 1).padStart(2, '0')}`;
}

function getNextMonth(ym: string): string {
    const [y, m] = ym.split('-').map(Number);
    if (m === 12) return `${y! + 1}-01`;
    return `${y}-${String(m! + 1).padStart(2, '0')}`;
}

function formatMonthYear(ym: string): string {
    const [year, month] = ym.split('-').map(Number);
    const date = new Date(year!, month! - 1, 1);
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function formatClassTime(dateStr: string, timeRange: string): string {
    const [startTime, endTime] = timeRange.split('-');
    const startDateTime = new Date(`${dateStr}T${startTime}:00`);
    const endDateTime = new Date(`${dateStr}T${endTime}:00`);
    const options: Intl.DateTimeFormatOptions = {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    };
    return `${startDateTime.toLocaleTimeString([], options)} - ${endDateTime.toLocaleTimeString([], options)}`;
}

function getEventStatus(cls: Class | undefined, event: ClassEventInstance): string {
    const eventDate = toLocalMidnight(event.date).getTime();
    const today = new Date().setHours(0, 0, 0, 0);
    if (cls?.status === SelectedClassStatus.Cancelled || event.is_cancelled) return 'Cancelled';
    if (eventDate > today) return 'Scheduled';
    const expectedCount =
        cls?.status === SelectedClassStatus.Completed ? cls.completed : cls?.enrolled;
    if (event.attendance_records?.length === expectedCount) return 'Marked';
    return 'Unmarked';
}

function isFutureDate(date: string): boolean {
    const day = toLocalMidnight(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return day > today;
}

export default function ClassEvents() {
    const { class_id } = useParams<{ class_id: string }>();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    const defaultMonth = new Date().toISOString().substring(0, 7);
    const yearParam = searchParams.get('year');
    const monthParam = searchParams.get('month');
    const initialMonth =
        yearParam && monthParam ? `${yearParam}-${monthParam}` : defaultMonth;
    const [currentMonth, setCurrentMonth] = useState(initialMonth);

    const [year, month] = currentMonth.split('-');

    const { data, isLoading } = useSWR<ServerResponseMany<ClassEventInstance>>(
        `/api/program-classes/${class_id}/events?month=${month}&year=${year}&per_page=31`
    );
    const events = data?.data ?? [];

    const eventDates = useMemo(() => events.map((e) => e.date), [events]);
    const { data: historicalResponse } = useSWR<{ data: Record<string, number> }>(
        eventDates.length > 0
            ? `/api/program-classes/${class_id}/historical-enrollment-batch?dates=${eventDates.join(',')}`
            : null
    );
    const historicalData = historicalResponse?.data;

    const { data: classResp } = useSWR<ServerResponseOne<Class>>(
        `/api/program-classes/${class_id}`
    );
    const thisClass = classResp?.data;

    const blockEdits = isCompletedCancelledOrArchived(thisClass ?? ({} as Class));

    const hasEarlier = !thisClass?.start_dt || getPreviousMonth(currentMonth) >= thisClass.start_dt.substring(0, 7);
    const hasLater = !thisClass?.end_dt || getNextMonth(currentMonth) <= thisClass.end_dt.substring(0, 7);

    function handleAttendanceClick(eventId: number, date: string) {
        navigate(`/program-classes/${class_id}/events/${eventId}/attendance/${date}`);
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={!hasEarlier}
                        onClick={() => setCurrentMonth(getPreviousMonth(currentMonth))}
                    >
                        <ChevronLeft className="size-4" />
                    </Button>
                    <span className="text-lg font-semibold text-foreground min-w-[180px] text-center">
                        {formatMonthYear(currentMonth)}
                    </span>
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={!hasLater}
                        onClick={() => setCurrentMonth(getNextMonth(currentMonth))}
                    >
                        <ChevronRight className="size-4" />
                    </Button>
                </div>
            </div>

            {isLoading && (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
            )}

            {!isLoading && events.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                    No events found for this month.
                </div>
            )}

            {!isLoading && events.length > 0 && (
                <div className="bg-card rounded-lg border border-border">
                    <Table>
                        <TableHeader>
                            <TableRow className="hover:bg-transparent">
                                <TableHead>Date</TableHead>
                                <TableHead>Class Time</TableHead>
                                <TableHead>Present / Enrolled</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {events.map((event) => {
                                const eventStatus = getEventStatus(thisClass, event);
                                const future = isFutureDate(event.date);
                                const isViewOnly = blockEdits || event.is_cancelled;
                                const presentCount = event.attendance_records?.length ?? 0;
                                const enrolled = historicalData?.[event.date] ?? thisClass?.enrolled ?? 0;

                                return (
                                    <TableRow key={`${event.event_id}-${event.date}`}>
                                        <TableCell>
                                            {toLocalMidnight(event.date).toLocaleDateString('en-US', {
                                                month: '2-digit',
                                                day: '2-digit'
                                            })}
                                        </TableCell>
                                        <TableCell>
                                            {formatClassTime(event.date, event.class_time)}
                                        </TableCell>
                                        <TableCell>
                                            {presentCount} / {enrolled}
                                        </TableCell>
                                        <TableCell>
                                            <StatusBadge status={eventStatus} />
                                        </TableCell>
                                        <TableCell>
                                            {future ? (
                                                <span className="text-sm text-muted-foreground">
                                                    Available on{' '}
                                                    {toLocalMidnight(event.date).toLocaleDateString('en-US', {
                                                        month: 'numeric',
                                                        day: 'numeric'
                                                    })}
                                                </span>
                                            ) : (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="text-[#556830] hover:text-foreground"
                                                    onClick={() =>
                                                        handleAttendanceClick(event.event_id, event.date)
                                                    }
                                                >
                                                    {isViewOnly ? (
                                                        <>
                                                            <Eye className="size-4 mr-1" />
                                                            View
                                                        </>
                                                    ) : (
                                                        <>
                                                            <ClipboardList className="size-4 mr-1" />
                                                            Mark
                                                        </>
                                                    )}
                                                </Button>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </div>
            )}
        </div>
    );
}
