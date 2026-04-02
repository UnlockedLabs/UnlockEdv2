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
    MapPin,
    Undo2
} from 'lucide-react';
import API from '@/api/api';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Class } from '@/types/program';
import { ClassEventInstance } from '@/types/events';
import { ServerResponseMany } from '@/types/server';
import { RescheduleSessionModal } from './RescheduleSessionModal';
import { CancelSessionModal } from './CancelSessionModal';
import {
    BulkCancelSessionsModal,
    BulkCancelSession
} from './BulkCancelSessionsModal';
import {
    ChangeInstructorModal,
    ChangeInstructorSession
} from './ChangeInstructorModal';
import { ChangeRoomModal, ChangeRoomSession } from './ChangeRoomModal';
import { SessionDetailSheet } from './SessionDetailSheet';
import {
    buildRescheduleMaps,
    buildRoomOverrideMap,
    buildCancellationReasonMap,
    buildSessionDisplays,
    findCancelOverrideId,
    type SessionDisplay
} from './session-utils';

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
    onClassMutate: () => void;
}

export type { SessionDisplay } from './session-utils';

function parseLocalDate(dateStr: string): Date {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d);
}

function formatShortDate(dateStr: string): string {
    const d = parseLocalDate(dateStr);
    return d.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
    });
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

