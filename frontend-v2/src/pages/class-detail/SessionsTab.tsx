import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { useNavigate } from 'react-router-dom';
import {
    Calendar,
    AlertCircle,
    CheckCircle,
    Filter
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Class } from '@/types/program';
import { ClassEventInstance } from '@/types/events';
import { ServerResponseMany } from '@/types/server';

type StatusFilter = 'all' | 'completed' | 'missing' | 'upcoming' | 'cancelled';
type TimeFilter = 'week' | '2weeks' | 'month' | 'all';

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

function buildSessionDisplays(
    instances: ClassEventInstance[],
    enrolled: number
): SessionDisplay[] {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return instances.map((inst) => {
        const dateObj = new Date(inst.date);
        dateObj.setHours(0, 0, 0, 0);
        const isToday = dateObj.getTime() === today.getTime();
        const isPast = dateObj < today;
        const isUpcoming = dateObj > today;

        const attendedCount = inst.attendance_records?.filter(
            (r) =>
                r.attendance_status === 'present' ||
                r.attendance_status === 'partial'
        ).length ?? 0;

        const hasAttendance = (inst.attendance_records?.length ?? 0) > 0;

        return {
            instance: inst,
            dateObj,
            dayName: dateObj.toLocaleDateString('en-US', { weekday: 'long' }),
            isToday,
            isPast,
            isUpcoming,
            hasAttendance,
            isCancelled: inst.is_cancelled,
            attendedCount,
            totalEnrolled: enrolled
        };
    }).sort((a, b) => b.dateObj.getTime() - a.dateObj.getTime());
}

