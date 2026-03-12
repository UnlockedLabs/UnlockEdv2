import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import useSWR from 'swr';
import { CheckCircle, AlertCircle, Calendar } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ClassEventInstance } from '@/types/events';
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

function buildRecentSessions(
    instances: ClassEventInstance[]
): SessionItem[] {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const cutoff = new Date(today);
    cutoff.setDate(cutoff.getDate() - 30);

    const sessions: SessionItem[] = [];

    for (const inst of instances) {
        if (inst.is_cancelled) continue;

        const [y, m, d] = inst.date.split('-').map(Number);
        const dateObj = new Date(y!, m! - 1, d!);

        if (dateObj > today || dateObj < cutoff) continue;

        const records = inst.attendance_records ?? [];
        const hasAttendance = records.length > 0;
        const attendedCount = records.filter(
            (r) =>
                r.attendance_status === 'present' ||
                r.attendance_status === 'partial'
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

    const { data: eventsResp } = useSWR<
        ServerResponseMany<ClassEventInstance>
    >(open ? `/api/program-classes/${classId}/events` : null);

    const sessions = useMemo(() => {
        return buildRecentSessions(eventsResp?.data ?? []);
    }, [eventsResp]);

    const todaySession = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return sessions.find(
            (s) => s.dateObj.getTime() === today.getTime()
        ) ?? null;
    }, [sessions]);

    const pastSessions = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return sessions.filter(
            (s) => s.dateObj.getTime() !== today.getTime()
        );
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
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle className="text-[#203622]">
                        Take Attendance - {className}
                    </DialogTitle>
                    <DialogDescription>
                        Select which session you'd like to record or edit
                        attendance for.
                    </DialogDescription>
                </DialogHeader>

                <div className="mt-2 space-y-5">
                    {todaySession && (
                        <div className="rounded-lg border-2 border-[#F1B51C] p-4 space-y-3">
                            <div className="flex items-center gap-2">
                                <Calendar className="size-5 text-[#203622]" />
                                <span className="font-semibold text-[#203622]">
                                    Today's Session
                                </span>
                                <Badge className="bg-[#F1B51C] text-[#203622] border-0 ml-1">
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
                                onClick={() =>
                                    handleSelectSession(todaySession)
                                }
                                className="w-full bg-[#556830] text-white hover:bg-[#203622]"
                            >
                                {todaySession.hasAttendance
                                    ? `Edit Today's Attendance (${todaySession.attendedCount}/${todaySession.totalRecords})`
                                    : "Take Today's Attendance"}
                            </Button>
                        </div>
                    )}

                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <h4 className="text-sm font-semibold text-[#203622]">
                                Recent Sessions (Last 30 Days)
                            </h4>
                            {missingCount > 0 && (
                                <Badge
                                    variant="outline"
                                    className="bg-amber-50 text-amber-700 border-amber-200 flex items-center gap-1"
                                >
                                    <AlertCircle className="size-3" />
                                    {missingCount} missing
                                </Badge>
                            )}
                        </div>

                        <div className="max-h-[300px] overflow-y-auto space-y-2 pr-1">
                            {pastSessions.length === 0 ? (
                                <p className="text-center text-gray-500 py-6 text-sm">
                                    No past sessions in the last 30 days.
                                </p>
                            ) : (
                                pastSessions.map((session) => (
                                    <button
                                        key={session.date}
                                        onClick={() =>
                                            handleSelectSession(session)
                                        }
                                        className={`w-full flex items-center justify-between p-3 rounded-lg border transition-colors text-left ${
                                            session.hasAttendance
                                                ? 'border-gray-200 hover:bg-[#E2E7EA]/30'
                                                : 'border-amber-200 bg-amber-50/30 hover:bg-amber-50'
                                        }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            {session.hasAttendance ? (
                                                <CheckCircle className="size-5 text-[#556830] shrink-0" />
                                            ) : (
                                                <AlertCircle className="size-5 text-[#F1B51C] shrink-0" />
                                            )}
                                            <div>
                                                <div className="text-sm font-medium text-[#203622]">
                                                    {session.dateObj.toLocaleDateString(
                                                        'en-US',
                                                        {
                                                            weekday: 'long',
                                                            month: 'short',
                                                            day: 'numeric'
                                                        }
                                                    )}
                                                </div>
                                                <div className="text-xs text-gray-500 mt-0.5">
                                                    {session.hasAttendance
                                                        ? `${session.attendedCount} / ${session.totalRecords} attended`
                                                        : 'Missing attendance'}
                                                </div>
                                            </div>
                                        </div>
                                        <span className="text-sm text-gray-500">
                                            {session.hasAttendance
                                                ? 'Edit'
                                                : 'Take'}
                                        </span>
                                    </button>
                                ))
                            )}
                        </div>
                    </div>

                    <div className="pt-4 border-t border-gray-200">
                        <label className="text-sm text-gray-500 mb-2 block">
                            Need an older date?
                        </label>
                        <Input
                            type="date"
                            max={todayStr}
                            onChange={(e) => handleCustomDate(e.target.value)}
                        />
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
