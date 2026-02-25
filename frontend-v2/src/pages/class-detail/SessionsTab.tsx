import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { useNavigate } from 'react-router-dom';
import {
    Calendar,
    AlertCircle,
    CheckCircle,
    Filter,
    CalendarClock,
    X,
    ChevronLeft,
    ChevronRight,
    Zap
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Class } from '@/types/program';
import { ClassEventInstance } from '@/types/events';
import { Attendance } from '@/types/attendance';
import { ServerResponseMany } from '@/types/server';
import { CancelSessionModal } from './CancelSessionModal';
import { RescheduleSessionModal } from './RescheduleSessionModal';
import { BulkSessionsModal, BulkSession } from './BulkSessionsModal';

type StatusFilter = 'all' | 'completed' | 'missing' | 'upcoming' | 'cancelled';
type TimeFilter = 'week' | '2weeks' | 'month' | 'all';

const PAGE_SIZE = 15;
const TIME_FILTER_DAYS: Record<Exclude<TimeFilter, 'all'>, number> = {
    week: 7,
    '2weeks': 14,
    month: 28
};

interface SessionsTabProps {
    cls: Class;
}

interface SessionDisplay {
    instance: ClassEventInstance;
    dateObj: Date;
    dayName: string;
    isToday: boolean;
    isPast: boolean;
    isUpcoming: boolean;
    hasAttendance: boolean;
    isCancelled: boolean;
    attendedCount: number;
    totalEnrolled: number;
}

function parseLocalDate(dateStr: string): Date {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d);
}

function buildSessionDisplays(
    instances: ClassEventInstance[],
    enrolled: number
): SessionDisplay[] {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return instances
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

            return {
                instance: inst,
                dateObj,
                dayName: dateObj.toLocaleDateString('en-US', {
                    weekday: 'long'
                }),
                isToday,
                isPast,
                isUpcoming,
                hasAttendance,
                isCancelled: inst.is_cancelled,
                attendedCount,
                totalEnrolled: enrolled
            };
        })
        .sort((a, b) => b.dateObj.getTime() - a.dateObj.getTime());
}

function getTimeCutoff(tf: TimeFilter): Date | null {
    if (tf === 'all') return null;
    const cutoff = new Date();
    cutoff.setHours(0, 0, 0, 0);
    cutoff.setDate(cutoff.getDate() - TIME_FILTER_DAYS[tf]);
    return cutoff;
}

