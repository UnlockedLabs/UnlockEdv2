import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { useNavigate } from 'react-router-dom';
import {
    Calendar,
    AlertCircle,
    CheckCircle,
    Filter,
    CalendarClock,
    CalendarOff,
    X,
    Users,
    MapPin
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Class } from '@/types/program';
import { ClassEventInstance } from '@/types/events';
import { Attendance } from '@/types/attendance';
import { ServerResponseMany } from '@/types/server';
import { CancelSessionModal } from './CancelSessionModal';
import { RescheduleSessionModal } from './RescheduleSessionModal';
import {
    BulkCancelSessionsModal,
    BulkCancelSession
} from './BulkCancelSessionsModal';
import {
    ChangeInstructorModal,
    ChangeInstructorSession
} from './ChangeInstructorModal';
import { ChangeRoomModal, ChangeRoomSession } from './ChangeRoomModal';

type StatusFilter = 'all' | 'completed' | 'missing' | 'upcoming' | 'cancelled';
type TimeFilter = 'week' | '2weeks' | 'month' | 'all';

const PAST_DISPLAY_LIMIT = 15;
const UPCOMING_DISPLAY_LIMIT = 10;
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
    const [cancelTarget, setCancelTarget] = useState<SessionDisplay | null>(
        null
    );
    const [rescheduleTarget, setRescheduleTarget] =
        useState<SessionDisplay | null>(null);
    const [showBulkCancel, setShowBulkCancel] = useState(false);
    const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set());
    const [showChangeInstructor, setShowChangeInstructor] = useState(false);
    const [showChangeRoom, setShowChangeRoom] = useState(false);
    const [changeInstructorSessions, setChangeInstructorSessions] = useState<
        ChangeInstructorSession[]
    >([]);
    const [changeRoomSessions, setChangeRoomSessions] = useState<
        ChangeRoomSession[]
    >([]);
    const [showAllPast, setShowAllPast] = useState(false);

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

    const hideTimeFilter = statusFilter === 'upcoming';

    const handleStatusChange = (newStatus: StatusFilter) => {
        setStatusFilter(newStatus);
        setSelectedDates(new Set());
        if (newStatus === 'upcoming') {
            setTimeFilter('all');
        }
    };

    const handleTimeChange = (newTime: TimeFilter) => {
        setTimeFilter(newTime);
        setSelectedDates(new Set());
    };

    const toggleSession = (date: string) => {
        setSelectedDates((prev) => {
            const next = new Set(prev);
            if (next.has(date)) next.delete(date);
            else next.add(date);
            return next;
        });
    };

    const buildSessionPayload = (
        session: SessionDisplay
    ): { date: string; dateLabel: string; eventId: number; classTime: string } => ({
        date: session.instance.date,
        dateLabel: session.dateObj.toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            year: 'numeric'
        }),
        eventId: session.instance.event_id ?? session.instance.id,
        classTime: session.instance.class_time
    });

    const openChangeInstructor = (sessions: SessionDisplay[]) => {
        setChangeInstructorSessions(sessions.map(buildSessionPayload));
        setShowChangeInstructor(true);
    };

    const openChangeRoom = (sessions: SessionDisplay[]) => {
        setChangeRoomSessions(sessions.map(buildSessionPayload));
        setShowChangeRoom(true);
    };

    const selectedUpcomingSessions = useMemo(
        () =>
            allSessions.filter(
                (s) =>
                    s.isUpcoming &&
                    !s.isCancelled &&
                    selectedDates.has(s.instance.date)
            ),
        [allSessions, selectedDates]
    );

    const bulkCancelSessions = useMemo<BulkCancelSession[]>(
        () =>
            selectedUpcomingSessions.map((s) => ({
                date: s.instance.date,
                dateObj: s.dateObj,
                dayName: s.dayName,
                eventId: s.instance.event_id ?? s.instance.id
            })),
        [selectedUpcomingSessions]
    );

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

    const displayedUpcoming = upcomingSessions.slice(
        0,
        UPCOMING_DISPLAY_LIMIT
    );

    const navigateToAttendance = (session: SessionDisplay) => {
        const eventId = session.instance.event_id ?? session.instance.id;
        navigate(
            `/program-classes/${cls.id}/events/${eventId}/attendance/${session.instance.date}`
        );
    };

    const timeLabel = hideTimeFilter
        ? ''
        : timeFilter === 'all'
          ? 'All Time'
          : timeFilter === 'month'
            ? 'Last Month'
            : timeFilter === '2weeks'
              ? 'Last 2 Weeks'
              : 'Last Week';

    const renderSessionRow = (session: SessionDisplay) => (
        <SessionRow
            key={session.instance.date + '-' + session.instance.id}
            session={session}
            selected={selectedDates.has(session.instance.date)}
            onToggle={() => toggleSession(session.instance.date)}
            onClick={() => navigateToAttendance(session)}
            onCancel={() => setCancelTarget(session)}
            onReschedule={() => setRescheduleTarget(session)}
        />
    );

    return (
        <div className="bg-white rounded-lg border border-gray-200">
            <div className="border-b border-gray-200 px-6 py-4">
                <div className="flex items-center justify-between mb-3">
                    <div>
                        <h3 className="text-[#203622]">Session Management</h3>
                        <p className="text-sm text-gray-600 mt-1">
                            View, cancel, or reschedule individual sessions
                        </p>
                    </div>
                    <div className="flex gap-2">
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
                            colorClass="bg-gray-100 text-gray-700"
                        >
                            {stats.cancelled} Cancelled
                        </StatButton>
                    </div>
                </div>

                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Filter className="size-4 text-gray-400" />
                        <div className="flex gap-2">
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
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="h-6 w-px bg-gray-300" />
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
                            Last Month
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
                            onClick={() => handleStatusChange('missing')}
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
                        {pastAndTodaySessions.length > 0 && (
                            <div>
                                <div className="flex items-center justify-between mb-4">
                                    <div>
                                        <h4 className="text-[#203622] font-medium">
                                            Past & Today
                                        </h4>
                                        <p className="text-sm text-gray-600 mt-0.5">
                                            Recent sessions requiring action or
                                            review
                                            {timeLabel &&
                                                ` - ${timeLabel}`}
                                        </p>
                                    </div>
                                    <span className="text-sm text-gray-600">
                                        {pastAndTodaySessions.length}{' '}
                                        {pastAndTodaySessions.length === 1
                                            ? 'session'
                                            : 'sessions'}
                                    </span>
                                </div>
                                <div className="space-y-2">
                                    {displayedPast.map(renderSessionRow)}
                                </div>
                                {pastAndTodaySessions.length >
                                    PAST_DISPLAY_LIMIT && (
                                    <div className="pt-4 text-center">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() =>
                                                setShowAllPast(!showAllPast)
                                            }
                                        >
                                            {showAllPast
                                                ? 'Show Less'
                                                : `Show All ${pastAndTodaySessions.length} Sessions`}
                                        </Button>
                                    </div>
                                )}
                            </div>
                        )}

                        {upcomingSessions.length > 0 && (
                            <div>
                                <div className="flex items-center justify-between mb-4">
                                    <div>
                                        <h4 className="text-[#203622] font-medium">
                                            Upcoming Sessions
                                        </h4>
                                        <p className="text-sm text-gray-600 mt-0.5">
                                            Next{' '}
                                            {Math.min(
                                                upcomingSessions.length,
                                                UPCOMING_DISPLAY_LIMIT
                                            )}{' '}
                                            scheduled{' '}
                                            {upcomingSessions.length === 1
                                                ? 'session'
                                                : 'session(s)'}
                                        </p>
                                    </div>
                                    <span className="text-sm text-gray-600">
                                        {upcomingSessions.length > UPCOMING_DISPLAY_LIMIT
                                            ? `Showing next ${UPCOMING_DISPLAY_LIMIT} of ${upcomingSessions.length} total`
                                            : `${upcomingSessions.length} ${upcomingSessions.length === 1 ? 'session' : 'sessions'}`}
                                    </span>
                                </div>
                                <div className="space-y-2">
                                    {displayedUpcoming.map(renderSessionRow)}
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
                    currentRoom={cls.events?.[0]?.room_ref?.name}
                    onRescheduled={() => void mutate()}
                />
            )}

            <BulkCancelSessionsModal
                open={showBulkCancel}
                onOpenChange={setShowBulkCancel}
                classId={cls.id}
                sessions={bulkCancelSessions}
                onCancelled={() => {
                    setSelectedDates(new Set());
                    void mutate();
                }}
            />

            <ChangeInstructorModal
                open={showChangeInstructor}
                onClose={() => setShowChangeInstructor(false)}
                classId={cls.id}
                sessions={changeInstructorSessions}
                onChanged={() => {
                    setSelectedDates(new Set());
                    void mutate();
                }}
            />

            <ChangeRoomModal
                open={showChangeRoom}
                onClose={() => setShowChangeRoom(false)}
                classId={cls.id}
                sessions={changeRoomSessions}
                onChanged={() => {
                    setSelectedDates(new Set());
                    void mutate();
                }}
            />

            {selectedDates.size > 0 && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#E2E7EA] border border-gray-400 rounded-lg shadow-lg px-6 py-4">
                    <div className="flex items-center gap-6">
                        <div className="text-sm">
                            <span className="font-semibold text-[#203622]">
                                {selectedDates.size}
                            </span>
                            <span className="text-gray-600 ml-1">
                                {selectedDates.size === 1
                                    ? 'session'
                                    : 'sessions'}{' '}
                                selected
                            </span>
                        </div>
                        <div className="flex gap-3">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setSelectedDates(new Set())}
                            >
                                Clear Selection
                            </Button>
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                    if (selectedUpcomingSessions.length === 1) {
                                        setCancelTarget(
                                            selectedUpcomingSessions[0]
                                        );
                                    } else {
                                        setShowBulkCancel(true);
                                    }
                                }}
                            >
                                <CalendarOff className="size-4 mr-2" />
                                Cancel Sessions
                            </Button>
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                    openChangeInstructor(
                                        selectedUpcomingSessions
                                    )
                                }
                            >
                                <Users className="size-4 mr-2" />
                                Change Instructor
                            </Button>
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                    openChangeRoom(selectedUpcomingSessions)
                                }
                            >
                                <MapPin className="size-4 mr-2" />
                                Change Room
                            </Button>
                        </div>
                    </div>
                </div>
            )}
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
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
        >
            {children}
        </button>
    );
}

