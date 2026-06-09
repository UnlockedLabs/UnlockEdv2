import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import useSWR from 'swr';
import { CheckCircle, AlertCircle, Calendar } from 'lucide-react';
import { FormModal } from '@/components/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ClassEventInstance } from '@/types/events';
import { Attendance } from '@/types/attendance';
import { ServerResponseMany } from '@/types/server';

interface TakeAttendanceModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    classId: number;
    className: string;
}

interface SessionItem {
    date: string;
    dateObj: Date;
    eventId: number;
    hasAttendance: boolean;
    attendedCount: number;
    totalRecords: number;
    isCancelled: boolean;
}

function buildRecentSessions(instances: ClassEventInstance[]): SessionItem[] {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const cutoff = new Date(today);
    cutoff.setDate(cutoff.getDate() - 30);

    const sessions: SessionItem[] = [];

    for (const inst of instances) {
        if (inst.is_cancelled) continue;

        const [y, m, d] = inst.date.split('-').map(Number);
        const dateObj = new Date(y, m - 1, d);

        if (dateObj > today || dateObj < cutoff) continue;

        const records = inst.attendance_records ?? [];
        const hasAttendance = records.length > 0;
        const attendedCount = records.filter(
            (r) =>
                r.attendance_status === Attendance.Present ||
                r.attendance_status === Attendance.Partial
        ).length;

        sessions.push({
            date: inst.date,
            dateObj,
            eventId: inst.event_id ?? inst.id,
            hasAttendance,
            attendedCount,
            totalRecords: records.length,
            isCancelled: false
        });
    }

    sessions.sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());
    return sessions;
}

export function TakeAttendanceModal({
    open,
    onOpenChange,
    classId,
    className
}: TakeAttendanceModalProps) {
    const navigate = useNavigate();

    const { data: eventsResp } = useSWR<ServerResponseMany<ClassEventInstance>>(
        open ? `/api/program-classes/${classId}/events?all=true` : null
    );

    const sessions = useMemo(() => {
        return buildRecentSessions(eventsResp?.data ?? []);
    }, [eventsResp]);

    const todaySession = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return (
            sessions.find((s) => s.dateObj.getTime() === today.getTime()) ??
            null
        );
    }, [sessions]);

    const pastSessions = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return sessions.filter((s) => s.dateObj.getTime() !== today.getTime());
    }, [sessions]);

    const missingCount = pastSessions.filter((s) => !s.hasAttendance).length;

    const handleSelectSession = (session: SessionItem) => {
        onOpenChange(false);
        navigate(
            `/program-classes/${classId}/events/${session.eventId}/attendance/${session.date}`
        );
    };

    const handleCustomDate = (value: string) => {
        if (!value) return;
        const matched = sessions.find((s) => s.date === value);
        if (matched) {
            handleSelectSession(matched);
            return;
        }
        const event = (eventsResp?.data ?? []).find((e) => !e.is_cancelled);
        if (event) {
            onOpenChange(false);
            navigate(
                `/program-classes/${classId}/events/${event.event_id ?? event.id}/attendance/${value}`
            );
        }
    };

    const todayStr = new Date().toISOString().split('T')[0];

    return (
        <FormModal
            open={open}
            onOpenChange={onOpenChange}
            title={`Take Attendance - ${className}`}
            description="Select which session you'd like to record or edit attendance for."
            className="max-w-2xl"
            titleClassName="text-foreground"
        >
            <div className="space-y-4 mt-4">
                {todaySession && (
                    <div className="bg-surface-hover rounded-lg p-4 border-2 border-brand">
                        <div className="flex items-center gap-2 mb-2">
                            <Calendar className="size-5 text-brand" />
                            <span className="font-semibold text-brand-dark">
                                Today's Session
                            </span>
                            <Badge className="bg-brand-gold text-brand-dark">
                                {todaySession.dateObj.toLocaleDateString(
                                    'en-US',
                                    {
                                        weekday: 'long',
                                        month: 'short',
                                        day: 'numeric'
                                    }
                                )}
                            </Badge>
                        </div>
                        <Button
                            onClick={() => handleSelectSession(todaySession)}
                            variant="brand"
                            className="w-full"
                        >
                            {todaySession.hasAttendance
                                ? `Edit Today's Attendance (${todaySession.attendedCount}/${todaySession.totalRecords})`
                                : 'Take Attendance for Today'}
                        </Button>
                    </div>
                )}

                <div>
                    <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-semibold text-brand-dark">
                            Recent Sessions (Last 30 Days)
                        </h4>
                        {missingCount > 0 && (
                            <Badge variant="outline" className="badge-amber">
                                <AlertCircle className="size-3 mr-1" />
                                {missingCount} missing
                            </Badge>
                        )}
                    </div>

                    <div className="max-h-75 overflow-y-auto space-y-2 pr-2">
                        {pastSessions.length === 0 ? (
                            <p className="text-center text-gray-500 py-6 text-sm">
                                No past sessions in the last 30 days.
                            </p>
                        ) : (
                            pastSessions.map((session) => (
                                <button
                                    key={session.date}
                                    onClick={() => handleSelectSession(session)}
                                    className={`w-full text-left p-3 rounded-lg border transition-colors ${
                                        session.hasAttendance
                                            ? 'border-gray-200 hover:border-brand hover:bg-surface-hover/30'
                                            : 'border-amber-200 bg-amber-50/30 hover:border-amber-400 hover:bg-amber-50'
                                    }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            {session.hasAttendance ? (
                                                <CheckCircle className="size-5 text-brand flex-shrink-0" />
                                            ) : (
                                                <AlertCircle className="size-5 text-brand-gold flex-shrink-0" />
                                            )}
                                            <div>
                                                <div className="text-sm font-medium text-brand-dark">
                                                    {session.dateObj.toLocaleDateString(
                                                        'en-US',
                                                        {
                                                            weekday: 'long',
                                                            month: 'short',
                                                            day: 'numeric'
                                                        }
                                                    )}
                                                </div>
                                                <div className="text-xs text-gray-600 mt-0.5">
                                                    {session.hasAttendance
                                                        ? `${session.attendedCount} / ${session.totalRecords} attended`
                                                        : 'Missing attendance'}
                                                </div>
                                            </div>
                                        </div>
                                        <span className="text-xs text-gray-500 font-medium">
                                            {session.hasAttendance
                                                ? 'Edit'
                                                : 'Take'}
                                        </span>
                                    </div>
                                </button>
                            ))
                        )}
                    </div>
                </div>

                <div className="pt-3 border-t border-gray-200">
                    <p className="text-sm text-gray-600 mb-2">
                        Need an older date?
                    </p>
                    <Input
                        type="date"
                        max={todayStr}
                        onChange={(e) => handleCustomDate(e.target.value)}
                        className="w-full"
                    />
                </div>
            </div>
        </FormModal>
    );
}
