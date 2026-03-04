import { startTransition, useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate, Navigate, useLoaderData } from 'react-router-dom';
import useSWR from 'swr';
import { toast } from 'sonner';
import { Search } from 'lucide-react';
import API from '@/api/api';
import {
    EnrollmentAttendance,
    Attendance,
    AttendanceReason,
    ServerResponseMany,
    Class,
    SelectedClassStatus,
    FilterResidentNames
} from '@/types';
import { ClassEventInstance } from '@/types/events';
import { isCompletedCancelledOrArchived } from '@/lib/classStatus';
import { ConfirmDialog } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';
import {
    Table,
    TableBody,
    TableHead,
    TableHeader,
    TableRow,
    TableCell
} from '@/components/ui/table';
import { AttendanceRow } from './AttendanceRow';
import { LocalRowData } from './types';

const isoRE = /^\d{4}-\d{2}-\d{2}$/;

function parseLocalDay(dateStr: string): Date {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y!, m! - 1, d!);
}

function formatTimeHM(date: Date): string {
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function isPresentLike(status?: Attendance): boolean {
    return status === Attendance.Present || status === Attendance.Partial;
}

function diffMinutes(start?: string, end?: string): number | undefined {
    if (!start || !end) return undefined;
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    if ([sh, sm, eh, em].some((v) => Number.isNaN(v))) return undefined;
    const diff = (eh ?? 0) * 60 + (em ?? 0) - ((sh ?? 0) * 60 + (sm ?? 0));
    return diff > 0 ? diff : undefined;
}

export default function EventAttendance() {
    const { class_id, event_id, date } = useParams<{
        event_id: string;
        class_id: string;
        date: string;
    }>();
    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = useState('');
    const [sortQuery, setSortQuery] = useState(FilterResidentNames['Resident Name (A-Z)']);
    const [page, setPage] = useState(1);
    const perPage = 20;
    const [rows, setRows] = useState<LocalRowData[]>([]);
    const [modifiedRows, setModifiedRows] = useState<Record<number, LocalRowData>>({});
    const [showMarkAllPresent, setShowMarkAllPresent] = useState(false);
    const [showClockOutAll, setShowClockOutAll] = useState(false);

    const rawClsInfo = useLoaderData() as { class?: Class };
    const clsInfo = rawClsInfo?.class;
    const isNotActive = clsInfo?.status !== SelectedClassStatus.Active;
    const blockEdits = isCompletedCancelledOrArchived(clsInfo ?? ({} as Class)) || isNotActive;

    const { data, isLoading, error, mutate } = useSWR<ServerResponseMany<EnrollmentAttendance>>(
        `/api/program-classes/${class_id}/events/${event_id}/attendance?date=${date}&page=${page}&per_page=${perPage}&search=${searchTerm}&order_by=${sortQuery}`
    );

    const meta = data?.meta;
    const totalPages = meta ? meta.last_page : 1;
    const [yyyy, mm] = date!.split('-');

    const { data: dates, isLoading: datesLoading, error: datesError } = useSWR<{
        message: string;
        data: ClassEventInstance[];
    }>(`/api/program-classes/${class_id}/events?month=${mm}&year=${yyyy}&dates=true&event_id=${event_id}`);

    const scheduledTimes = useMemo(() => {
        const match = Array.isArray(dates?.data)
            ? dates.data.find((d) => d.event_id === Number(event_id) && d.date === date)
            : undefined;
        if (match?.class_time?.includes?.('-')) {
            const [start = '', end = ''] = match.class_time.split('-').map((p) => p.trim()) ?? [];
            return { check_in_at: start, check_out_at: end };
        }
        return { check_in_at: '', check_out_at: '' };
    }, [dates?.data, event_id, date]);

    function getDefaultTimes(row?: LocalRowData) {
        if (scheduledTimes.check_in_at) return scheduledTimes;
        const now = new Date();
        const start = formatTimeHM(now);
        const minutes = row?.scheduled_minutes ?? 0;
        const end = minutes ? formatTimeHM(new Date(now.getTime() + minutes * 60 * 1000)) : '';
        return { check_in_at: start, check_out_at: end };
    }

    function getAttendedMinutes(row: LocalRowData): number | null {
        if (!isPresentLike(row.attendance_status)) return null;
        const computed = diffMinutes(row.check_in_at, row.check_out_at);
        const capped =
            computed && row.scheduled_minutes ? Math.min(computed, row.scheduled_minutes) : computed;
        return capped ?? row.minutes_attended ?? null;
    }

    useEffect(() => {
        if (!data?.data) return;
        const mergedRows: LocalRowData[] = data.data.map((item) => {
            const reasonValue = isPresentLike(item.attendance_status) ? '' : item.reason_category ?? '';
            const baseRow: LocalRowData = {
                selected: false,
                user_id: item.user_id,
                attendance_id: item.attendance_id,
                doc_id: item.doc_id ?? '',
                name_last: item.name_last,
                name_first: item.name_first,
                attendance_status: item.attendance_status,
                note: item.note ?? '',
                reason_category: reasonValue,
                check_in_at: item.check_in_at ?? undefined,
                check_out_at: item.check_out_at ?? undefined,
                minutes_attended: item.minutes_attended,
                scheduled_minutes: item.scheduled_minutes
            };
            return modifiedRows[item.user_id]
                ? { ...baseRow, ...modifiedRows[item.user_id] }
                : baseRow;
        });
        setRows(mergedRows);
    }, [data, modifiedRows]);

    if (!date || !isoRE.test(date)) {
        return <Navigate to="/404" replace />;
    }

    const day = parseLocalDay(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const isFutureDay = day > today;

    if (datesLoading) return <div className="text-center py-8">Loading schedule...</div>;
    if (datesError) return <div className="text-center py-8 text-red-600">Error loading schedule</div>;

    const dateList = Array.isArray(dates?.data) ? dates.data : [];
    const scheduled = dateList.some((d) => d.event_id === Number(event_id) && d.date === date);

    if (!scheduled) {
        return (
            <div className="text-center py-12 text-red-600">
                No class session was scheduled for this date.
            </div>
        );
    }
    if (isFutureDay) {
        return (
            <div className="text-center py-12 text-red-600">
                This session is scheduled for a future date. Attendance will be available after it occurs.
            </div>
        );
    }

    function handleSearch(search: string) {
        startTransition(() => setSearchTerm(search));
        setPage(1);
    }

    function handleAttendanceChange(userId: number, newStatus: Attendance) {
        const currentRow = rows.find((r) => r.user_id === userId);
        setModifiedRows((prev) => ({
            ...prev,
            [userId]: {
                ...(currentRow ?? { selected: false, user_id: userId, doc_id: '', name_last: '', name_first: '', note: '' }),
                ...(prev[userId] ?? {}),
                selected: true,
                attendance_status: newStatus,
                reason_category:
                    newStatus === Attendance.Present ? '' : prev[userId]?.reason_category ?? AttendanceReason.Lockdown,
                check_in_at:
                    newStatus === Attendance.Present
                        ? prev[userId]?.check_in_at ?? currentRow?.check_in_at ?? getDefaultTimes(currentRow).check_in_at
                        : undefined,
                check_out_at: newStatus === Attendance.Present ? prev[userId]?.check_out_at ?? currentRow?.check_out_at : undefined
            }
        }));
    }

    function handleReasonChange(userId: number, newReason: string) {
        const currentRow = rows.find((r) => r.user_id === userId);
        setModifiedRows((prev) => ({
            ...prev,
            [userId]: {
                ...(currentRow ?? {}),
                ...(prev[userId] ?? {}),
                selected: true,
                reason_category: newReason,
                note: (newReason as AttendanceReason) !== AttendanceReason.Other ? '' : prev[userId]?.note ?? ''
            }
        }));
    }

    function handleNoteChange(userId: number, newNote: string) {
        const currentRow = rows.find((r) => r.user_id === userId);
        setModifiedRows((prev) => ({
            ...prev,
            [userId]: {
                ...(currentRow ?? {}),
                ...(prev[userId] ?? {}),
                selected: true,
                note: newNote
            }
        }));
    }

    function handleTimeChange(userId: number, field: 'check_in_at' | 'check_out_at', value: string) {
        setModifiedRows((prev) => ({
            ...prev,
            [userId]: {
                ...(rows.find((r) => r.user_id === userId) ?? { selected: false, user_id: userId, note: '' }),
                ...(prev[userId] ?? {}),
                selected: true,
                [field]: value
            }
        }));
    }

    function handleCheckoutFocus(userId: number) {
        const baseRow = modifiedRows[userId] ?? rows.find((r) => r.user_id === userId);
        if (baseRow?.check_out_at?.trim()) return;
        const checkoutDefault = getDefaultTimes(baseRow).check_out_at;
        if (!checkoutDefault) return;
        setModifiedRows((prev) => ({
            ...prev,
            [userId]: {
                ...(rows.find((r) => r.user_id === userId) ?? { selected: false, user_id: userId }),
                ...(prev[userId] ?? {}),
                selected: true,
                check_out_at: checkoutDefault
            }
        }));
    }

    function handleMarkAllPresent() {
        setModifiedRows((prev) => {
            const next: Record<number, LocalRowData> = { ...prev };
            rows.forEach((row) => {
                const defaults = getDefaultTimes(row);
                next[row.user_id] = {
                    ...(prev[row.user_id] ?? row),
                    selected: true,
                    attendance_status: Attendance.Present,
                    check_in_at: prev[row.user_id]?.check_in_at ?? row.check_in_at ?? defaults.check_in_at,
                    check_out_at: prev[row.user_id]?.check_out_at ?? row.check_out_at
                };
            });
            return next;
        });
        setShowMarkAllPresent(false);
    }

    function handleClockOutAll() {
        setModifiedRows((prev) => {
            const next: Record<number, LocalRowData> = { ...prev };
            rows.forEach((row) => {
                if (row.attendance_status === Attendance.Present && !(prev[row.user_id]?.check_out_at ?? row.check_out_at)) {
                    const defaults = getDefaultTimes(row);
                    if (!defaults.check_out_at) return;
                    next[row.user_id] = {
                        ...(prev[row.user_id] ?? row),
                        selected: true,
                        check_out_at: defaults.check_out_at
                    };
                }
            });
            return next;
        });
        setShowClockOutAll(false);
    }

    async function onSubmit() {
        if (blockEdits) {
            toast.error('Cannot update attendance for completed or cancelled classes');
            return;
        }
        const mergedRows = rows.map((row) =>
            modifiedRows[row.user_id] ? { ...row, ...modifiedRows[row.user_id] } : row
        );

        const invalidPair = mergedRows.find((r) => r.selected && r.check_out_at && !r.check_in_at);
        if (invalidPair) {
            toast.error('Please provide both check-in and check-out times');
            return;
        }
        const missingCheckin = mergedRows.find(
            (r) => r.selected && isPresentLike(r.attendance_status) && !r.check_in_at
        );
        if (missingCheckin) {
            toast.error('Check-in time is required for present residents');
            return;
        }

        const payload = mergedRows
            .filter((row) => row.selected)
            .map((row) => ({
                id: row.attendance_id,
                user_id: row.user_id,
                event_id: Number(event_id),
                date,
                attendance_status: row.attendance_status,
                note: row.note ?? '',
                reason_category: row.reason_category ?? '',
                check_in_at: row.check_in_at ?? null,
                check_out_at: row.check_out_at ?? null
            }));

        if (payload.length > 0) {
            await API.post(`program-classes/${class_id}/events/${event_id}/attendance`, payload);
        }
        void mutate();
        navigate(`/program-classes/${class_id}/attendance?year=${yyyy}&month=${mm}`);
    }

    const anyRowSelected = rows.some((row) => row.selected);
    const allHaveStatus = rows.length > 0 && rows.every((row) => !!row.attendance_status);

    return (
        <div className="space-y-4">
            {isNotActive && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                    This class is not active. You can still view attendance, but cannot mark attendance.
                </div>
            )}

            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="relative w-56">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                        <Input
                            placeholder="Search..."
                            value={searchTerm}
                            onChange={(e) => handleSearch(e.target.value)}
                            className="pl-9"
                        />
                    </div>
                    <Select value={sortQuery} onValueChange={setSortQuery}>
                        <SelectTrigger className="w-44">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="name_last asc">Name (A-Z)</SelectItem>
                            <SelectItem value="name_last desc">Name (Z-A)</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        onClick={() => setShowMarkAllPresent(true)}
                        disabled={blockEdits}
                        className="bg-[#556830] hover:bg-[#203622] text-white"
                    >
                        Mark All Present
                    </Button>
                    <Button
                        onClick={() => setShowClockOutAll(true)}
                        disabled={blockEdits || !allHaveStatus}
                        variant="outline"
                    >
                        Clock Out All
                    </Button>
                </div>
            </div>

            {isLoading && <div className="text-center py-8">Loading...</div>}
            {error && <div className="text-center py-8 text-red-600">Error loading data</div>}

            {!isLoading && !error && (
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        void onSubmit();
                    }}
                >
                    <div className="bg-card rounded-lg border border-border overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow className="hover:bg-transparent">
                                    <TableHead>Name</TableHead>
                                    <TableHead>Resident ID</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Reason</TableHead>
                                    <TableHead>Check-in</TableHead>
                                    <TableHead>Check-out</TableHead>
                                    <TableHead>Minutes</TableHead>
                                    <TableHead>Note</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {rows.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                                            No users enrolled for class on {date}.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    rows.map((row) => (
                                        <AttendanceRow
                                            key={row.user_id}
                                            row={row}
                                            blockEdits={blockEdits}
                                            onStatusChange={handleAttendanceChange}
                                            onReasonChange={handleReasonChange}
                                            onNoteChange={handleNoteChange}
                                            onTimeChange={handleTimeChange}
                                            onCheckoutFocus={handleCheckoutFocus}
                                            getAttendedMinutes={getAttendedMinutes}
                                        />
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    <div className="flex items-center justify-end gap-3 pt-4">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() =>
                                navigate(`/program-classes/${class_id}/attendance?year=${yyyy}&month=${mm}`)
                            }
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={!anyRowSelected || blockEdits}
                            className="bg-[#F1B51C] text-foreground hover:bg-[#F1B51C]/90"
                        >
                            Save Attendance
                        </Button>
                    </div>
                </form>
            )}

            {!isLoading && !error && totalPages > 1 && (
                <div className="flex items-center justify-center gap-2">
                    <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                        Previous
                    </Button>
                    <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
                    <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                        Next
                    </Button>
                </div>
            )}

            <ConfirmDialog
                open={showMarkAllPresent}
                onOpenChange={setShowMarkAllPresent}
                title="Mark All Present"
                description={`Are you sure you want to mark all ${rows.length} residents on this page as "Present"? This will override any existing attendance status.`}
                confirmLabel="Mark All Present"
                onConfirm={handleMarkAllPresent}
            />

            <ConfirmDialog
                open={showClockOutAll}
                onOpenChange={setShowClockOutAll}
                title="Clock Out All"
                description={`Are you sure you want to check-out all ${rows.filter((r) => r.attendance_status === Attendance.Present).length} present residents on this page?`}
                confirmLabel="Clock Out All"
                onConfirm={handleClockOutAll}
            />
        </div>
    );
}