function SessionRow({
    session,
    selected,
    onToggle,
    onClick,
    onCancel,
    onReschedule
}: {
    session: SessionDisplay;
    selected: boolean;
    onToggle: () => void;
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
            className={`flex items-center justify-between p-4 rounded-lg border transition-colors cursor-pointer ${borderClass}`}
        >
            <div className="flex items-center gap-4 min-w-0">
                {session.isUpcoming && !session.isCancelled && (
                    <Checkbox
                        checked={selected}
                        onCheckedChange={() => onToggle()}
                        onClick={(e) => e.stopPropagation()}
                    />
                )}
                {session.isCancelled ? (
                    <Calendar className="size-5 text-gray-500 flex-shrink-0" />
                ) : session.hasAttendance ? (
                    <CheckCircle className="size-5 text-[#556830] flex-shrink-0" />
                ) : session.isPast ? (
                    <AlertCircle className="size-5 text-[#F1B51C] flex-shrink-0" />
                ) : (
                    <Calendar className="size-5 text-gray-400 flex-shrink-0" />
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
            <div
                className="flex items-center gap-4"
                onClick={(e) => e.stopPropagation()}
            >
                {session.hasAttendance && (
                    <div className="text-sm text-gray-600 whitespace-nowrap">
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
                        onClick={() => onClick()}
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
                            onClick={() => onReschedule()}
                            className="border-gray-300 hover:bg-gray-50"
                        >
                            <CalendarClock className="size-4 mr-1.5" />
                            Reschedule
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onCancel()}
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
