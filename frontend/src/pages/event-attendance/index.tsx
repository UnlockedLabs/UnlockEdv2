import { useEffect, useState, useMemo } from 'react';
import {
    useParams,
    useNavigate,
    useLoaderData,
    Navigate
} from 'react-router-dom';
import useSWR from 'swr';
import { toast } from 'sonner';
import {
    Save,
    CheckCircle,
    Clock,
    AlertCircle,
    XCircle
} from 'lucide-react';
import API from '@/api/api';
import {
    EnrollmentAttendance,
    Attendance,
    AttendanceReason,
    BreadcrumbItem,
    ClassLoaderData,
    ServerResponseMany
} from '@/types';
import { ClassEventInstance } from '@/types/events';
import {
    parseLocalDay,
    formatTimeHM,
    diffMinutes,
    formatPartialTime
} from '@/lib/formatters';
import { PageHeader } from '@/components/shared';
import Breadcrumbs from '@/components/navigation/Breadcrumbs';
import { ATTENDANCE_STATUSES } from './constants';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';
import { TooltipProvider } from '@/components/ui/tooltip';

const isoRE = /^\d{4}-\d{2}-\d{2}$/;

const ATTENDANCE_REASON_VALUES = Object.values(AttendanceReason) as string[];

function toAttendanceReason(value?: string): AttendanceReason | '' {
    if (!value) return '';
    return ATTENDANCE_REASON_VALUES.includes(value)
        ? (value as AttendanceReason)
        : '';
}

interface RowState {
    user_id: number;
    attendance_id?: number;
    doc_id: string;
    name_last: string;
    name_first: string;
    status: Attendance | '';
    note: string;
    reason: AttendanceReason | '';
    check_in_at: string;
    check_out_at: string;
    showNoteField: boolean;
    dirty: boolean;
}