function FilterButton({
    active,
    onClick,
    children
}: {
    active: boolean;
    onClick: () => void;
    children: React.ReactNode;
}) {
    return (
        <button
            onClick={onClick}
            className={`text-sm px-3 py-1.5 rounded-md transition-colors ${
                active
                    ? 'bg-[#556830] text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
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
    const [showAllPast, setShowAllPast] = useState(false);

    const { data: instancesResp } = useSWR<
        ServerResponseMany<ClassEventInstance>
    >(`/api/program-classes/${cls.id}/events`);

    const allSessions = useMemo(() => {
        if (!instancesResp?.data) return [];
        return buildSessionDisplays(instancesResp.data, cls.enrolled);
    }, [instancesResp, cls.enrolled]);

    const stats = useMemo(() => {
        const completed = allSessions.filter(
            (s) => s.isPast && s.hasAttendance && !s.isCancelled
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

    const filtered = useMemo(() => {
        let result = allSessions;

        if (statusFilter === 'completed') {
            result = result.filter(
                (s) => s.isPast && s.hasAttendance && !s.isCancelled
            );
        } else if (statusFilter === 'missing') {
            result = result.filter(
                (s) => s.isPast && !s.hasAttendance && !s.isCancelled
            );
        } else if (statusFilter === 'upcoming') {
            result = result.filter((s) => s.isUpcoming && !s.isCancelled);
        } else if (statusFilter === 'cancelled') {
            result = result.filter((s) => s.isCancelled);
        }

        if (timeFilter !== 'all') {
            const cutoff = new Date();
            const daysMap: Record<string, number> = {
                week: 7,
                '2weeks': 14,
                month: 30
            };
            cutoff.setDate(cutoff.getDate() - (daysMap[timeFilter] ?? 0));
            result = result.filter((s) => s.dateObj >= cutoff);
        }

        return result;
    }, [allSessions, statusFilter, timeFilter]);

    const pastAndToday = filtered.filter((s) => s.isPast || s.isToday);
    const upcoming = filtered
        .filter((s) => s.isUpcoming)
        .reverse()
        .slice(0, 10);
    const displayedPast = showAllPast
        ? pastAndToday
        : pastAndToday.slice(0, 15);

    const navigateToAttendance = (session: SessionDisplay) => {
        const eventId = session.instance.event_id ?? session.instance.id;
        navigate(
            `/program-classes/${cls.id}/events/${eventId}/attendance/${session.instance.date}`
        );
    };

    return (
        <div className="bg-white rounded-lg border border-gray-200">
            <div className="border-b border-gray-200 px-6 py-4">
                <div className="flex items-center justify-between mb-3">
                    <div>
                        <h3 className="text-[#203622] font-semibold">
                            Session Management
                        </h3>
                        <p className="text-sm text-gray-600 mt-1">
                            View and manage individual sessions
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <StatButton
                            active={statusFilter === 'completed'}
                            onClick={() => setStatusFilter('completed')}
                            colorClass="bg-green-100 text-[#556830]"
                        >
                            {stats.completed} Completed
                        </StatButton>
                        <StatButton
                            active={statusFilter === 'missing'}
                            onClick={() => setStatusFilter('missing')}
                            colorClass="bg-amber-100 text-amber-700"
                        >
                            {stats.missing} Missing
                        </StatButton>
                        <StatButton
                            active={statusFilter === 'upcoming'}
                            onClick={() => setStatusFilter('upcoming')}
                            colorClass="bg-blue-100 text-blue-700"
                        >
                            {stats.upcoming} Upcoming
                        </StatButton>
                        <StatButton
                            active={statusFilter === 'cancelled'}
                            onClick={() => setStatusFilter('cancelled')}
                            colorClass="bg-gray-100 text-gray-700"
                        >
                            {stats.cancelled} Cancelled
                        </StatButton>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <Filter className="size-4 text-gray-400" />
                    <div className="flex gap-2 flex-1">
                        <FilterButton
                            active={statusFilter === 'all'}
                            onClick={() => setStatusFilter('all')}
                        >
                            All Sessions
                        </FilterButton>
                        <FilterButton
                            active={statusFilter === 'completed'}
                            onClick={() => setStatusFilter('completed')}
                        >
                            Completed
                        </FilterButton>
                        <FilterButton
                            active={statusFilter === 'missing'}
                            onClick={() => setStatusFilter('missing')}
                        >
                            Missing
                        </FilterButton>
                        <FilterButton
                            active={statusFilter === 'upcoming'}
                            onClick={() => setStatusFilter('upcoming')}
                        >
                            Upcoming
                        </FilterButton>
                    </div>
                    <div className="h-6 w-px bg-gray-300" />
                    <div className="flex gap-2">
                        <FilterButton
                            active={timeFilter === 'week'}
                            onClick={() => setTimeFilter('week')}
                        >
                            Last Week
                        </FilterButton>
                        <FilterButton
                            active={timeFilter === '2weeks'}
                            onClick={() => setTimeFilter('2weeks')}
                        >
                            Last 2 Weeks
                        </FilterButton>
                        <FilterButton
                            active={timeFilter === 'month'}
                            onClick={() => setTimeFilter('month')}
                        >
                            Last Month
                        </FilterButton>
                        <FilterButton
                            active={timeFilter === 'all'}
                            onClick={() => setTimeFilter('all')}
                        >
                            All Time
                        </FilterButton>
                    </div>
                </div>
            </div>

            {stats.missing > 0 && (
                <div className="mx-6 mt-6 mb-4 bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <div className="flex items-start justify-between">
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
                                <p className="text-sm text-gray-600 mt-1">
                                    Please review and complete attendance for
                                    past sessions
                                </p>
                            </div>
                        </div>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setStatusFilter('missing')}
                            className="border-amber-300 text-amber-700 hover:bg-amber-100"
                        >
                            View Missing Sessions
                        </Button>
                    </div>
                </div>
            )}

            <div className="p-6">
                {filtered.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                        <Calendar className="size-12 mx-auto mb-3 text-gray-300" />
                        <p>No sessions match your filters</p>
                        <p className="text-sm mt-1">
                            Try adjusting your filter selection
                        </p>
                    </div>
                ) : (
                    <div className="space-y-8">
                        {displayedPast.length > 0 && (
                            <SessionGroup
                                title="Past & Today"
                                subtitle="Recent sessions requiring action or review"
                                count={pastAndToday.length}
                                sessions={displayedPast}
                                onSessionClick={navigateToAttendance}
                            />
                        )}
                        {pastAndToday.length > 15 && (
                            <div className="text-sm text-gray-500 text-center">
                                <button
                                    onClick={() => setShowAllPast(!showAllPast)}
                                    className="text-[#556830] hover:text-[#203622] underline"
                                >
                                    {showAllPast ? 'Show Less' : 'Show All'}
                                </button>
                            </div>
                        )}
                        {upcoming.length > 0 && (
                            <SessionGroup
                                title="Upcoming Sessions"
                                subtitle={`Next ${upcoming.length} scheduled ${upcoming.length === 1 ? 'session' : 'sessions'}`}
                                count={upcoming.length}
                                sessions={upcoming}
                                onSessionClick={navigateToAttendance}
                            />
                        )}
                    </div>
                )}
            </div>
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
                active ? `${colorClass} font-medium` : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
        >
            {children}
        </button>
    );
}

function SessionGroup({
    title,
    subtitle,
    count,
    sessions,
    onSessionClick
}: {
    title: string;
    subtitle: string;
    count: number;
    sessions: SessionDisplay[];
    onSessionClick: (s: SessionDisplay) => void;
}) {
    return (
        <div>
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h4 className="text-[#203622] font-medium">{title}</h4>
                    <p className="text-sm text-gray-600 mt-0.5">{subtitle}</p>
                </div>
                <span className="text-sm text-gray-600">
                    {count} {count === 1 ? 'session' : 'sessions'}
                </span>
            </div>
            <div className="space-y-2">
                {sessions.map((session) => (
                    <SessionRow
                        key={session.instance.date + '-' + session.instance.id}
                        session={session}
                        onClick={() => onSessionClick(session)}
                    />
                ))}
            </div>
        </div>
    );
}

function SessionRow({
    session,
    onClick
}: {
    session: SessionDisplay;
    onClick: () => void;
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
            className={`flex items-center justify-between p-4 rounded-lg border transition-colors cursor-pointer ${borderClass}`}
        >
            <div className="flex items-center gap-4">
                {session.isCancelled ? (
                    <Calendar className="size-5 text-gray-400 flex-shrink-0" />
                ) : session.hasAttendance ? (
                    <CheckCircle className="size-5 text-[#556830] flex-shrink-0" />
                ) : session.isPast ? (
                    <AlertCircle className="size-5 text-[#F1B51C] flex-shrink-0" />
                ) : (
                    <Calendar className="size-5 text-gray-400 flex-shrink-0" />
                )}
                <div>
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
                                className="ml-2 bg-gray-100 text-gray-600 border-gray-300"
                            >
                                Cancelled
                            </Badge>
                        )}
                    </div>
                    <div
                        className={`text-xs text-gray-600 mt-0.5 ${session.isCancelled ? 'line-through' : ''}`}
                    >
                        {session.instance.class_time}
                    </div>
                </div>
            </div>
            <div className="flex items-center gap-4">
                {session.hasAttendance && (
                    <div className="text-sm text-gray-600">
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
                {!session.isCancelled && (
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
            </div>
        </div>
    );
}