export function SessionsTab({ cls, onClassMutate }: SessionsTabProps) {
    const navigate = useNavigate();
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
    const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');
    const [cancelSessions, setCancelSessions] = useState<BulkCancelSession[]>(
        []
    );
    const [showBulkCancelModal, setShowBulkCancelModal] = useState(false);
    const [quickCancelSession, setQuickCancelSession] =
        useState<SessionDisplay | null>(null);
    const [showQuickCancel, setShowQuickCancel] = useState(false);
    const [rescheduleTarget, setRescheduleTarget] =
        useState<SessionDisplay | null>(null);
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
    const [selectedSession, setSelectedSession] =
        useState<SessionDisplay | null>(null);

    const { data: instancesResp, mutate } = useSWR<
        ServerResponseMany<ClassEventInstance>
    >(`/api/program-classes/${cls.id}/events?all=true`);

    const rescheduleMaps = useMemo(
        () => buildRescheduleMaps(cls.events ?? []),
        [cls.events]
    );

    const roomOverrides = useMemo(
        () => buildRoomOverrideMap(cls.events ?? []),
        [cls.events]
    );

    const cancellationReasons = useMemo(
        () => buildCancellationReasonMap(cls.events ?? []),
        [cls.events]
    );

    const allSessions = useMemo(() => {
        if (!instancesResp?.data) return [];
        return buildSessionDisplays(
            instancesResp.data,
            cls.enrolled,
            rescheduleMaps.fromTo,
            rescheduleMaps.toFrom,
            rescheduleMaps.appliedFutureDates,
            rescheduleMaps.intermediateDates,
            cancellationReasons
        );
    }, [instancesResp, cls.enrolled, rescheduleMaps, cancellationReasons]);

    const stats = useMemo(() => {
        const completed = allSessions.filter(
            (s) =>
                (s.isPast || s.isToday) &&
                s.hasAttendance &&
                !s.isCancelled &&
                !s.isRescheduledFrom
        ).length;
        const missing = allSessions.filter(
            (s) =>
                s.isPast &&
                !s.hasAttendance &&
                !s.isCancelled &&
                !s.isRescheduledFrom
        ).length;
        const upcoming = allSessions.filter(
            (s) => s.isUpcoming && !s.isCancelled && !s.isRescheduledFrom
        ).length;
        const cancelled = allSessions.filter(
            (s) => s.isCancelled && !s.isRescheduledFrom
        ).length;
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
    ): {
        date: string;
        dateLabel: string;
        eventId: number;
        classTime: string;
        dateObj: Date;
        dayName: string;
    } => ({
        date: session.instance.date,
        dateLabel: session.dateObj.toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            year: 'numeric'
        }),
        eventId: session.instance.event_id ?? session.instance.id,
        classTime: session.instance.class_time,
        dateObj: session.dateObj,
        dayName: session.dayName
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
                    !s.isRescheduledFrom &&
                    selectedDates.has(s.instance.date)
            ),
        [allSessions, selectedDates]
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

    const displayedUpcoming = upcomingSessions.slice(
        0,
        UPCOMING_DISPLAY_LIMIT
    );

    const refreshData = async () => {
        await mutate();
        onClassMutate();
    };

    const navigateToAttendance = (session: SessionDisplay) => {
        const eventId = session.instance.event_id ?? session.instance.id;
        navigate(
            `/program-classes/${cls.id}/events/${eventId}/attendance/${session.instance.date}`
        );
    };

    const handleUndo = async (session: SessionDisplay) => {
        let overrideId: number | undefined;

        if (session.rescheduleOverrideId) {
            overrideId = session.rescheduleOverrideId;
        } else if (session.isCancelled) {
            overrideId = findCancelOverrideId(
                cls.events ?? [],
                session.instance.date
            );
        }
        if (!overrideId && session.instance.override_id) {
            overrideId = session.instance.override_id;
        }

        if (!overrideId) return;
        const hasAppliedFuture =
            rescheduleMaps.appliedFutureDates.size > 0 &&
            (session.isRescheduledFrom || session.isRescheduledTo);
        const url = hasAppliedFuture
            ? `program-classes/${cls.id}/events/${overrideId}?undo_applied_future=true`
            : `program-classes/${cls.id}/events/${overrideId}`;
        const resp = await API.delete(url);
        if (resp.success) {
            toast.success(
                session.isRescheduledFrom || session.isRescheduledTo
                    ? hasAppliedFuture
                        ? 'Reschedule and future changes undone'
                        : 'Reschedule undone'
                    : 'Cancellation undone'
            );
        }
        await refreshData();
    };

    const handleUndoCancel = async (session: SessionDisplay) => {
        const overrideId = session.rescheduleOverrideId ?? session.instance.override_id;
        if (!overrideId) return;
        const resp = await API.post(
            `program-classes/${cls.id}/events/${overrideId}/uncancel`,
            {}
        );
        if (resp.success) {
            toast.success('Cancellation undone');
        }
        await refreshData();
    };

    const renderSessionRow = (session: SessionDisplay) => (
        <SessionRow
            key={session.instance.date + '-' + (session.instance.event_id ?? session.instance.id)}
            session={session}
            selected={selectedDates.has(session.instance.date)}
            onToggle={() => toggleSession(session.instance.date)}
            onClick={() => setSelectedSession(session)}
            onNavigateToAttendance={() => navigateToAttendance(session)}
            onCancel={() => {
                setQuickCancelSession(session);
                setShowQuickCancel(true);
            }}
            onReschedule={() => setRescheduleTarget(session)}
            onUndo={() => void handleUndo(session)}
            onUndoCancel={() => void handleUndoCancel(session)}
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

                <div className="flex items-center gap-3">
                    <Filter className="size-4 text-gray-400" />
                    <div className="flex gap-2 flex-1">
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
                    <div className="h-6 w-px bg-gray-300" />
                    <div className="flex gap-2">
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
                                    <div className="text-sm text-gray-500 text-center mt-2">
                                        <button
                                            onClick={() =>
                                                setShowAllPast(!showAllPast)
                                            }
                                            className="text-[#556830] hover:text-[#203622] underline"
                                        >
                                            {showAllPast
                                                ? 'Show Less'
                                                : 'Show All'}
                                        </button>
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
                                                : 'sessions'}
                                        </p>
                                    </div>
                                    {upcomingSessions.length >
                                        UPCOMING_DISPLAY_LIMIT && (
                                        <span className="text-xs text-gray-500">
                                            Showing next {UPCOMING_DISPLAY_LIMIT}{' '}
                                            of {upcomingSessions.length} total
                                        </span>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    {displayedUpcoming.map(renderSessionRow)}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {rescheduleTarget && (
                <RescheduleSessionModal
                    open={!!rescheduleTarget}
                    onClose={() => setRescheduleTarget(null)}
                    classId={cls.id}
                    eventId={
                        rescheduleTarget.instance.event_id ??
                        rescheduleTarget.instance.id
                    }
                    originalDate={rescheduleTarget.instance.date}
                    dateLabel={rescheduleTarget.dateObj.toLocaleDateString(
                        'en-US',
                        {
                            weekday: 'long',
                            month: 'long',
                            day: 'numeric'
                        }
                    )}
                    currentRoom={cls.events?.[0]?.room_ref?.name}
                    classTime={rescheduleTarget.instance.class_time}
                    onRescheduled={() => void refreshData()}
                />
            )}

            {showQuickCancel && quickCancelSession && (
                <CancelSessionModal
                    open={showQuickCancel}
                    onClose={() => {
                        setShowQuickCancel(false);
                        setQuickCancelSession(null);
                    }}
                    classId={cls.id}
                    eventId={
                        quickCancelSession.instance.event_id ??
                        quickCancelSession.instance.id
                    }
                    date={quickCancelSession.instance.date}
                    classTime={quickCancelSession.instance.class_time}
                    dateLabel={quickCancelSession.dateObj.toLocaleDateString(
                        'en-US',
                        {
                            weekday: 'long',
                            month: 'long',
                            day: 'numeric'
                        }
                    )}
                    onCancelled={() => {
                        setShowQuickCancel(false);
                        setQuickCancelSession(null);
                        void refreshData();
                    }}
                />
            )}

            <BulkCancelSessionsModal
                open={showBulkCancelModal}
                onOpenChange={setShowBulkCancelModal}
                classId={cls.id}
                sessions={cancelSessions}
                onCancelled={() => {
                    setSelectedDates(new Set());
                    setCancelSessions([]);
                    void refreshData();
                }}
            />

            {showChangeInstructor && (
                <ChangeInstructorModal
                    open={showChangeInstructor}
                    onClose={() => setShowChangeInstructor(false)}
                    classId={cls.id}
                    sessions={changeInstructorSessions}
                    onChanged={() => {
                        setSelectedDates(new Set());
                        void refreshData();
                    }}
                    showSessionsList
                />
            )}

            {showChangeRoom && (
                <ChangeRoomModal
                    open={showChangeRoom}
                    onClose={() => setShowChangeRoom(false)}
                    classId={cls.id}
                    sessions={changeRoomSessions}
                    onChanged={() => {
                        setSelectedDates(new Set());
                        void refreshData();
                    }}
                    showSessionsList
                />
            )}

            <SessionDetailSheet
                session={selectedSession}
                onClose={() => setSelectedSession(null)}
                className={cls.name}
                classTime={
                    selectedSession?.instance.class_time ??
                    cls.events?.[0]?.duration ??
                    ''
                }
                room={
                    (selectedSession
                        ? roomOverrides.get(selectedSession.instance.date)
                        : undefined) ??
                    cls.events?.[0]?.room_ref?.name ??
                    'TBD'
                }
                classId={cls.id}
                onMutate={() => void refreshData()}
                onUndo={() => {
                    if (selectedSession) void handleUndo(selectedSession);
                }}
                onUndoCancel={() => {
                    if (selectedSession) void handleUndoCancel(selectedSession);
                }}
                onUndoReschedule={() => {
                    if (selectedSession) void handleUndo(selectedSession);
                }}
                allSessions={allSessions}
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
                                    setCancelSessions(
                                        selectedUpcomingSessions.map((s) => ({
                                            date: s.instance.date,
                                            dateObj: s.dateObj,
                                            dayName: s.dayName,
                                            eventId:
                                                s.instance.event_id ??
                                                s.instance.id,
                                            classTime: s.instance.class_time
                                        }))
                                    );
                                    setShowBulkCancelModal(true);
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
    onNavigateToAttendance,
    onCancel,
    onReschedule,
    onUndo,
    onUndoCancel
}: {
    session: SessionDisplay;
    selected: boolean;
    onToggle: () => void;
    onClick: () => void;
    onNavigateToAttendance: () => void;
    onCancel: () => void;
    onReschedule: () => void;
    onUndo: () => void;
    onUndoCancel: () => void;
}) {
    const dateLabel = session.dateObj.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric'
    });

    const {
        isCancelled,
        isRescheduledFrom,
        isRescheduledTo,
        isCancelledReschedule,
        isToday,
        hasAttendance,
        isPast,
        isUpcoming,
        rescheduledDate,
        rescheduledClassTime
    } = session;

    // Same-date time-only reschedule: both isRescheduledFrom and isRescheduledTo are true.
    // Should display as a "to" row (blue) with one undo button, not a "from" row (gray dashed).
    const isSameDateReschedule = isRescheduledFrom && isRescheduledTo && rescheduledDate === session.instance.date;

    const getBorderClass = () => {
        if (isRescheduledFrom)
            return 'border-gray-300 border-dashed bg-gray-50 hover:bg-gray-100';
        if (isCancelledReschedule)
            return 'border-gray-300 bg-gray-100 hover:bg-gray-200';
        if (isRescheduledTo)
            return 'border-blue-300 bg-blue-50 hover:bg-blue-100';
        if (isCancelled)
            return 'border-gray-300 bg-gray-100 hover:bg-gray-200';
        if (isToday) return 'border-blue-200 bg-blue-50 hover:bg-blue-100';
        if (hasAttendance) return 'border-gray-200 hover:bg-[#E2E7EA]/30';
        if (isPast)
            return 'border-amber-200 bg-amber-50/30 hover:bg-amber-50';
        return 'border-gray-200 bg-gray-50 hover:bg-[#E2E7EA]/30';
    };

    const getIcon = () => {
        if (isRescheduledFrom)
            return (
                <CalendarClock className="size-5 text-gray-400 flex-shrink-0" />
            );
        if (isRescheduledTo)
            return (
                <CalendarClock className="size-5 text-blue-700 flex-shrink-0" />
            );
        if (isCancelled)
            return (
                <CalendarOff className="size-5 text-gray-500 flex-shrink-0" />
            );
        if (hasAttendance)
            return (
                <CheckCircle className="size-5 text-[#556830] flex-shrink-0" />
            );
        if (isPast)
            return (
                <AlertCircle className="size-5 text-[#F1B51C] flex-shrink-0" />
            );
        return <Calendar className="size-5 text-gray-400 flex-shrink-0" />;
    };

    const showCheckbox =
        isUpcoming && !isCancelled && !isRescheduledFrom && !isCancelledReschedule;
    const showLineThrough = isCancelled || isRescheduledFrom || isCancelledReschedule;

    return (
        <div
            onClick={onClick}
            className={`flex items-center justify-between p-4 rounded-lg border transition-colors cursor-pointer ${getBorderClass()}`}
        >
            <div className="flex items-center gap-4 min-w-0">
                {showCheckbox && (
                    <Checkbox
                        checked={selected}
                        onCheckedChange={() => onToggle()}
                        onClick={(e) => e.stopPropagation()}
                    />
                )}
                {getIcon()}
                <div className="min-w-0">
                    <div className="text-sm font-medium text-[#203622]">
                        <span
                            className={showLineThrough ? 'line-through' : ''}
                        >
                            {session.dayName}, {dateLabel}
                        </span>
                        {isToday && (
                            <Badge className="ml-2 bg-blue-500 text-white">
                                Today
                            </Badge>
                        )}
                        {isCancelled && (
                            <Badge
                                variant="outline"
                                className="ml-2 bg-gray-100 text-gray-600 border-gray-300"
                            >
                                Cancelled
                            </Badge>
                        )}
                        {isRescheduledFrom && (
                            <Badge
                                variant="outline"
                                className="ml-2 bg-gray-100 text-gray-600 border-gray-300"
                            >
                                Rescheduled
                            </Badge>
                        )}
                        {isRescheduledTo && (
                            <Badge
                                variant="outline"
                                className="ml-2 bg-blue-100 text-blue-800 border-blue-300"
                            >
                                Rescheduled Class
                            </Badge>
                        )}
                        {isCancelledReschedule && (
                            <>
                                <Badge
                                    variant="outline"
                                    className="ml-2 bg-gray-100 text-gray-600 border-gray-300"
                                >
                                    Cancelled
                                </Badge>
                                <Badge
                                    variant="outline"
                                    className="ml-2 bg-blue-100 text-blue-800 border-blue-300"
                                >
                                    Rescheduled Class
                                </Badge>
                            </>
                        )}
                    </div>
                    {isRescheduledFrom && rescheduledDate ? (
                        <div className="text-xs text-gray-500 mt-0.5">
                            &rarr; Moved to {formatShortDate(rescheduledDate)}
                            {rescheduledClassTime &&
                                ` at ${rescheduledClassTime}`}
                        </div>
                    ) : (isRescheduledTo || isCancelledReschedule) ? (
                        <div className="text-xs text-blue-700 mt-0.5">
                            {session.instance.class_time}
                        </div>
                    ) : (
                        <div
                            className={`text-xs text-gray-600 mt-0.5 ${showLineThrough ? 'line-through' : ''}`}
                        >
                            {session.instance.class_time}
                        </div>
                    )}
                </div>
            </div>
            <div
                className="flex items-center gap-4"
                onClick={(e) => e.stopPropagation()}
            >
                {hasAttendance && !isRescheduledFrom && (
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
                {isPast &&
                    !hasAttendance &&
                    !isCancelled &&
                    !isRescheduledFrom && (
                        <Badge
                            variant="outline"
                            className="bg-amber-50 text-amber-700 border-amber-200"
                        >
                            Missing
                        </Badge>
                    )}
                {!isCancelled &&
                    !isUpcoming &&
                    !isRescheduledFrom && (
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onNavigateToAttendance()}
                            className="border-gray-300"
                        >
                            {hasAttendance ? 'Edit' : 'Take'} Attendance
                        </Button>
                    )}
                {isCancelled && isUpcoming && (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onUndo()}
                        className="border-gray-300 hover:bg-gray-50"
                    >
                        <Undo2 className="size-4 mr-1.5" />
                        Undo
                    </Button>
                )}
                {isRescheduledFrom && isUpcoming && (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onUndo()}
                        className="border-amber-300 hover:bg-amber-50"
                    >
                        <Undo2 className="size-4 mr-1.5" />
                        Undo
                    </Button>
                )}
                {isCancelledReschedule && isUpcoming && (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onUndoCancel()}
                        className="border-gray-300 hover:bg-gray-50"
                    >
                        <Undo2 className="size-4 mr-1.5" />
                        Undo
                    </Button>
                )}
                {isRescheduledTo && isUpcoming && !isSameDateReschedule && (
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
                            onClick={() => onUndo()}
                            className="border-gray-300 hover:bg-gray-50"
                            title="Undo reschedule"
                        >
                            <Undo2 className="size-4" />
                        </Button>
                    </>
                )}
                {isUpcoming &&
                    !isCancelled &&
                    !isRescheduledFrom &&
                    !isRescheduledTo &&
                    !isCancelledReschedule && (
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
