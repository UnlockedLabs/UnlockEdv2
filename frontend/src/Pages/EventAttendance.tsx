import { startTransition, useEffect, useState, useRef, useMemo } from 'react';
import {
    useParams,
    useNavigate,
    Navigate,
    useLoaderData
} from 'react-router-dom';
import useSWR from 'swr';
import { useForm } from 'react-hook-form';
import { TextInput } from '@/Components/inputs/TextInput';
import { useUrlPagination } from '@/Hooks/paginationUrlSync';
import {
    EnrollmentAttendance,
    Attendance,
    ServerResponseMany,
    FilterResidentNames,
    Class,
    SelectedClassStatus,
    ToastState,
    AttendanceReason
} from '@/common';
import SearchBar from '@/Components/inputs/SearchBar';
import API from '@/api/api';
import Pagination from '@/Components/Pagination';
import DropdownControl from '@/Components/inputs/DropdownControl';
import { DropdownInput } from '@/Components/inputs/DropdownInput';
import Error from '@/Pages/Error';
import {
    parseLocalDay,
    formatTimeHM
} from '@/Components/helperFunctions/formatting';
import { useToast } from '@/Context/ToastCtx';
import { isCompletedCancelledOrArchived } from './ProgramOverviewDashboard';
import WarningBanner from '@/Components/WarningBanner';
import { CancelButton } from '@/Components/inputs';
import AttendanceStatusToggle from '@/Components/AttendanceStatusToggle';
import {
    TextOnlyModal,
    TextModalType,
    showModal,
    closeModal
} from '@/Components/modals';
import { ClassEventInstance } from '@/types/events';

interface LocalRowData {
    selected: boolean;
    user_id: number;
    attendance_id?: number;
    doc_id: string;
    name_last: string;
    name_first: string;
    attendance_status?: Attendance;
    note: string;
    reason_category?: string;
    check_in_at?: string;
    check_out_at?: string;
    minutes_attended?: number;
    scheduled_minutes?: number;
}

const isoRE = /^\d{4}-\d{2}-\d{2}$/;
type FormData = Record<string, string>;

const diffMinutes = (start?: string, end?: string) => {
    if (!start || !end) return undefined;
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    if (
        Number.isNaN(sh) ||
        Number.isNaN(sm) ||
        Number.isNaN(eh) ||
        Number.isNaN(em)
    ) {
        return undefined;
    }
    const diff = eh * 60 + em - (sh * 60 + sm);
    return diff > 0 ? diff : undefined;
};

