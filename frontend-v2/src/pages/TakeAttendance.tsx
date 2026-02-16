import { useState, useMemo, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import useSWR from 'swr';
import {
    Class,
    EnrollmentAttendance,
    Attendance,
    AttendanceReason,
    ServerResponseOne,
    ServerResponseMany
} from '@/types';
import { cn } from '@/lib/utils';
import API from '@/api/api';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';
import { ArrowLeft, Plus, Clock, Save } from 'lucide-react';

interface AttendanceEntry {
    userId: number;
    status: Attendance;
    note: string;
    reason?: AttendanceReason;
    clockInTime?: string;
    clockOutTime?: string;
    showNoteField?: boolean;
}

const statusConfig: {
    value: Attendance;
    label: string;
    activeClass: string;
}[] = [
    {
        value: Attendance.Present,
        label: 'Present',
        activeClass: 'bg-green-600 text-white border-green-600'
    },
    {
        value: Attendance.Partial,
        label: 'Partial',
        activeClass: 'bg-blue-600 text-white border-blue-600'
    },
    {
        value: Attendance.Absent_Excused,
        label: 'Excused',
        activeClass: 'bg-gray-600 text-white border-gray-600'
    },
    {
        value: Attendance.Absent_Unexcused,
        label: 'Unexcused',
        activeClass: 'bg-amber-600 text-white border-amber-600'
    }
];

const summaryConfig: {
    status: Attendance;
    label: string;
    bgClass: string;
    textClass: string;
}[] = [
    {
        status: Attendance.Present,
        label: 'Present',
        bgClass: 'bg-green-50 border-green-200',
        textClass: 'text-green-700'
    },
    {
        status: Attendance.Partial,
        label: 'Partial',
        bgClass: 'bg-blue-50 border-blue-200',
        textClass: 'text-blue-700'
    },
    {
        status: Attendance.Absent_Excused,
        label: 'Absent Excused',
        bgClass: 'bg-muted border-border',
        textClass: 'text-foreground'
    },
    {
        status: Attendance.Absent_Unexcused,
        label: 'Absent Unexcused',
        bgClass: 'bg-amber-50 border-amber-200',
        textClass: 'text-amber-700'
    }
];

function calculatePartialTime(
    clockIn?: string,
    clockOut?: string
): string | null {
    if (!clockIn || !clockOut) return null;
    const [inH, inM] = clockIn.split(':').map(Number);
    const [outH, outM] = clockOut.split(':').map(Number);
    const total = outH * 60 + outM - (inH * 60 + inM);
    if (total <= 0) return null;
    const h = Math.floor(total / 60);
    const m = total % 60;
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
}

function formatDateDisplay(dateStr: string): string {
    const [year, month, day] = dateStr.split('-').map(Number);
    const d = new Date(year, month - 1, day);
    return d.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

export default function TakeAttendance() {
    const { classId, date } = useParams<{ classId: string; date: string }>();
    const navigate = useNavigate();

    const { data: classResp } = useSWR<ServerResponseOne<Class>>(
        classId ? '/api/program-classes/' + classId : null
    );
    const classData = classResp?.data;

    const { data: enrollmentResp } = useSWR<
        ServerResponseMany<EnrollmentAttendance>
    >(
        classId && date
            ? '/api/program-classes/' + classId + '/attendance?date=' + date
            : null
    );
    const enrollments = enrollmentResp?.data ?? [];

    const [attendanceData, setAttendanceData] = useState<
        Record<number, AttendanceEntry>
    >({});
    const [isSaving, setIsSaving] = useState(false);

    const getEntry = useCallback(
        (userId: number): AttendanceEntry => {
            if (attendanceData[userId]) return attendanceData[userId];
            const existing = enrollments.find((e) => e.user_id === userId);
            return {
                userId,
                status: existing?.attendance_status ?? Attendance.Present,
                note: existing?.note ?? '',
                reason: existing?.reason_category
                    ? (existing.reason_category as AttendanceReason)
                    : undefined,
                clockInTime: existing?.check_in_at ?? '',
                clockOutTime: existing?.check_out_at ?? '',
                showNoteField: !!existing?.note
            };
        },
        [attendanceData, enrollments]
    );

    const updateEntry = useCallback(
        (userId: number, updates: Partial<AttendanceEntry>) => {
            setAttendanceData((prev) => {
                const current = prev[userId] ?? getEntry(userId);
                return { ...prev, [userId]: { ...current, ...updates } };
            });
        },
        [getEntry]
    );

    const handleMarkAllPresent = useCallback(() => {
        const next: Record<number, AttendanceEntry> = {};
        enrollments.forEach((e) => {
            next[e.user_id] = {
                userId: e.user_id,
                status: Attendance.Present,
                note: '',
                showNoteField: false
            };
        });
        setAttendanceData(next);
    }, [enrollments]);

    const handleSave = async () => {
        setIsSaving(true);
        const entries = enrollments.map((e) => {
            const entry = getEntry(e.user_id);
            return {
                userId: entry.userId,
                status: entry.status,
                note: entry.note,
                reason: entry.reason,
                clockInTime: entry.clockInTime,
                clockOutTime: entry.clockOutTime
            };
        });
        await API.post('program-classes/' + classId + '/attendance', {
            date,
            entries
        });
        navigate('/program-classes/' + classId);
    };

    const statusCounts = useMemo(() => {
        const counts: Record<Attendance, number> = {
            [Attendance.Present]: 0,
            [Attendance.Partial]: 0,
            [Attendance.Absent_Excused]: 0,
            [Attendance.Absent_Unexcused]: 0
        };
        enrollments.forEach((e) => {
            const entry = getEntry(e.user_id);
            counts[entry.status]++;
        });
        return counts;
    }, [enrollments, getEntry]);

    return (
        <div className="space-y-6">
            <div className="bg-card rounded-lg border p-5 space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                                navigate('/program-classes/' + classId)
                            }
                        >
                            <ArrowLeft className="size-4" />
                            Back to Class
                        </Button>
                        <div>
                            <h1 className="text-xl font-bold">
                                Take Attendance
                            </h1>
                            <p className="text-sm text-muted-foreground">
                                {classData?.name}
                                {date && ' - ' + formatDateDisplay(date)}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleMarkAllPresent}
                        >
                            Mark All Present
                        </Button>
                        <Button
                            size="sm"
                            className="bg-[#556830] text-white hover:bg-[#556830]/90"
                            onClick={handleSave}
                            disabled={isSaving}
                        >
                            <Save className="size-4" />
                            {isSaving ? 'Saving...' : 'Save Attendance'}
                        </Button>
                    </div>
                </div>

                <div className="grid grid-cols-4 gap-3">
                    {summaryConfig.map((cfg) => (
                        <div
                            key={cfg.status}
                            className={cn(
                                'rounded-lg border px-4 py-3 text-center',
                                cfg.bgClass
                            )}
                        >
                            <p className={cn('text-2xl font-bold', cfg.textClass)}>
                                {statusCounts[cfg.status]}
                            </p>
                            <p className="text-xs text-muted-foreground">
                                {cfg.label}
                            </p>
                        </div>
                    ))}
                </div>
            </div>

            <div className="bg-card rounded-lg border">
                <div className="px-5 py-4 border-b">
                    <h2 className="font-semibold">
                        Roster ({enrollments.length})
                    </h2>
                </div>
                <div className="divide-y">
                    {enrollments.map((enrollment) => (
                        <AttendanceRow
                            key={enrollment.user_id}
                            enrollment={enrollment}
                            entry={getEntry(enrollment.user_id)}
                            onUpdate={(updates) =>
                                updateEntry(enrollment.user_id, updates)
                            }
                        />
                    ))}
                    {enrollments.length === 0 && (
                        <div className="text-center py-8 text-muted-foreground">
                            No enrollments found for this class.
                        </div>
                    )}
                </div>
            </div>

            <div className="flex items-center justify-end gap-3">
                <Button
                    variant="outline"
                    onClick={() => navigate('/program-classes/' + classId)}
                >
                    Cancel
                </Button>
                <Button
                    className="bg-[#556830] text-white hover:bg-[#556830]/90"
                    onClick={handleSave}
                    disabled={isSaving}
                >
                    <Save className="size-4" />
                    {isSaving ? 'Saving...' : 'Save Attendance'}
                </Button>
            </div>
        </div>
    );
}