function FilterButton({
    active,
    onClick,
    children,
    disabled
}: {
    active: boolean;
    onClick: () => void;
    children: React.ReactNode;
    disabled?: boolean;
}) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={`text-sm px-3 py-1.5 rounded-md transition-colors ${
                disabled
                    ? 'bg-gray-50 text-gray-300 cursor-not-allowed'
                    : active
                      ? 'bg-[#556830] text-white'
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
        >
            {children}
        </button>
    );
}

export function SessionsTab({ cls }: SessionsTabProps) {
    const navigate = useNavigate();
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
    const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');
    const [page, setPage] = useState(0);
    const [cancelTarget, setCancelTarget] = useState<SessionDisplay | null>(
        null
    );
    const [rescheduleTarget, setRescheduleTarget] =
        useState<SessionDisplay | null>(null);
    const [showBulkModal, setShowBulkModal] = useState(false);

    const { data: instancesResp, mutate } = useSWR<
        ServerResponseMany<ClassEventInstance>
    >(`/api/program-classes/${cls.id}/events?all=true`);

    const allSessions = useMemo(() => {
        if (!instancesResp?.data) return [];
        return buildSessionDisplays(instancesResp.data, cls.enrolled);
    }, [instancesResp, cls.enrolled]);

    const stats = useMemo(() => {
        const completed = allSessions.filter(
            (s) => (s.isPast || s.isToday) && s.hasAttendance && !s.isCancelled
        ).length;
        const missing = allSessions.filter(
            (s) => s.isPast && !s.hasAttendance && !s.isCancelled
        ).length;
        const upcoming = allSessions.filter(
            (s) => s.isUpcoming && !s.isCancelled
        ).length;
        const cancelled = allSessions.filter((s) => s.isCancelled).length;
        return { completed, missing, upcoming, cancelled };
    }, [allSessions]);

    const bulkSessions = useMemo<BulkSession[]>(() => {
        const room = cls.events?.[0]?.room_ref?.name ?? '';
        return allSessions
            .filter((s) => s.isUpcoming && !s.isCancelled)
            .map((s) => ({
                instance: s.instance,
                dateObj: s.dateObj,
                dayName: s.dayName,
                classTime: s.instance.class_time,
                room
            }));
    }, [allSessions, cls.events]);

    const hideTimeFilter = statusFilter === 'upcoming';

    const handleStatusChange = (newStatus: StatusFilter) => {
        setStatusFilter(newStatus);
        setPage(0);
        if (newStatus === 'upcoming') {
            setTimeFilter('all');
        }
    };

    const handleTimeChange = (newTime: TimeFilter) => {
        setTimeFilter(newTime);
        setPage(0);
    };

    const filtered = useMemo(() => {
        let result = allSessions;
        const cutoff = getTimeCutoff(timeFilter);

        if (statusFilter === 'all') {
            if (cutoff) {
                result = result.filter(
                    (s) => s.isUpcoming || s.dateObj >= cutoff
                );
            }
        } else if (statusFilter === 'completed') {
            result = result.filter(
                (s) => (s.isPast || s.isToday) && s.hasAttendance && !s.isCancelled
            );
            if (cutoff) {
                result = result.filter((s) => s.dateObj >= cutoff);
            }
        } else if (statusFilter === 'missing') {
            result = result.filter(
                (s) => s.isPast && !s.hasAttendance && !s.isCancelled
            );
            if (cutoff) {
                result = result.filter((s) => s.dateObj >= cutoff);
            }
        } else if (statusFilter === 'upcoming') {
            result = result.filter((s) => s.isUpcoming && !s.isCancelled);
            result = [...result].reverse();
        } else if (statusFilter === 'cancelled') {
            result = result.filter((s) => s.isCancelled);
            if (cutoff) {
                result = result.filter((s) => s.dateObj >= cutoff);
            }
        }

        return result;
    }, [allSessions, statusFilter, timeFilter]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const safePage = Math.min(page, totalPages - 1);
    const paginatedSessions = filtered.slice(
        safePage * PAGE_SIZE,
        (safePage + 1) * PAGE_SIZE
    );

    const navigateToAttendance = (session: SessionDisplay) => {
        const eventId = session.instance.event_id ?? session.instance.id;
        navigate(
            `/program-classes/${cls.id}/events/${eventId}/attendance/${session.instance.date}`
        );
    };

    const groupTitle = (() => {
        switch (statusFilter) {
            case 'completed':
                return 'Completed Sessions';
            case 'missing':
                return 'Sessions Missing Attendance';
            case 'upcoming':
                return 'Upcoming Sessions';
            case 'cancelled':
                return 'Cancelled Sessions';
            default:
                return 'All Sessions';
        }
    })();

    const timeLabel = hideTimeFilter
        ? ''
        : timeFilter === 'all'
          ? 'All Time'
          : timeFilter === 'month'
            ? 'Last 4 Weeks'
            : timeFilter === '2weeks'
              ? 'Last 2 Weeks'
              : 'Last Week';

    return (
        <div className="bg-white rounded-lg border border-gray-200">
            <div className="border-b border-gray-200 px-4 sm:px-6 py-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
                    <div>
                        <h3 className="text-[#203622] font-semibold">
                            Session Management
                        </h3>
                        <p className="text-sm text-gray-500 mt-1">
                            View and manage individual sessions
                        </p>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                        <StatButton
                            active={statusFilter === 'completed'}
                            onClick={() =>
                                handleStatusChange(
                                    statusFilter === 'completed'
                                        ? 'all'
                                        : 'completed'
                                )
                            }
                            colorClass="bg-green-100 text-[#556830]"
                        >
                            {stats.completed} Completed
                        </StatButton>
                        <StatButton
                            active={statusFilter === 'missing'}
                            onClick={() =>
                                handleStatusChange(
                                    statusFilter === 'missing'
                                        ? 'all'
                                        : 'missing'
                                )
                            }
                            colorClass="bg-amber-100 text-amber-700"
                        >
                            {stats.missing} Missing
                        </StatButton>
                        <StatButton
                            active={statusFilter === 'upcoming'}
                            onClick={() =>
                                handleStatusChange(
                                    statusFilter === 'upcoming'
                                        ? 'all'
                                        : 'upcoming'
                                )
                            }
                            colorClass="bg-blue-100 text-blue-700"
                        >
                            {stats.upcoming} Upcoming
                        </StatButton>
                        <StatButton
                            active={statusFilter === 'cancelled'}
                            onClick={() =>
                                handleStatusChange(
                                    statusFilter === 'cancelled'
                                        ? 'all'
                                        : 'cancelled'
                                )
                            }
                            colorClass="bg-gray-100 text-[#203622]"
                        >
                            {stats.cancelled} Cancelled
                        </StatButton>
                        <Button
                            variant="outline"
                            size="sm"
                            className="border-gray-300"
                            onClick={() => setShowBulkModal(true)}
                        >
                            <Zap className="size-4 mr-1.5" />
                            Bulk Actions
                        </Button>
                    </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3">
                    <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                    <Filter className="size-4 text-gray-500 hidden sm:block" />
                    <div className="flex gap-2 flex-wrap">
                        <FilterButton
                            active={statusFilter === 'all'}
                            onClick={() => handleStatusChange('all')}
                        >
                            All Sessions
                        </FilterButton>
                        <FilterButton
                            active={statusFilter === 'completed'}
                            onClick={() => handleStatusChange('completed')}
                        >
                            Completed
                        </FilterButton>
                        <FilterButton
                            active={statusFilter === 'missing'}
                            onClick={() => handleStatusChange('missing')}
                        >
                            Missing
                        </FilterButton>
                        <FilterButton
                            active={statusFilter === 'upcoming'}
                            onClick={() => handleStatusChange('upcoming')}
                        >
                            Upcoming
                        </FilterButton>
                        <FilterButton
                            active={statusFilter === 'cancelled'}
                            onClick={() => handleStatusChange('cancelled')}
                        >
                            Cancelled
                        </FilterButton>
                    </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <div className="h-6 w-px bg-gray-300 hidden sm:block" />
                        <FilterButton
                            active={timeFilter === 'week'}
                            onClick={() => handleTimeChange('week')}
                            disabled={hideTimeFilter}
                        >
                            Last Week
                        </FilterButton>
                        <FilterButton
                            active={timeFilter === '2weeks'}
                            onClick={() => handleTimeChange('2weeks')}
                            disabled={hideTimeFilter}
                        >
                            Last 2 Weeks
                        </FilterButton>
                        <FilterButton
                            active={timeFilter === 'month'}
                            onClick={() => handleTimeChange('month')}
                            disabled={hideTimeFilter}
                        >
                            Last 4 Weeks
                        </FilterButton>
                        <FilterButton
                            active={timeFilter === 'all'}
                            onClick={() => handleTimeChange('all')}
                            disabled={hideTimeFilter}
                        >
                            All Time
                        </FilterButton>
                    </div>
                </div>
            </div>

            {stats.missing > 0 && statusFilter !== 'missing' && (
                <div className="mx-4 sm:mx-6 mt-6 mb-4 bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                        <div className="flex items-start gap-3">
                            <AlertCircle className="size-5 text-[#F1B51C] flex-shrink-0 mt-0.5" />
                            <div>
                                <div className="font-medium text-[#203622]">
                                    {stats.missing}{' '}
                                    {stats.missing === 1
                                        ? 'Session'
                                        : 'Sessions'}{' '}
                                    Missing Attendance Records
                                </div>
                                <p className="text-sm text-gray-500 mt-1">
                                    Please review and complete attendance for
                                    past sessions
                                </p>
                            </div>
                        </div>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleStatusChange('missing')}
                            className="border-amber-300 text-amber-700 hover:bg-amber-100 self-start ml-8 sm:ml-0 shrink-0"
                        >
                            View Missing Sessions
                        </Button>
                    </div>
                </div>
            )}

            <div className="p-4 sm:p-6">
                {filtered.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                        <Calendar className="size-12 mx-auto mb-3 text-gray-500" />
                        <p>No sessions match your filters</p>
                        <p className="text-sm mt-1">
                            Try adjusting your filter selection
                        </p>
                    </div>
                ) : (
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h4 className="text-[#203622] font-medium">
                                    {groupTitle}
                                </h4>
                                {timeLabel && (
                                    <p className="text-sm text-gray-500 mt-0.5">
                                        {timeLabel}
                                    </p>
                                )}
                            </div>
                            <span className="text-sm text-gray-500">
                                {filtered.length}{' '}
                                {filtered.length === 1
                                    ? 'session'
                                    : 'sessions'}
                            </span>
                        </div>
                        <div className="space-y-2">
                            {paginatedSessions.map((session) => (
                                <SessionRow
                                    key={
                                        session.instance.date +
                                        '-' +
                                        session.instance.id
                                    }
                                    session={session}
                                    onClick={() =>
                                        navigateToAttendance(session)
                                    }
                                    onCancel={() => setCancelTarget(session)}
                                    onReschedule={() =>
                                        setRescheduleTarget(session)
                                    }
                                />
                            ))}
                        </div>
                        {totalPages > 1 && (
                            <div className="flex items-center justify-between pt-4 mt-4 border-t border-gray-200">
                                <p className="text-sm text-gray-500">
                                    Showing {safePage * PAGE_SIZE + 1}-
                                    {Math.min(
                                        (safePage + 1) * PAGE_SIZE,
                                        filtered.length
                                    )}{' '}
                                    of {filtered.length}
                                </p>
                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={safePage === 0}
                                        onClick={() =>
                                            setPage(safePage - 1)
                                        }
                                    >
                                        <ChevronLeft className="size-4" />
                                    </Button>
                                    <span className="flex items-center text-sm text-gray-600 px-2">
                                        {safePage + 1} / {totalPages}
                                    </span>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={
                                            safePage >= totalPages - 1
                                        }
                                        onClick={() =>
                                            setPage(safePage + 1)
                                        }
                                    >
                                        <ChevronRight className="size-4" />
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {cancelTarget && (
                <CancelSessionModal
                    open={!!cancelTarget}
                    onClose={() => setCancelTarget(null)}
                    classId={cls.id}
                    eventId={
                        cancelTarget.instance.event_id ??
                        cancelTarget.instance.id
                    }
                    date={cancelTarget.instance.date}
                    dateLabel={cancelTarget.dateObj.toLocaleDateString('en-US', {
                        weekday: 'long',
                        month: 'long',
                        day: 'numeric'
                    })}
                    onCancelled={() => void mutate()}
                />
            )}

            {rescheduleTarget && (
                <RescheduleSessionModal
                    open={!!rescheduleTarget}
                    onClose={() => setRescheduleTarget(null)}
                    classId={cls.id}
                    eventId={
                        rescheduleTarget.instance.event_id ??
                        rescheduleTarget.instance.id
                    }
                    dateLabel={rescheduleTarget.dateObj.toLocaleDateString(
                        'en-US',
                        {
                            weekday: 'long',
                            month: 'long',
                            day: 'numeric'
                        }
                    )}
                    onRescheduled={() => void mutate()}
                />
            )}

            <BulkSessionsModal
                open={showBulkModal}
                onOpenChange={setShowBulkModal}
                classId={cls.id}
                sessions={bulkSessions}
                onComplete={() => mutate()}
            />
        </div>
    );
}

function StatButton({
    active,
    onClick,
    colorClass,
    children
}: {
    active: boolean;
    onClick: () => void;
    colorClass: string;
    children: React.ReactNode;
}) {
    return (
        <button
            onClick={onClick}
            className={`text-xs px-3 py-1.5 rounded-md transition-colors ${
                active
                    ? `${colorClass} font-medium`
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
        >
            {children}
        </button>
    );
}