export default function EventAttendance() {
    const { class_id, event_id, date } = useParams<{
        event_id: string;
        class_id: string;
        date: string;
    }>();
    const {
        register,
        handleSubmit,
        setValue,
        getValues,
        clearErrors,
        formState: { errors }
    } = useForm<FormData>();
    const [searchTerm, setSearchTerm] = useState('');
    const [sortQuery, setSortQuery] = useState(
        FilterResidentNames['Resident Name (A-Z)']
    );
    const {
        page: pageQuery,
        perPage,
        setPage: setPageQuery,
        setPerPage
    } = useUrlPagination(1, 20);
    const rawClsInfo = useLoaderData() as { class?: Class };
    const clsInfo = rawClsInfo?.class;
    const isNotActive = clsInfo?.status !== SelectedClassStatus.Active;
    const blockEdits =
        isCompletedCancelledOrArchived(clsInfo ?? ({} as Class)) || isNotActive;
    const { data, error, isLoading, mutate } = useSWR<
        ServerResponseMany<EnrollmentAttendance>,
        Error
    >(
        `/api/program-classes/${class_id}/events/${event_id}/attendance?date=${date}&page=${pageQuery}&per_page=${perPage}&search=${searchTerm}&order_by=${sortQuery}`
    );
    const navigate = useNavigate();
    const [yyyy, mm] = date!.split('-');
    const meta = data?.meta;
    const [rows, setRows] = useState<LocalRowData[]>([]);

    const [modifiedRows, setModifiedRows] = useState<
        Record<number, LocalRowData>
    >({});
    const { toaster } = useToast();
    const markAllPresentModal = useRef<HTMLDialogElement>(null);
    const clockOutAllModal = useRef<HTMLDialogElement>(null);
    const {
        data: dates,
        error: datesError,
        isLoading: datesLoading
    } = useSWR<{ message: string; data: ClassEventInstance[] }, Error>(
        `/api/program-classes/${class_id}/events?month=${mm}&year=${yyyy}&dates=true&event_id=${event_id}`
    );
    const scheduledTimes = useMemo(() => {
        const match = Array.isArray(dates?.data)
            ? dates.data.find(
                  (d) => d.event_id === Number(event_id) && d.date === date
              )
            : undefined;
        if (match?.class_time?.includes?.('-')) {
            const [start = '', end = ''] =
                match.class_time.split('-').map((p) => p.trim()) ?? [];
            return { check_in_at: start, check_out_at: end };
        }
        return { check_in_at: '', check_out_at: '' };
    }, [dates?.data, event_id, date]);

    const getDefaultTimes = (row?: LocalRowData) => {
        if (scheduledTimes.check_in_at) {
            return scheduledTimes;
        }
        const now = new Date();
        const start = formatTimeHM(now);
        const minutes = row?.scheduled_minutes ?? 0;
        const end = minutes
            ? formatTimeHM(new Date(now.getTime() + minutes * 60 * 1000))
            : '';
        return { check_in_at: start, check_out_at: end };
    };

    const isPresentLike = (status?: Attendance) =>
        status === Attendance.Present || status === Attendance.Partial;

    const getAttendedMinutes = (row: LocalRowData) => {
        if (!isPresentLike(row.attendance_status)) {
            return null;
        }
        const computed = diffMinutes(row.check_in_at, row.check_out_at);
        const capped =
            computed && row.scheduled_minutes
                ? Math.min(computed, row.scheduled_minutes)
                : computed;
        return capped ?? row.minutes_attended ?? null;
    };

    useEffect(() => {
        if (!data?.data) {
            return;
        }
        const items = data.data;
        const mergedRows: LocalRowData[] = items.map((item) => {
            const reasonValue = isPresentLike(item.attendance_status)
                ? ''
                : item.reason_category ?? '';
            if (!modifiedRows[item.user_id]) {
                setValue(`reason_${item.user_id}`, reasonValue);
            }
            if (!modifiedRows[item.user_id] && item.note) {
                setValue(`note_${item.user_id}`, item.note);
            }
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
    }, [data, modifiedRows, setValue]);

    const dateList = Array.isArray(dates?.data) ? dates.data : [];
    const scheduled = dateList.some(
        (d) => d.event_id === Number(event_id) && d.date === date
    );
    if (!date || !isoRE.test(date)) {
        return <Navigate to="/404" replace />;
    }

    const day = parseLocalDay(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const isFutureDay = day > today;

    if (datesLoading) {
        return <div>Loading schedule…</div>;
    }
    if (datesError) {
        return <Error message="Error loading schedule" />;
    }

    if (!scheduled && !isFutureDay) {
        return (
            <div className="mt-10 text-center text-error">
                No class session was scheduled for this date.
            </div>
        );
    }

    if (!scheduled && isFutureDay) {
        return (
            <div className="mt-10 text-center text-error">
                No class session is scheduled for this date.
            </div>
        );
    }

    if (scheduled && isFutureDay) {
        return (
            <div className="mt-10 text-center text-error">
                This session is scheduled for a future date. Attendance will be
                available after it occurs.
            </div>
        );
    }

    const handleSearch = (search: string) => {
        startTransition(() => {
            setSearchTerm(search);
        });
        setPageQuery(1);
    };

    function handleNoteChange(user_id: number, newNote: string) {
        const currentRow = rows.find((r) => r.user_id === user_id);
        setModifiedRows((prev) => ({
            ...prev,
            [user_id]: {
                ...(currentRow ?? {}),
                ...(prev[user_id] ?? {}),
                selected: true,
                note: newNote
            }
        }));
    }

    function handleAttendanceChange(user_id: number, newStatus: Attendance) {
        if (newStatus === Attendance.Present) {
            setValue(`note_${user_id}`, '');
            clearErrors(`note_${user_id}`);
            setValue(`reason_${user_id}`, '');
            clearErrors(`reason_${user_id}`);
        } else {
            setValue(`reason_${user_id}`, AttendanceReason.Lockdown);
        }
        const currentRow: LocalRowData = rows.find(
            (r) => r.user_id === user_id
        ) ?? {
            selected: false,
            user_id: user_id,
            doc_id: '',
            name_last: '',
            name_first: '',
            note: '',
            attendance_status: newStatus,
            check_in_at: undefined,
            check_out_at: undefined,
            minutes_attended: undefined
        };
        setModifiedRows((prev) => ({
            ...prev,
            [user_id]: {
                ...currentRow,
                ...prev[user_id],
                selected: true,
                attendance_status: newStatus,
                note:
                    newStatus === Attendance.Present ? '' : prev[user_id]?.note,
                reason_category:
                    newStatus === Attendance.Present
                        ? ''
                        : prev[user_id]?.reason_category ??
                          AttendanceReason.Lockdown,
                check_in_at:
                    newStatus === Attendance.Present
                        ? prev[user_id]?.check_in_at ??
                          currentRow.check_in_at ??
                          getDefaultTimes(currentRow).check_in_at
                        : undefined,
                check_out_at:
                    newStatus === Attendance.Present
                        ? prev[user_id]?.check_out_at ?? currentRow.check_out_at
                        : undefined,
                minutes_attended: isPresentLike(newStatus)
                    ? prev[user_id]?.minutes_attended ??
                      currentRow.minutes_attended
                    : undefined
            }
        }));
    }

    function handleReasonChange(user_id: number, newReason: string) {
        if ((newReason as AttendanceReason) !== AttendanceReason.Other) {
            setValue(`note_${user_id}`, '');
            clearErrors(`note_${user_id}`);
        }
        const currentRow = rows.find((r) => r.user_id === user_id);
        setModifiedRows((prev) => ({
            ...prev,
            [user_id]: {
                ...(currentRow ?? {}),
                ...(prev[user_id] ?? {}),
                selected: true,
                reason_category: newReason,
                note:
                    (newReason as AttendanceReason) !== AttendanceReason.Other
                        ? ''
                        : prev[user_id]?.note ?? ''
            }
        }));
    }

    function handleTimeChange(
        user_id: number,
        field: 'check_in_at' | 'check_out_at',
        value: string
    ) {
        setModifiedRows((prev) => ({
            ...prev,
            [user_id]: {
                ...(rows.find((r) => r.user_id === user_id) ?? {
                    selected: false,
                    user_id,
                    note: ''
                }),
                ...(prev[user_id] ?? {}),
                selected: true,
                [field]: value
            }
        }));
    }

    async function submitAttendanceForRows(updatedRows: LocalRowData[]) {
        const notes = getValues();
        const payload = updatedRows
            .filter((row) => row.selected)
            .map((row) => ({
                id: row.attendance_id,
                user_id: row.user_id,
                event_id: Number(event_id),
                date: date,
                attendance_status: row?.attendance_status,
                note: notes[`note_${row.user_id}`] ?? '',
                reason_category: notes[`reason_${row.user_id}`] ?? '',
                check_in_at: row.check_in_at ?? null,
                check_out_at: row.check_out_at ?? null
            }));
        if (payload.length > 0) {
            await API.post(
                `program-classes/${class_id}/events/${event_id}/attendance`,
                payload
            );
        }
    }

    function handleCheckoutFocus(user_id: number) {
        const baseRow = modifiedRows[user_id] ??
            rows.find((r) => r.user_id === user_id) ?? {
                selected: false,
                user_id
            };
        if (baseRow.check_out_at && baseRow.check_out_at.trim() !== '') {
            return;
        }
        const checkoutDefault = getDefaultTimes(baseRow).check_out_at;
        if (!checkoutDefault) {
            return;
        }
        setModifiedRows((prev) => ({
            ...prev,
            [user_id]: {
                ...(rows.find((r) => r.user_id === user_id) ?? {
                    selected: false,
                    user_id
                }),
                ...(prev[user_id] ?? {}),
                selected: true,
                check_out_at: checkoutDefault
            }
        }));
    }
    function handleMarkAllPresent() {
        setModifiedRows((prev) => {
            const newMods: Record<number, LocalRowData> = { ...prev };

            rows.forEach((row) => {
                const defaults = getDefaultTimes(row);
                newMods[row.user_id] = {
                    ...(prev[row.user_id] ?? row),
                    selected: true,
                    attendance_status: Attendance.Present,
                    check_in_at:
                        prev[row.user_id]?.check_in_at ??
                        row.check_in_at ??
                        defaults.check_in_at,
                    check_out_at:
                        prev[row.user_id]?.check_out_at ?? row.check_out_at
                };
            });

            return newMods;
        });
        closeModal(markAllPresentModal);
    }

    async function onSubmit() {
        if (blockEdits) {
            toaster(
                'Cannot update attendance for completed or cancelled classes',
                ToastState.error
            );
            return;
        }
        const mergedRowsForSubmit = rows.map((row) =>
            modifiedRows[row.user_id]
                ? { ...row, ...modifiedRows[row.user_id] }
                : row
        );

        const invalidTimePair = mergedRowsForSubmit.find(
            (row) => row.selected && row.check_out_at && !row.check_in_at
        );
        if (invalidTimePair) {
            toaster(
                'Please provide both check-in and check-out times for selected residents',
                ToastState.error
            );
            return;
        }
        const missingCheckin = mergedRowsForSubmit.find(
            (row) =>
                row.selected &&
                isPresentLike(row.attendance_status) &&
                !row.check_in_at
        );
        if (missingCheckin) {
            toaster(
                'Check-in time is required for present residents',
                ToastState.error
            );
            return;
        }

        await submitAttendanceForRows(mergedRowsForSubmit);
        void mutate();
        navigate(
            `/program-classes/${class_id}/attendance?year=${yyyy}&month=${mm}`
        );
    }
    const tooltip = blockEdits ? 'tooltip tooltip-left' : '';
    const anyRowSelected = rows.some((row) => row.selected);
    const allRowsHaveStatus =
        rows.length > 0 && rows.every((row) => !!row.attendance_status);

    function handleClockOutAll() {
        setModifiedRows((prev) => {
            const next: Record<number, LocalRowData> = { ...prev };
            rows.forEach((row) => {
                if (
                    row.attendance_status === Attendance.Present &&
                    !(prev[row.user_id]?.check_out_at ?? row.check_out_at)
                ) {
                    const defaults = getDefaultTimes(row);
                    if (!defaults.check_out_at) {
                        return;
                    }
                    next[row.user_id] = {
                        ...(prev[row.user_id] ?? row),
                        selected: true,
                        check_out_at: defaults.check_out_at
                    };
                }
            });
            return next;
        });
        closeModal(clockOutAllModal);
    }
    return (
        <div className="p-4 space-y-4">
            {isNotActive && (
                <WarningBanner text="This class is not active. You can still view attendance, but cannot mark attendance." />
            )}

            <div className="flex justify-between items-center">
                <div className="flex flex-row gap-2 items-center">
                    <SearchBar
                        searchTerm={searchTerm}
                        changeCallback={handleSearch}
                    />
                    <DropdownControl
                        setState={setSortQuery}
                        enumType={FilterResidentNames}
                    />
                </div>
                <div className="flex gap-2 ml-auto">
                    <button
                        onClick={() => showModal(markAllPresentModal)}
                        disabled={blockEdits}
                        className={`button ${tooltip}`}
                        data-tip={
                            blockEdits
                                ? `This class is ${clsInfo?.status.toLowerCase()} and cannot be modified.`
                                : undefined
                        }
                    >
                        Mark All Present
                    </button>
                    <button
                        onClick={() => showModal(clockOutAllModal)}
                        disabled={blockEdits || !allRowsHaveStatus}
                        className={`button ${tooltip}`}
                        data-tip={
                            blockEdits
                                ? `This class is ${clsInfo?.status.toLowerCase()} and cannot be modified.`
                                : !allRowsHaveStatus
                                  ? 'Set a status for each resident before clocking everyone out.'
                                  : undefined
                        }
                    >
                        Clock Out All
                    </button>
                </div>
            </div>

            {isLoading && <div>Loading...</div>}

            {error && error.message === 'Conflict' ? (
                <div className="text-error">
                    Unable to mark attendance for a cancelled event
                </div>
            ) : (
                error && <div className="text-error">Error loading data</div>
            )}
            {!isLoading && !error && (
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        void handleSubmit(onSubmit)(e);
                    }}
                >
                    <div className="relative w-full overflow-x-auto">
                        <table
                            className="table-2 table-fixed w-full min-w-[1500px] mb-5 border-separate border-spacing-0"
                            style={{ display: 'table' }}
                        >
                            <colgroup>
                                <col className="w-[10%]" />
                                <col className="w-[8%]" />
                                <col className="w-[26%]" />
                                <col className="w-[15%]" />
                                <col className="w-[11%]" />
                                <col className="w-[11%]" />
                                <col className="w-[7%]" />
                                <col className="w-[12%]" />
                            </colgroup>
                            <thead style={{ display: 'table-header-group' }}>
                                <tr
                                    className="text-left table-row border-b border-grey-2"
                                    style={{ display: 'table-row' }}
                                >
                                    <th className="px-3">Name</th>
                                    <th className="px-3">Resident ID</th>
                                    <th className="px-3">Status</th>
                                    <th className="px-3">Reason</th>
                                    <th className="px-3">Check-in</th>
                                    <th className="px-3">Check-out</th>
                                    <th className="px-3">
                                        Time in class (minutes)
                                    </th>
                                    <th className="px-3">Note</th>
                                </tr>
                            </thead>
                            <tbody
                                className="table-row-group"
                                style={{ display: 'table-row-group' }}
                            >
                                {rows.length === 0 ? (
                                    <tr style={{ display: 'table-row' }}>
                                        <td
                                            colSpan={8}
                                            className="px-3 py-4 text-center body"
                                        >
                                            No users enrolled for class on{' '}
                                            {date}.
                                        </td>
                                    </tr>
                                ) : (
                                    rows.map((row) => {
                                        const noteEnabled =
                                            row.attendance_status &&
                                            !isPresentLike(
                                                row.attendance_status
                                            ) &&
                                            row.reason_category ===
                                                AttendanceReason.Other;
                                        return (
                                            <tr
                                                key={row.user_id}
                                                className="align-middle table-row"
                                                style={{ display: 'table-row' }}
                                            >
                                                <td className="px-3 py-2 truncate">
                                                    {row.name_last},{' '}
                                                    {row.name_first}
                                                </td>
                                                <td className="px-3 py-2 whitespace-nowrap">
                                                    {row.doc_id == ''
                                                        ? ' '
                                                        : `${row.doc_id}`}
                                                </td>
                                                <td className="px-3 py-2 min-w-[200px]">
                                                    <AttendanceStatusToggle
                                                        value={
                                                            row.attendance_status ??
                                                            (row.selected
                                                                ? Attendance.Present
                                                                : undefined)
                                                        }
                                                        onChange={(newStatus) =>
                                                            handleAttendanceChange(
                                                                row.user_id,
                                                                newStatus
                                                            )
                                                        }
                                                        disabled={blockEdits}
                                                    />
                                                </td>
                                                <td className="px-3 py-2 min-w-[150px]">
                                                    <DropdownInput
                                                        label=""
                                                        interfaceRef={`reason_${row.user_id}`}
                                                        required={
                                                            !blockEdits &&
                                                            row.selected &&
                                                            !isPresentLike(
                                                                row.attendance_status
                                                            )
                                                        }
                                                        errors={errors}
                                                        register={register}
                                                        enumType={
                                                            AttendanceReason
                                                        }
                                                        defaultValue={
                                                            isPresentLike(
                                                                row.attendance_status
                                                            )
                                                                ? ''
                                                                : row.reason_category
                                                        }
                                                        disabled={
                                                            blockEdits ||
                                                            !row.attendance_status ||
                                                            isPresentLike(
                                                                row.attendance_status
                                                            )
                                                        }
                                                        selectClassName={`h-10 min-h-[2.5rem] text-base ${
                                                            blockEdits ||
                                                            !row.attendance_status ||
                                                            row.attendance_status ===
                                                                Attendance.Present
                                                                ? 'opacity-40'
                                                                : ''
                                                        } w-full max-w-[10rem]`}
                                                        onChange={(e) =>
                                                            handleReasonChange(
                                                                row.user_id,
                                                                e.target.value
                                                            )
                                                        }
                                                    />
                                                </td>
                                                <td className="px-3 py-2 whitespace-nowrap">
                                                    <input
                                                        type="time"
                                                        className="input input-bordered w-full"
                                                        value={
                                                            row.check_in_at ??
                                                            ''
                                                        }
                                                        onChange={(e) =>
                                                            handleTimeChange(
                                                                row.user_id,
                                                                'check_in_at',
                                                                e.target.value
                                                            )
                                                        }
                                                        disabled={
                                                            blockEdits ||
                                                            !isPresentLike(
                                                                row.attendance_status
                                                            )
                                                        }
                                                    />
                                                </td>
                                                <td className="px-3 py-2 whitespace-nowrap">
                                                    <input
                                                        type="time"
                                                        className="input input-bordered w-full"
                                                        value={
                                                            row.check_out_at ??
                                                            ''
                                                        }
                                                        onChange={(e) =>
                                                            handleTimeChange(
                                                                row.user_id,
                                                                'check_out_at',
                                                                e.target.value
                                                            )
                                                        }
                                                        onFocus={() =>
                                                            handleCheckoutFocus(
                                                                row.user_id
                                                            )
                                                        }
                                                        disabled={
                                                            blockEdits ||
                                                            !isPresentLike(
                                                                row.attendance_status
                                                            )
                                                        }
                                                    />
                                                </td>
                                                <td className="px-3 py-2 whitespace-nowrap text-center">
                                                    {getAttendedMinutes(row) ??
                                                        '—'}
                                                </td>
                                                <td className="px-3 py-2">
                                                    <TextInput
                                                        label=""
                                                        defaultValue={row.note}
                                                        disabled={
                                                            blockEdits ||
                                                            !noteEnabled
                                                        }
                                                        inputClassName={
                                                            blockEdits ||
                                                            !noteEnabled
                                                                ? 'opacity-40'
                                                                : ''
                                                        }
                                                        interfaceRef={`note_${row.user_id}`}
                                                        required={
                                                            !blockEdits &&
                                                            row.selected &&
                                                            noteEnabled
                                                        }
                                                        length={500}
                                                        errors={errors}
                                                        register={register}
                                                        onChange={(e) =>
                                                            handleNoteChange(
                                                                row.user_id,
                                                                e.target.value
                                                            )
                                                        }
                                                        errorTextAlign="center"
                                                    />
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                    <div className="flex gap-4 justify-end pt-4 ">
                        <CancelButton
                            onClick={() =>
                                navigate(
                                    `/program-classes/${class_id}/attendance?year=${yyyy}&month=${mm}`
                                )
                            }
                        />
                        <button
                            type="submit"
                            className={`button ${tooltip}`}
                            disabled={!anyRowSelected || blockEdits}
                            data-tip={`${blockEdits ? 'This class is completed and cannot be modified.' : ''}`}
                        >
                            Save Attendance
                        </button>
                    </div>
                </form>
            )}
            {!isLoading && !error && meta && (
                <div className="flex justify-center mt-4">
                    <Pagination
                        meta={meta}
                        setPage={setPageQuery}
                        setPerPage={setPerPage}
                        specialPageSelecton
                    />
                </div>
            )}
            <TextOnlyModal
                ref={markAllPresentModal}
                type={TextModalType.Confirm}
                title="Mark All Present"
                text={`Are you sure you want to mark all ${rows.length} residents on this page as "Present"? This will override any existing attendance status.`}
                onSubmit={() => void handleMarkAllPresent()}
                onClose={() => void closeModal(markAllPresentModal)}
            />
            <TextOnlyModal
                ref={clockOutAllModal}
                type={TextModalType.Confirm}
                title="Clock Out All"
                text={`Are you sure you want to check-out all ${rows.filter((r) => r.attendance_status === Attendance.Present).length} present residents on this page?`}
                onSubmit={() => void handleClockOutAll()}
                onClose={() => void closeModal(clockOutAllModal)}
            />
        </div>
    );
}
