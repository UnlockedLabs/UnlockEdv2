import { useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import useSWR from 'swr';
import { AxiosError } from 'axios';
import SearchBar from '@/Components/inputs/SearchBar';
import DropdownControl from '@/Components/inputs/DropdownControl';
import Pagination from '@/Components/Pagination';
import { ClassEnrollment, ServerResponseMany } from '@/common';
import API from '@/api/api';
import { TextModalType, TextOnlyModal } from '@/Components/modals';

export default function EnrollmentList() {
    const { id, class_id } = useParams<{ id: string; class_id: string }>();
    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = useState('');
    const [sortQuery, setSortQuery] = useState<string>('name_full asc');
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [page, setPage] = useState(1);
    const [perPage, setPerPage] = useState(20);
    const [selectedResidents, setSelectedResidents] = useState<number[]>([]);
    const [hasUpdated, setHasUpdated] = useState(false);
    const confirmGraduateModal = useRef<HTMLDialogElement>(null);

    const { data, error, isLoading, mutate } = useSWR<
        ServerResponseMany<ClassEnrollment>,
        AxiosError
    >(
        `/api/programs/${id}/sections/${class_id}/enrollments?search=${searchTerm}&page=${page}&per_page=${perPage}&order_by=${sortQuery}&status=${filterStatus}`
    );

    const enrollments = data?.data ?? [];
    const meta = data?.meta;

    const handleChange = async (value: string, userId: number) => {
        await API.patch(
            `programs/${id}/sections/${class_id}?user_id=${userId}`,
            {
                enrollment_status: value
            }
        );
        setHasUpdated(true);
        await mutate();
    };

    const toggleSelection = (userId: number) => {
        setSelectedResidents((prev) =>
            prev.includes(userId)
                ? prev.filter((id) => id !== userId)
                : [...prev, userId]
        );
    };

    const handleSelectAll = () => {
        if (selectedResidents.length === enrollments.length) {
            setSelectedResidents([]);
        } else {
            setSelectedResidents(enrollments.map((e) => e.id));
        }
    };

    const handleOpenGraduateModal = () => {
        if (selectedResidents.length > 0 && confirmGraduateModal.current) {
            confirmGraduateModal.current.showModal();
        }
    };

    const handleGraduate = async () => {
        if (selectedResidents.length === 0) return;
        await API.patch(`programs/${id}/sections/${class_id}/enrollments`, {
            enrollment_status: 'Completed',
            user_ids: selectedResidents
        });
        setSelectedResidents([]);
        await mutate();
    };

    const inlineOptions = {
        Enrolled: 'Enrolled',
        Canceled: 'Canceled',
        'Incomplete: Withdrawn': 'Incomplete: Withdrawn',
        'Incomplete: Dropped': 'Incomplete: Dropped',
        'Incomplete: Failed-to-Complete': 'Incomplete: Failed-to-Complete'
    };

    const isEditable = (enrollment: ClassEnrollment) =>
        enrollment.enrollment_status === 'Enrolled' &&
        !hasUpdated &&
        !selectedResidents.includes(enrollment.user_id);

    const areAllSelected =
        enrollments.length > 0 &&
        selectedResidents.length === enrollments.length;

    return (
        <div className="px-5 pb-4">
            <div className="flex flex-col gap-8 py-8">
                {/* Search, sorting, filtering, and action buttons */}
                <div className="flex flex-row justify-between items-center">
                    <div className="flex flex-row gap-2 items-center">
                        <SearchBar
                            searchTerm={searchTerm}
                            changeCallback={(term) => {
                                setSearchTerm(term);
                                setPage(1);
                            }}
                        />
                        <DropdownControl
                            label="Sort by"
                            setState={(value) => {
                                setSortQuery(value);
                                setPage(1);
                            }}
                            enumType={{
                                'Resident Name (A-Z)': 'name_full asc',
                                'Resident Name (Z-A)': 'name_full desc',
                                'Resident ID (Asc)': 'doc_id asc',
                                'Resident ID (Desc)': 'doc_id desc'
                            }}
                        />
                        <DropdownControl
                            label="Filter by Status"
                            setState={(value) => {
                                setFilterStatus(value);
                                setPage(1);
                            }}
                            enumType={{
                                All: 'all',
                                Enrolled: 'enrolled',
                                Completed: 'completed',
                                Dropped: 'dropped'
                            }}
                        />
                    </div>
                    <div className="flex gap-2">
                        {selectedResidents.length > 0 && (
                            <button
                                className="button btn-secondary"
                                onClick={handleOpenGraduateModal}
                            >
                                Graduate Class
                            </button>
                        )}
                        <button
                            className="button btn-primary"
                            onClick={() =>
                                navigate(
                                    `/programs/${id}/classes/${class_id}/add`
                                )
                            }
                        >
                            Add Resident
                        </button>
                    </div>
                </div>
                {/* Enrollment table */}
                <div className="overflow-hidden border p-4">
                    <table className="table w-full table-fixed mb-2 shadow-lg">
                        <thead>
                            <tr className="text-sm">
                                <th className="h-14 pr-2">
                                    <input
                                        className="checkbox"
                                        type="checkbox"
                                        checked={areAllSelected}
                                        onChange={handleSelectAll}
                                    />
                                </th>
                                <th className="h-14 pr-2">Resident Name</th>
                                <th className="h-14 pr-2">Resident ID</th>
                                <th className="h-14">Enrolled Date</th>
                                <th className="h-14">Completion</th>
                                <th className="h-14">Enrollment Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {!isLoading && !error ? (
                                enrollments.length > 0 ? (
                                    enrollments.map(
                                        (enrollment: ClassEnrollment) => (
                                            <tr
                                                key={enrollment.id}
                                                className="cursor-pointer"
                                                onClick={() =>
                                                    toggleSelection(
                                                        enrollment.user_id
                                                    )
                                                }
                                            >
                                                <td className="pr-2">
                                                    <input
                                                        className="checkbox"
                                                        type="checkbox"
                                                        checked={selectedResidents.includes(
                                                            enrollment.user_id
                                                        )}
                                                        onChange={() =>
                                                            toggleSelection(
                                                                enrollment.user_id
                                                            )
                                                        }
                                                        onClick={(e) =>
                                                            e.stopPropagation()
                                                        }
                                                    />
                                                </td>
                                                <td className="pr-2">
                                                    {enrollment.name_full}
                                                </td>
                                                <td className="pr-2">
                                                    {enrollment.doc_id}
                                                </td>
                                                <td>
                                                    {new Date(
                                                        enrollment.created_at
                                                    ).toLocaleDateString()}
                                                </td>
                                                <td>
                                                    {enrollment.completion_date ? (
                                                        <span>
                                                            {
                                                                enrollment.enrollment_status
                                                            }
                                                            {enrollment.completion_date
                                                                ? ` on ${new Date(
                                                                      enrollment.completion_date
                                                                  ).toLocaleDateString()}`
                                                                : ''}
                                                        </span>
                                                    ) : (
                                                        'N/A'
                                                    )}
                                                </td>
                                                <td>
                                                    {isEditable(enrollment) ? (
                                                        <DropdownControl
                                                            enumType={
                                                                inlineOptions
                                                            }
                                                            customCallback={(
                                                                val
                                                            ) => {
                                                                void handleChange(
                                                                    val,
                                                                    enrollment.id
                                                                );
                                                            }}
                                                            label={
                                                                enrollment.enrollment_status
                                                            }
                                                        />
                                                    ) : (
                                                        <span>
                                                            {
                                                                enrollment.enrollment_status
                                                            }
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        )
                                    )
                                ) : (
                                    <tr>
                                        <td
                                            colSpan={6}
                                            className="text-center text-gray-500"
                                        >
                                            No enrollments found.
                                        </td>
                                    </tr>
                                )
                            ) : (
                                <tr>
                                    <td
                                        colSpan={6}
                                        className="text-center text-blue-500"
                                    >
                                        Loading...
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                    <div className="flex justify-center m-2">
                        {meta && (
                            <Pagination
                                meta={meta}
                                setPage={setPage}
                                setPerPage={setPerPage}
                            />
                        )}
                    </div>
                    <TextOnlyModal
                        ref={confirmGraduateModal}
                        type={TextModalType.Confirm}
                        title={'Confirm Graduate Class'}
                        text={
                            'Are you sure you want to graduate the selected residents from this class? This action cannot be undone.'
                        }
                        onSubmit={() => void handleGraduate()}
                        onClose={() => {
                            if (confirmGraduateModal.current) {
                                confirmGraduateModal.current.close();
                            }
                        }}
                    />
                </div>
            </div>
        </div>
    );
}