export default function EventAttendance() {
    const { class_id, event_id, date } = useParams<{
        event_id: string;
        class_id: string;
        date: string;
    }>();
    const navigate = useNavigate();
    const loaderData = useLoaderData() as ClassLoaderData;
    const className = loaderData?.class?.name ?? '';
    const [rows, setRows] = useState<RowState[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [initialized, setInitialized] = useState(false);

    const { data, isLoading, error, mutate } = useSWR<
        ServerResponseMany<EnrollmentAttendance>,
        Error
    >(
        `/api/program-classes/${class_id}/events/${event_id}/attendance?date=${date}&per_page=200`
    );

    const [yyyy, mm] = (date ?? '').split('-');

    const { data: dates, isLoading: datesLoading } = useSWR<{
        message: string;
        data: ClassEventInstance[];
    }>(
        `/api/program-classes/${class_id}/events?month=${mm}&year=${yyyy}&dates=true&event_id=${event_id}`
    );

    const scheduledTimes = useMemo(() => {
        const match = Array.isArray(dates?.data)
            ? dates.data.find(
                  (d) =>
                      d.event_id === Number(event_id) && d.date === date
              )
            : undefined;
        if (match?.class_time?.includes?.('-')) {
            const [start = '', end = ''] =
                match.class_time.split('-').map((p) => p.trim()) ?? [];
            return { check_in_at: start, check_out_at: end };
        }
        return { check_in_at: '', check_out_at: '' };
    }, [dates?.data, event_id, date]);

    useEffect(() => {
        if (!data?.data || initialized) return;
        const defaultCheckIn = scheduledTimes.check_in_at || '';
        const mapped: RowState[] = data.data.map((item) => {
            const hasExisting = !!item.attendance_status;
            return {
                user_id: item.user_id,
                attendance_id: item.attendance_id,
                doc_id: item.doc_id ?? '',
                name_last: item.name_last,
                name_first: item.name_first,
                status: item.attendance_status ?? '',
                note: item.note ?? '',
                reason: toAttendanceReason(item.reason_category),
                check_in_at: item.check_in_at ?? (hasExisting ? '' : defaultCheckIn),
                check_out_at: item.check_out_at ?? '',
                showNoteField: !!(item.note?.trim()),
                dirty: false
            };
        });
        setRows(mapped);
        setInitialized(true);
    }, [data, initialized, scheduledTimes]);

    if (!date || !isoRE.test(date)) {
        return <Navigate to="/404" replace />;
    }

    const day = parseLocalDay(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const isFutureDay = day > today;

    if (datesLoading || isLoading) {
        return (
            <div className="min-h-[calc(100vh-4rem)] bg-[#E2E7EA] flex items-center justify-center">
                <div className="text-gray-500">Loading...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-[calc(100vh-4rem)] bg-[#E2E7EA] flex items-center justify-center">
                <div className="text-red-600">Error loading attendance data</div>
            </div>
        );
    }

    const dateList = Array.isArray(dates?.data) ? dates.data : [];
    const scheduled = dateList.some(
        (d) => d.event_id === Number(event_id) && d.date === date
    );

    if (!scheduled) {
        return (
            <div className="min-h-[calc(100vh-4rem)] bg-[#E2E7EA] flex items-center justify-center">
                <div className="text-red-600">
                    No class session was scheduled for this date.
                </div>
            </div>
        );
    }

    if (isFutureDay) {
        return (
            <div className="min-h-[calc(100vh-4rem)] bg-[#E2E7EA] flex items-center justify-center">
                <div className="text-red-600">
                    This session is scheduled for a future date. Attendance
                    will be available after it occurs.
                </div>
            </div>
        );
    }

    const formattedDate = day.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    const breadcrumbItems: BreadcrumbItem[] = (
        loaderData?.breadcrumbs ?? []
    ).map((item, idx, arr) =>
        idx === arr.length - 1
            ? { ...item, label: `Take Attendance - ${formattedDate}` }
            : item
    );

    const summary = {
        present: rows.filter((r) => r.status === Attendance.Present).length,
        partial: rows.filter((r) => r.status === Attendance.Partial).length,
        absentExcused: rows.filter(
            (r) => r.status === Attendance.Absent_Excused
        ).length,
        absentUnexcused: rows.filter(
            (r) => r.status === Attendance.Absent_Unexcused
        ).length
    };

    function updateRow(userId: number, patch: Partial<RowState>) {
        setRows((prev) =>
            prev.map((r) =>
                r.user_id === userId ? { ...r, ...patch, dirty: true } : r
            )
        );
    }

    function handleStatusChange(userId: number, status: Attendance) {
        const isPresentLike =
            status === Attendance.Present || status === Attendance.Partial;
        const defaults =
            status === Attendance.Present
                ? {
                      check_in_at:
                          rows.find((r) => r.user_id === userId)
                              ?.check_in_at ??
                          scheduledTimes.check_in_at ??
                          formatTimeHM(new Date()),
                      check_out_at:
                          rows.find((r) => r.user_id === userId)
                              ?.check_out_at ?? ''
                  }
                : {};

        const current = rows.find((r) => r.user_id === userId);
        updateRow(userId, {
            status,
            ...(status !== Attendance.Partial && {
                check_in_at: isPresentLike
                    ? defaults.check_in_at ?? ''
                    : '',
                check_out_at: isPresentLike
                    ? defaults.check_out_at ?? ''
                    : ''
            }),
            reason: isPresentLike
                ? ''
                : current?.reason ?? AttendanceReason.Lockdown,
            showNoteField: current?.showNoteField && !!(current?.note?.trim())
        });
    }

    function handleMarkAllPresent() {
        const defaultCheckIn =
            scheduledTimes.check_in_at || formatTimeHM(new Date());
        setRows((prev) =>
            prev.map((r) => ({
                ...r,
                status: Attendance.Present,
                reason: '',
                check_in_at: r.check_in_at || defaultCheckIn,
                showNoteField: false,
                dirty: true
            }))
        );
    }

    async function handleSave() {
        const dirtyRows = rows.filter((r) => r.dirty);
        if (dirtyRows.length === 0) {
            toast.info('No changes to save');
            return;
        }

        const missingStatus = dirtyRows.find((r) => r.status === '');
        if (missingStatus) {
            toast.error('All modified residents must have a status selected');
            return;
        }

        const missingCheckin = dirtyRows.find(
            (r) =>
                (r.status === Attendance.Present ||
                    r.status === Attendance.Partial) &&
                !r.check_in_at
        );
        if (missingCheckin) {
            toast.error('Check-in time is required for present residents');
            return;
        }

        const payload = dirtyRows.map((row) => ({
            id: row.attendance_id,
            user_id: row.user_id,
            event_id: Number(event_id),
            date,
            attendance_status: row.status,
            note: row.note ?? '',
            reason_category: row.reason ?? '',
            check_in_at: row.check_in_at || null,
            check_out_at: row.check_out_at || null
        }));

        setIsSaving(true);
        try {
            await API.post(
                `program-classes/${class_id}/events/${event_id}/attendance`,
                payload
            );
            toast.success('Attendance saved successfully');
            void mutate();
            navigate(`/program-classes/${class_id}/detail`);
        } catch {
            toast.error('Failed to save attendance');
        } finally {
            setIsSaving(false);
        }
    }

    return (
        <div className="min-h-[calc(100vh-4rem)] bg-[#E2E7EA]">
            <div className="bg-white border-b border-gray-200">
                <div className="max-w-5xl mx-auto px-6 py-6">
                    {breadcrumbItems.length > 0 && (
                        <Breadcrumbs items={breadcrumbItems} />
                    )}
                    <PageHeader
                        title="Take Attendance"
                        subtitle={className}
                        meta={formattedDate}
                        actions={
                            <>
                                <Button
                                    variant="outline"
                                    onClick={handleMarkAllPresent}
                                    className="border-gray-300"
                                >
                                    Mark All Present
                                </Button>
                                <Button
                                    onClick={() => { void handleSave(); }}
                                    disabled={isSaving}
                                    className="bg-[#556830] hover:bg-[#203622] text-white gap-2"
                                >
                                    <Save className="size-4" />
                                    {isSaving ? 'Saving...' : 'Save Attendance'}
                                </Button>
                            </>
                        }
                    />

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mt-6">
                        <SummaryStatCard
                            tone="green"
                            icon={CheckCircle}
                            label="Present"
                            value={summary.present}
                        />
                        <SummaryStatCard
                            tone="blue"
                            icon={Clock}
                            label="Partial"
                            value={summary.partial}
                        />
                        <SummaryStatCard
                            tone="purple"
                            icon={AlertCircle}
                            label="Absent (Excused)"
                            value={summary.absentExcused}
                        />
                        <SummaryStatCard
                            tone="amber"
                            icon={XCircle}
                            label="Absent (Unexcused)"
                            value={summary.absentUnexcused}
                        />
                    </div>
                </div>
            </div>

            <div className="max-w-5xl mx-auto px-6 py-6">
                <div className="bg-white rounded-lg border border-gray-200">
                    <div className="border-b border-gray-200 px-6 py-4">
                        <h3 className="text-[#203622] font-semibold">
                            Roster ({rows.length})
                        </h3>
                        <p className="text-sm text-gray-600 mt-1">
                            Mark attendance status for each resident
                        </p>
                    </div>
                    <TooltipProvider>
                        <div className="divide-y divide-gray-200">
                            {rows.length === 0 ? (
                                <div className="text-center py-12 text-gray-500">
                                    No enrolled residents for this session.
                                </div>
                            ) : (
                                rows.map((row) => (
                                    <AttendanceRowCard
                                        key={row.user_id}
                                        row={row}
                                        onStatusChange={handleStatusChange}
                                        onUpdate={updateRow}
                                        scheduledTimes={scheduledTimes}
                                    />
                                ))
                            )}
                        </div>
                    </TooltipProvider>
                </div>

                <div className="mt-6 flex justify-end gap-3">
                    <Button
                        variant="outline"
                        onClick={() =>
                            navigate(
                                `/program-classes/${class_id}/detail`
                            )
                        }
                        className="border-gray-300"
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={() => { void handleSave(); }}
                        disabled={isSaving}
                        className="bg-[#556830] hover:bg-[#203622] text-white gap-2"
                    >
                        <Save className="size-4" />
                        {isSaving ? 'Saving...' : 'Save Attendance'}
                    </Button>
                </div>
            </div>
        </div>
    );
}

type SummaryTone = 'green' | 'blue' | 'purple' | 'amber';

const SUMMARY_TONE: Record<
    SummaryTone,
    { bg: string; border: string; icon: string }
> = {
    green: {
        bg: 'bg-green-50',
        border: 'border-green-200',
        icon: 'text-[#556830]'
    },
    blue: {
        bg: 'bg-blue-50',
        border: 'border-blue-200',
        icon: 'text-blue-600'
    },
    purple: {
        bg: 'bg-purple-50',
        border: 'border-purple-200',
        icon: 'text-purple-600'
    },
    amber: {
        bg: 'bg-amber-50',
        border: 'border-amber-200',
        icon: 'text-amber-600'
    }
};

function SummaryStatCard({
    tone,
    icon: Icon,
    label,
    value
}: {
    tone: SummaryTone;
    icon: typeof CheckCircle;
    label: string;
    value: number;
}) {
    const classes = SUMMARY_TONE[tone];
    return (
        <div
            className={`${classes.bg} border ${classes.border} rounded-lg p-4`}
        >
            <div className="flex items-center gap-2 mb-1">
                <Icon className={`size-5 ${classes.icon}`} />
                <span className="text-sm text-gray-700">{label}</span>
            </div>
            <div className="text-2xl text-[#203622]">{value}</div>
        </div>
    );
}

function AttendanceRowCard({
    row,
    onStatusChange,
    onUpdate
}: {
    row: RowState;
    onStatusChange: (userId: number, status: Attendance) => void;
    onUpdate: (userId: number, patch: Partial<RowState>) => void;
    scheduledTimes: { check_in_at: string; check_out_at: string };
}) {
    const isPresent = row.status === Attendance.Present;
    const isPartial = row.status === Attendance.Partial;
    const isAbsent =
        row.status === Attendance.Absent_Excused ||
        row.status === Attendance.Absent_Unexcused;

    const partialTime = isPartial
        ? formatPartialTime(diffMinutes(row.check_in_at, row.check_out_at))
        : null;

    return (
        <div className="px-4 sm:px-6 py-5 hover:bg-[#E2E7EA]/30 transition-colors">
            <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                <div className="min-w-[70px] sm:min-w-[100px] shrink-0">
                    <div className="text-[#203622] font-medium">
                        {row.doc_id}
                    </div>
                    <div className="text-sm text-gray-600 mt-0.5">
                        {row.name_last}, {row.name_first}
                    </div>
                </div>

                <div className="flex gap-2 flex-wrap">
                    {ATTENDANCE_STATUSES.map((btn) => {
                        const Icon = btn.icon;
                        const isActive = row.status === btn.status;
                        return (
                            <button
                                key={btn.status}
                                onClick={() =>
                                    onStatusChange(row.user_id, btn.status)
                                }
                                className={`px-3 sm:px-4 py-2 rounded-lg border transition-colors text-sm flex items-center gap-1.5 ${
                                    isActive
                                        ? btn.cardActiveClass
                                        : `bg-white text-gray-700 border-gray-300 ${btn.cardHoverBorder}`
                                }`}
                            >
                                <Icon className="size-4" />
                                <span className="hidden sm:inline">
                                    {btn.label}
                                </span>
                                <span className="sm:hidden">
                                    {btn.shortLabel}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {isPartial && (
                <div className="mt-4 sm:ml-[116px] space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                            <Label className="text-sm text-gray-700 mb-1.5 block">
                                Clock In
                            </Label>
                            <Input
                                type="time"
                                value={row.check_in_at}
                                onChange={(e) =>
                                    onUpdate(row.user_id, {
                                        check_in_at: e.target.value
                                    })
                                }
                            />
                        </div>
                        <div>
                            <Label className="text-sm text-gray-700 mb-1.5 block">
                                Clock Out
                            </Label>
                            <Input
                                type="time"
                                value={row.check_out_at}
                                onChange={(e) =>
                                    onUpdate(row.user_id, {
                                        check_out_at: e.target.value
                                    })
                                }
                            />
                        </div>
                        <div>
                            <Label className="text-sm text-gray-700 mb-1.5 block">
                                Total Time
                            </Label>
                            <div className="h-10 flex items-center text-sm text-gray-600 px-3 bg-blue-50 border border-blue-200 rounded-lg">
                                {partialTime ?? '\u2014'}
                            </div>
                        </div>
                    </div>
                    <ReasonAndNote row={row} onUpdate={onUpdate} />
                </div>
            )}

            {isAbsent && (
                <div className="mt-4 sm:ml-[116px] space-y-3">
                    <ReasonAndNote row={row} onUpdate={onUpdate} />
                </div>
            )}

            {isPresent && (
                <div className="mt-4 sm:ml-[116px] space-y-3">
                    <CollapsibleNoteField
                        value={row.note}
                        expanded={row.showNoteField}
                        onExpand={() =>
                            onUpdate(row.user_id, { showNoteField: true })
                        }
                        onCollapse={() =>
                            onUpdate(row.user_id, { showNoteField: false })
                        }
                        onChange={(note) =>
                            onUpdate(row.user_id, { note })
                        }
                    />
                </div>
            )}
        </div>
    );
}

function CollapsibleNoteField({
    value,
    expanded,
    required = false,
    onExpand,
    onCollapse,
    onChange
}: {
    value: string;
    expanded: boolean;
    required?: boolean;
    onExpand: () => void;
    onCollapse: () => void;
    onChange: (note: string) => void;
}) {
    if (!expanded) {
        return (
            <button
                onClick={onExpand}
                className="text-sm text-blue-600 hover:text-blue-700 hover:underline"
            >
                + Add a note
            </button>
        );
    }

    return (
        <div>
            <div className="flex items-center justify-between mb-1.5">
                <Label className="text-sm text-gray-700">
                    Note{' '}
                    {required ? (
                        <span className="text-red-600">*</span>
                    ) : (
                        <span className="text-gray-500">(optional)</span>
                    )}
                </Label>
                <button
                    onClick={() => {
                        onChange('');
                        onCollapse();
                    }}
                    className="text-xs text-gray-500 hover:text-gray-700"
                >
                    Remove
                </button>
            </div>
            <Textarea
                placeholder={
                    required
                        ? 'Please specify...'
                        : 'Add additional details...'
                }
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="min-h-[80px] text-sm"
            />
        </div>
    );
}

function ReasonAndNote({
    row,
    onUpdate
}: {
    row: RowState;
    onUpdate: (userId: number, patch: Partial<RowState>) => void;
}) {
    const noteRequired = row.reason === AttendanceReason.Other;

    return (
        <>
            <div>
                <Label className="text-sm text-gray-700 mb-1.5 block">
                    Reason <span className="text-red-600">*</span>
                </Label>
                <Select
                    value={row.reason}
                    onValueChange={(v) => {
                        const next = v as AttendanceReason;
                        onUpdate(row.user_id, {
                            reason: next,
                            ...(next !== AttendanceReason.Other &&
                                row.reason === AttendanceReason.Other && {
                                    note: ''
                                })
                        });
                    }}
                >
                    <SelectTrigger>
                        <SelectValue placeholder="Select a reason" />
                    </SelectTrigger>
                    <SelectContent>
                        {Object.values(AttendanceReason).map((r) => (
                            <SelectItem key={r} value={r}>
                                {r}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <CollapsibleNoteField
                value={row.note}
                expanded={row.showNoteField}
                required={noteRequired}
                onExpand={() =>
                    onUpdate(row.user_id, { showNoteField: true })
                }
                onCollapse={() =>
                    onUpdate(row.user_id, { showNoteField: false })
                }
                onChange={(note) => onUpdate(row.user_id, { note })}
            />
        </>
    );
}