function AttendanceRow({
    enrollment,
    entry,
    onUpdate
}: {
    enrollment: EnrollmentAttendance;
    entry: AttendanceEntry;
    onUpdate: (updates: Partial<AttendanceEntry>) => void;
}) {
    const isPartial = entry.status === Attendance.Partial;
    const isAbsent =
        entry.status === Attendance.Absent_Excused ||
        entry.status === Attendance.Absent_Unexcused;
    const showReasonSelect = isPartial || isAbsent;
    const partialTime = isPartial
        ? calculatePartialTime(entry.clockInTime, entry.clockOutTime)
        : null;

    return (
        <div className="px-5 py-4 space-y-3">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div>
                        <p className="font-medium">
                            {enrollment.name_last}, {enrollment.name_first}
                        </p>
                        <p className="text-xs text-muted-foreground">
                            ID: {enrollment.doc_id}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    {statusConfig.map((cfg) => (
                        <button
                            key={cfg.value}
                            type="button"
                            onClick={() => onUpdate({ status: cfg.value })}
                            className={cn(
                                'px-3 py-1.5 text-xs font-medium rounded border transition-colors',
                                entry.status === cfg.value
                                    ? cfg.activeClass
                                    : 'bg-card text-muted-foreground border-gray-300 hover:bg-muted'
                            )}
                        >
                            {cfg.label}
                        </button>
                    ))}
                </div>
            </div>

            {isPartial && (
                <div className="flex items-center gap-4 pl-4">
                    <div className="flex items-center gap-2">
                        <Clock className="size-4 text-muted-foreground" />
                        <label className="text-xs text-muted-foreground">
                            In:
                        </label>
                        <Input
                            type="time"
                            className="w-32 h-8 text-sm"
                            value={entry.clockInTime ?? ''}
                            onChange={(e) =>
                                onUpdate({ clockInTime: e.target.value })
                            }
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <label className="text-xs text-muted-foreground">
                            Out:
                        </label>
                        <Input
                            type="time"
                            className="w-32 h-8 text-sm"
                            value={entry.clockOutTime ?? ''}
                            onChange={(e) =>
                                onUpdate({ clockOutTime: e.target.value })
                            }
                        />
                    </div>
                    {partialTime && (
                        <span className="text-xs font-medium text-blue-600">
                            Total: {partialTime}
                        </span>
                    )}
                </div>
            )}

            {showReasonSelect && (
                <div className="pl-4">
                    <Select
                        value={entry.reason ?? ''}
                        onValueChange={(v) =>
                            onUpdate({ reason: v as AttendanceReason })
                        }
                    >
                        <SelectTrigger className="w-48 h-8 text-sm">
                            <SelectValue placeholder="Select reason" />
                        </SelectTrigger>
                        <SelectContent>
                            {Object.values(AttendanceReason).map((reason) => (
                                <SelectItem key={reason} value={reason}>
                                    {reason}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            )}

            <div className="pl-4">
                {entry.showNoteField ? (
                    <Textarea
                        placeholder="Add a note..."
                        className="text-sm"
                        value={entry.note}
                        onChange={(e) => onUpdate({ note: e.target.value })}
                        rows={2}
                    />
                ) : (
                    <button
                        type="button"
                        onClick={() => onUpdate({ showNoteField: true })}
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <Plus className="size-3" />
                        Add a note
                    </button>
                )}
            </div>
        </div>
    );
}