function SessionRow({
    session,
    onClick,
    onCancel,
    onReschedule
}: {
    session: SessionDisplay;
    onClick: () => void;
    onCancel: () => void;
    onReschedule: () => void;
}) {
    const dateLabel = session.dateObj.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric'
    });

    const borderClass = session.isCancelled
        ? 'border-gray-300 bg-gray-100 hover:bg-gray-200'
        : session.isToday
          ? 'border-blue-200 bg-blue-50 hover:bg-blue-100'
          : session.hasAttendance
            ? 'border-gray-200 hover:bg-[#E2E7EA]/30'
            : session.isPast
              ? 'border-amber-200 bg-amber-50/30 hover:bg-amber-50'
              : 'border-gray-200 bg-gray-50 hover:bg-[#E2E7EA]/30';

    return (
        <div
            onClick={onClick}
            className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 sm:p-4 rounded-lg border transition-colors cursor-pointer ${borderClass}`}
        >
            <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                {session.isCancelled ? (
                    <Calendar className="size-5 text-gray-500 flex-shrink-0" />
                ) : session.hasAttendance ? (
                    <CheckCircle className="size-5 text-[#556830] flex-shrink-0" />
                ) : session.isPast ? (
                    <AlertCircle className="size-5 text-[#F1B51C] flex-shrink-0" />
                ) : (
                    <Calendar className="size-5 text-gray-500 flex-shrink-0" />
                )}
                <div className="min-w-0">
                    <div className="text-sm font-medium text-[#203622]">
                        <span
                            className={
                                session.isCancelled ? 'line-through' : ''
                            }
                        >
                            {session.dayName}, {dateLabel}
                        </span>
                        {session.isToday && (
                            <Badge className="ml-2 bg-blue-500 text-white">
                                Today
                            </Badge>
                        )}
                        {session.isCancelled && (
                            <Badge
                                variant="outline"
                                className="ml-2 bg-gray-100 text-gray-500 border-gray-300"
                            >
                                Cancelled
                            </Badge>
                        )}
                    </div>
                    <div
                        className={`text-xs text-gray-500 mt-0.5 ${session.isCancelled ? 'line-through' : ''}`}
                    >
                        {session.instance.class_time}
                    </div>
                </div>
            </div>
            <div className="flex items-center gap-3 sm:gap-4 ml-8 sm:ml-0 shrink-0 flex-wrap">
                {session.hasAttendance && (
                    <div className="text-sm text-gray-500 whitespace-nowrap">
                        {session.attendedCount} / {session.totalEnrolled}{' '}
                        attended (
                        {session.totalEnrolled > 0
                            ? Math.round(
                                  (session.attendedCount /
                                      session.totalEnrolled) *
                                      100
                              )
                            : 0}
                        %)
                    </div>
                )}
                {session.isPast &&
                    !session.hasAttendance &&
                    !session.isCancelled && (
                        <Badge
                            variant="outline"
                            className="bg-amber-50 text-amber-700 border-amber-200"
                        >
                            Missing
                        </Badge>
                    )}
                {!session.isCancelled && !session.isUpcoming && (
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                            e.stopPropagation();
                            onClick();
                        }}
                        className="border-gray-300"
                    >
                        {session.hasAttendance ? 'Edit' : 'Take'} Attendance
                    </Button>
                )}
                {session.isUpcoming && !session.isCancelled && (
                    <>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                                e.stopPropagation();
                                onReschedule();
                            }}
                            className="border-gray-300 hover:bg-gray-50"
                        >
                            <CalendarClock className="size-4 mr-1.5" />
                            Reschedule
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                                e.stopPropagation();
                                onCancel();
                            }}
                            className="border-gray-300 text-red-600 hover:bg-red-50 hover:text-red-700 hover:border-red-200"
                        >
                            <X className="size-4 mr-1.5" />
                            Cancel
                        </Button>
                    </>
                )}
            </div>
        </div>
    );
}
