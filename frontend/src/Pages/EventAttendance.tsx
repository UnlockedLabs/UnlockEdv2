import { startTransition, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import useSWR from 'swr';
import { useForm } from 'react-hook-form';
import { TextInput } from '@/Components/inputs/TextInput';
import { useUrlPagination } from '@/Hooks/paginationUrlSync';
import { EnrollmentAttendance, Attendance, ServerResponseMany } from '@/common';
import SearchBar from '@/Components/inputs/SearchBar';
import API from '@/api/api';
import Pagination from '@/Components/Pagination';
import DropdownControl from '@/Components/inputs/DropdownControl';

interface LocalRowData {
    selected: boolean;
    user_id: number;
    doc_id: string;
    name_last: string;
    name_first: string;
    attendance_status: Attendance;
    note: string;
}

type FormData = Record<string, string>;

export default function EventAttendance() {
    const { event_id, date, class_id } = useParams<{
        event_id: string;
        date: string;
        class_id: string;
    }>();
    const navigate = useNavigate();
    const {
        page: pageQuery,
        perPage,
        setPage: setPageQuery,
        setPerPage
    } = useUrlPagination(1, 20);

    const [searchTerm, setSearchTerm] = useState('');
    const [sortQuery, setSortQuery] = useState('created_at DESC');

    const handleSearch = (search: string) => {
        startTransition(() => {
            setSearchTerm(search);
        });
        setPageQuery(1);
    };
    const { data, error, isLoading, mutate } = useSWR<
        ServerResponseMany<EnrollmentAttendance>,
        Error
    >(
        `/api/program-classes/${class_id}/events/${event_id}/attendance?date=${date}&page=${pageQuery}&per_page=${perPage}&search=${searchTerm}&order_by=${sortQuery}`
    );

    const meta = data?.meta;
    const [rows, setRows] = useState<LocalRowData[]>([]);

    const [modifiedRows, setModifiedRows] = useState<
        Record<number, LocalRowData>
    >({});

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
                          attendance_status:
                              item.attendance_status as Attendance,
                          note: item.note ?? ''
                      };
            });
            setRows(mergedRows);
        }
    }, [data, modifiedRows]);

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
    const {
        register,
        handleSubmit,
        getValues,
        formState: { errors }
    } = useForm<FormData>();

    function handleToggleSelect(user_id: number) {
        const currentRow =
            modifiedRows[user_id] || rows.find((r) => r.user_id === user_id);
        const newSelected = !(currentRow?.selected ?? false);
        setModifiedRows((prev) => ({
            ...prev,
            [user_id]: {
                ...currentRow,
                selected: newSelected
            }
        }));
    }
    function handleSelectAll() {
        const allSelected = rows.every((row) => row.selected);
        setModifiedRows((prev) => {
            const newModifications = { ...prev };
            rows.forEach((row) => {
                newModifications[row.user_id] = {
                    ...(prev[row.user_id] || row),
                    selected: !allSelected
                };
            });
            return newModifications;
        });
    }

    function handleAttendanceChange(user_id: number, newStatus: Attendance) {
        const currentRow = rows.find((r) => r.user_id === user_id) ?? {
            selected: false,
            user_id: user_id,
            doc_id: '',
            name_last: '',
            name_first: '',
            attendance_status: newStatus,
            note: ''
        };
        setModifiedRows((prev) => ({
            ...prev,
            [user_id]: {
                ...currentRow,
                ...prev[user_id],
                selected: true,
                attendance_status: newStatus
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
    }

    async function onSubmit() {
        await submitAttendanceForRows(rows);
        void mutate();
        navigate(`/program-classes/${class_id}/attendance`);
    }

    const anyRowSelected = rows.some((row) => row.selected);
    return (
        <div className="p-4 space-y-4">
            <div className="flex justify-between items-center">
                <div className="flex flex-row gap-2 items-center">
                    <SearchBar
                        searchTerm={searchTerm}
                        changeCallback={handleSearch}
                    />
                    <DropdownControl
                        label="order by"
                        setState={setSortQuery}
                        enumType={{
                            'Last Name (A-Z)': 'name_last asc',
                            'Last Name (Z-A)': 'name_last desc',
                            'First Name (A-Z)': 'name_first asc',
                            'First Name (Z-A)': 'name_first desc'
                        }}
                    />
                </div>
                <button
                    onClick={() => void handleMarkAllPresent()}
                    disabled={anyRowSelected}
                    className={`button ${anyRowSelected ? `bg-gray-400 cursor-not-allowed` : ``}`}
                >
                    Mark All Present
                </button>
            </div>

            {isLoading && <div>Loading...</div>}
            {error && <div className="error">Error loading data</div>}
            {!isLoading && !error && rows.length > 0 && (
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        void handleSubmit(onSubmit)(e);
                    }}
                >
                    <div
                        className="relative w-full"
                        style={{ overflowX: 'clip' }}
                    >
                        <table className="table-2 mb-5">
                            <thead>
                                <tr className="grid-cols-4 grid ">
                                    <th className="justify-self-start space-x-2 px-3">
                                        <input
                                            type="checkbox"
                                            checked={
                                                rows.length > 0 &&
                                                rows.every((r) => r.selected)
                                            }
                                            onChange={handleSelectAll}
                                            className="checkbox cursor-pointer"
                                        />
                                        <span>Last, First</span>
                                    </th>
                                    <th>DOC ID</th>
                                    <th className="">Attendance</th>
                                    <th className="">Note</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((row) => (
                                    <tr
                                        key={row.user_id}
                                        className="card w-full justify-items-center grid-cols-4 cursor-pointer p-2"
                                    >
                                        <td className="justify-self-start space-x-2">
                                            <input
                                                type="checkbox"
                                                checked={row.selected}
                                                onChange={() =>
                                                    handleToggleSelect(
                                                        row.user_id
                                                    )
                                                }
                                                className="checkbox cursor-pointer"
                                            />
                                            <span>
                                                {row.name_last},{' '}
                                                {row.name_first}{' '}
                                            </span>
                                        </td>
                                        <td className="items-center">
                                            {' '}
                                            {row.doc_id == ''
                                                ? ' '
                                                : `${row.doc_id}`}
                                        </td>
                                        <td className="flex justify-center space-x-2">
                                            <label className="flex items-center space-x-1 cursor-pointer">
                                                <input
                                                    type="radio"
                                                    name={`attendance_${row.user_id}`}
                                                    checked={
                                                        row.attendance_status ===
                                                        Attendance.Present
                                                    }
                                                    onChange={() =>
                                                        handleAttendanceChange(
                                                            row.user_id,
                                                            Attendance.Present
                                                        )
                                                    }
                                                    className="radio cursor-pointer"
                                                />
                                                <span>Present</span>
                                            </label>
                                            <label className="flex items-center space-x-1 cursor-pointer">
                                                <input
                                                    type="radio"
                                                    name={`attendance_${row.user_id}`}
                                                    checked={
                                                        row.attendance_status ===
                                                        Attendance.Absent_Excused
                                                    }
                                                    onChange={() =>
                                                        handleAttendanceChange(
                                                            row.user_id,
                                                            Attendance.Absent_Excused
                                                        )
                                                    }
                                                    className="radio cursor-pointer"
                                                />
                                                <span>Absent - excused</span>
                                            </label>
                                            <label className="flex items-center space-x-1 cursor-pointer">
                                                <input
                                                    type="radio"
                                                    name={`attendance_${row.user_id}`}
                                                    checked={
                                                        row.attendance_status ===
                                                        Attendance.Absent_Unexcused
                                                    }
                                                    onChange={() =>
                                                        handleAttendanceChange(
                                                            row.user_id,
                                                            Attendance.Absent_Unexcused
                                                        )
                                                    }
                                                    className="radio cursor-pointer"
                                                />
                                                <span>Absent - unexcused</span>
                                            </label>
                                        </td>

                                        <td className="justify-self-end align-middle">
                                            <TextInput
                                                label=""
                                                defaultValue={row.note}
                                                interfaceRef={`note_${row.user_id}`}
                                                required={false}
                                                length={500}
                                                errors={errors}
                                                register={register}
                                                onChange={(e) =>
                                                    handleNoteChange(
                                                        row.user_id,
                                                        e.target.value
                                                    )
                                                }
                                            />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="flex justify-end pt-4">
                        <button
                            type="submit"
                            className="button"
                            disabled={!anyRowSelected}
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
        </div>
    );
}
