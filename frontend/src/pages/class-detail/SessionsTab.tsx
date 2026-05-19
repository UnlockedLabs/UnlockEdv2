import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { useNavigate } from 'react-router-dom';
import { Calendar, AlertCircle } from 'lucide-react';
import API from '@/api/api';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Class } from '@/types/program';
import { ClassEventInstance } from '@/types/events';
import { ServerResponseMany } from '@/types/server';
import { BulkCancelSession } from './BulkCancelSessionsModal';
import { ChangeInstructorSession } from './ChangeInstructorModal';
import { ChangeRoomSession } from './ChangeRoomModal';
import { SessionRow } from './SessionRow';
import { SessionsTabFilterBar } from './SessionsTabFilterBar';
import { SessionsTabBulkActions } from './SessionsTabBulkActions';
import { SessionsTabModals } from './SessionsTabModals';
import {
    buildRescheduleMaps,
    buildRoomOverrideMap,
    buildCancellationReasonMap,
    buildSessionDisplays,
    findCancelOverrideId,
    buildSessionPayload,
    type SessionDisplay
} from './session-utils';
import {
    useSessionFilters,
    PAST_DISPLAY_LIMIT,
    UPCOMING_DISPLAY_LIMIT,
    type StatusFilter,
    type TimeFilter
} from './useSessionFilters';

interface SessionsTabProps {
    cls: Class;
    onClassMutate: () => void;
}

export type { SessionDisplay } from './session-utils';

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

    const {
        filtered,
        pastAndTodaySessions,
        upcomingSessions,
        displayedPast,
        displayedUpcoming
    } = useSessionFilters({
        allSessions,
        statusFilter,
        timeFilter,
        showAllPast
    });

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
            <SessionsTabFilterBar
                statusFilter={statusFilter}
                timeFilter={timeFilter}
                stats={stats}
                hideTimeFilter={hideTimeFilter}
                onStatusChange={handleStatusChange}
                onTimeChange={handleTimeChange}
            />

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

            <SessionsTabModals
                cls={cls}
                allSessions={allSessions}
                roomOverrides={roomOverrides}
                rescheduleTarget={rescheduleTarget}
                onCloseReschedule={() => setRescheduleTarget(null)}
                quickCancelSession={quickCancelSession}
                showQuickCancel={showQuickCancel}
                onQuickCancelOpenChange={(open) => {
                    setShowQuickCancel(open);
                    if (!open) setQuickCancelSession(null);
                }}
                onQuickCancelSuccess={() => {
                    setShowQuickCancel(false);
                    setQuickCancelSession(null);
                    void refreshData();
                }}
                showBulkCancelModal={showBulkCancelModal}
                onBulkCancelOpenChange={setShowBulkCancelModal}
                cancelSessions={cancelSessions}
                onBulkCancelled={() => {
                    setSelectedDates(new Set());
                    setCancelSessions([]);
                    void refreshData();
                }}
                showChangeInstructor={showChangeInstructor}
                onCloseChangeInstructor={() => setShowChangeInstructor(false)}
                changeInstructorSessions={changeInstructorSessions}
                onInstructorChanged={() => {
                    setSelectedDates(new Set());
                    void refreshData();
                }}
                showChangeRoom={showChangeRoom}
                onCloseChangeRoom={() => setShowChangeRoom(false)}
                changeRoomSessions={changeRoomSessions}
                onRoomChanged={() => {
                    setSelectedDates(new Set());
                    void refreshData();
                }}
                selectedSession={selectedSession}
                onCloseDetailSheet={() => setSelectedSession(null)}
                onMutate={() => void refreshData()}
                onSelectedSessionUndo={() => {
                    if (selectedSession) void handleUndo(selectedSession);
                }}
                onSelectedSessionUndoCancel={() => {
                    if (selectedSession) void handleUndoCancel(selectedSession);
                }}
                onSelectedSessionUndoReschedule={() => {
                    if (selectedSession) void handleUndo(selectedSession);
                }}
            />

            <SessionsTabBulkActions
                selectedCount={selectedUpcomingSessions.length}
                onClearSelection={() => setSelectedDates(new Set())}
                onBulkCancelClick={() => {
                    setCancelSessions(
                        selectedUpcomingSessions.map((s) => ({
                            date: s.instance.date,
                            dateObj: s.dateObj,
                            dayName: s.dayName,
                            eventId:
                                s.instance.event_id ?? s.instance.id,
                            classTime: s.instance.class_time
                        }))
                    );
                    setShowBulkCancelModal(true);
                }}
                onChangeInstructorClick={() =>
                    openChangeInstructor(selectedUpcomingSessions)
                }
                onChangeRoomClick={() =>
                    openChangeRoom(selectedUpcomingSessions)
                }
            />
        </div>
    );
}


