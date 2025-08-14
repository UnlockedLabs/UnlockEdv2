import { startTransition, useEffect, useState, useRef } from 'react';
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
    ToastState
} from '@/common';
import SearchBar from '@/Components/inputs/SearchBar';
import API from '@/api/api';
import Pagination from '@/Components/Pagination';
import DropdownControl from '@/Components/inputs/DropdownControl';
import Error from '@/Pages/Error';
import { parseLocalDay } from '@/Components/helperFunctions/formatting';
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
    doc_id: string;
    name_last: string;
    name_first: string;
    attendance_status?: Attendance;
    note: string;
}

const isoRE = /^\d{4}-\d{2}-\d{2}$/;
type FormData = Record<string, string>;

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
    const {
        data: dates,
        error: datesError,
        isLoading: datesLoading
    } = useSWR<{ message: string; data: ClassEventInstance[] }, Error>(
        `/api/program-classes/${class_id}/events?month=${mm}&year=${yyyy}&dates=true&event_id=${event_id}`
    );

    useEffect(() => {
        if (data?.data) {
            const mergedRows = data.data.map((item) => {
                return modifiedRows[item.user_id]
                    ? { ...item, ...modifiedRows[item.user_id] }
                    : {
                          selected: false,
                          user_id: item.user_id,
                          doc_id: item.doc_id ?? '',
                          name_last: item.name_last,
                          name_first: item.name_first,
                          attendance_status: item.attendance_status,
                          note: item.note ?? ''
                      };
            });
            setRows(mergedRows);
        }
    }, [data, modifiedRows]);

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
        }
        const currentRow = rows.find((r) => r.user_id === user_id) ?? {
            selected: false,
            user_id: user_id,
            doc_id: '',
            name_last: '',
            name_first: '',
            attendance_status: newStatus
        };
        setModifiedRows((prev) => ({
            ...prev,
            [user_id]: {
                ...currentRow,
                ...prev[user_id],
                selected: true,
                attendance_status: newStatus,
                note:
                    newStatus === Attendance.Present ? '' : prev[user_id]?.note
            }
        }));
    }

    async function submitAttendanceForRows(updatedRows: LocalRowData[]) {
        const notes = getValues();
        const payload = updatedRows
            .filter((row) => row.selected)
            .map((row) => ({
                user_id: row.user_id,
                event_id: Number(event_id),
                date: date,
                attendance_status: row?.attendance_status,
                note: notes[`note_${row.user_id}`] ?? ''
            }));
        if (payload.length > 0) {
            await API.post(
                `program-classes/${class_id}/events/${event_id}/attendance`,
                payload
            );
        }
    }

    function handleMarkAllPresent() {
        setModifiedRows((prev) => {
            const newMods: Record<number, LocalRowData> = { ...prev };

            rows.forEach((row) => {
                newMods[row.user_id] = {
                    ...(prev[row.user_id] ?? row),
                    selected: true,
                    attendance_status: Attendance.Present
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
        await submitAttendanceForRows(rows);
        void mutate();
        navigate(`/program-classes/${class_id}/attendance`);
    }
    const tooltip = blockEdits ? 'tooltip tooltip-left' : '';
    const anyRowSelected = rows.some((row) => row.selected);
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
                    <div className="relative w-full">
                        <table className="table-2 mb-5">
                            <thead>
                                <tr className="grid-cols-[1fr_1fr_350px_1fr] grid gap-2 px-2">
                                    <th>Name</th>
                                    <th>Resident ID</th>
                                    <th className="">Status</th>
                                    <th className="">Note</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.length === 0 ? (
                                    <p className="body">
                                        No users enrolled for class on {date}.
                                    </p>
                                ) : (
                                    rows.map((row) => (
                                        <tr
                                            key={row.user_id}
                                            className="card w-full justify-items-center grid-cols-[1fr_1fr_350px_1fr] grid p-2 gap-2"
                                        >
                                            <td>
                                                {row.name_last},{' '}
                                                {row.name_first}
                                            </td>
                                            <td>
                                                {' '}
                                                {row.doc_id == ''
                                                    ? ' '
                                                    : `${row.doc_id}`}
                                            </td>
                                            <td className="flex">
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
                                            <td className="">
                                                <TextInput
                                                    label=""
                                                    defaultValue={row.note}
                                                    disabled={
                                                        blockEdits ||
                                                        !(
                                                            row.attendance_status &&
                                                            row.attendance_status !==
                                                                Attendance.Present
                                                        )
                                                    }
                                                    inputClassName={
                                                        blockEdits ||
                                                        !(
                                                            row.attendance_status &&
                                                            row.attendance_status !==
                                                                Attendance.Present
                                                        )
                                                            ? 'opacity-40'
                                                            : ''
                                                    }
                                                    interfaceRef={`note_${row.user_id}`}
                                                    required={
                                                        !blockEdits &&
                                                        row.selected &&
                                                        row.attendance_status !==
                                                            Attendance.Present
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
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                    <div className="flex gap-4 justify-end pt-4 ">
                        <CancelButton
                            onClick={() =>
                                navigate(
                                    `/program-classes/${class_id}/attendance`
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
        </div>
    );
}
