import { useRef, useState, startTransition } from 'react';
import { useParams, useNavigate, useLoaderData } from 'react-router-dom';
import useSWR from 'swr';
import SearchBar from '@/Components/inputs/SearchBar';
import DropdownControl from '@/Components/inputs/DropdownControl';
import Pagination from '@/Components/Pagination';
import {
    ClassEnrollment,
    ClassLoaderData,
    EnrollmentStatus,
    FilterResidentNames,
    ProgramCompletion,
    SelectedClassStatus,
    ServerResponseMany
} from '@/common';
import API from '@/api/api';
import { TextModalType, TextOnlyModal } from '@/Components/modals';
import CompletionDetailsModal from '@/Components/modals/CompletionDetailsModal';
import ClassEnrollmentDetailsTable from '@/Components/ClassEnrollmentDetailsTable';
import { AddButton } from '@/Components/inputs';

interface StatusChange {
    name_full: string;
    user_id: number;
    status: string;
}

export default function ClassEnrollmentDetails() {
    const { class_id } = useParams<{ class_id: string }>();
    const navigate = useNavigate();
    const { redirect } = useLoaderData() as ClassLoaderData;
    const { class: clsInfo } = useLoaderData() as ClassLoaderData;
    const [searchTerm, setSearchTerm] = useState('');
    const [sortQuery, setSortQuery] = useState<string>(
        FilterResidentNames['Resident Name (A-Z)']
    );
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [page, setPage] = useState(1);
    const [perPage, setPerPage] = useState(20);
    const [selectedResidents, setSelectedResidents] = useState<number[]>([]);
    const [completionDetails, setCompletionDetails] =
        useState<ProgramCompletion | null>(null);
    const [changeStatusValue, setChangeStatusValue] = useState<StatusChange>();
    const confirmStateChangeModal = useRef<HTMLDialogElement>(null);
    const completionDetailsModal = useRef<HTMLDialogElement>(null);
    const [showOthers, setShowOthers] = useState(false);

    const { data, error, isLoading, mutate } = useSWR<
        ServerResponseMany<ClassEnrollment>,
        Error
    >(
        `/api/program-classes/${class_id}/enrollments?search=${searchTerm}&page=${page}&per_page=${perPage}&order_by=${sortQuery}&status=${filterStatus}`
    );
    if (error || redirect) {
        navigate(
            error?.message === 'Not Found' || redirect ? '/404' : '/error'
        );
    }
    const handleSearchTermChange = (newTerm: string) => {
        startTransition(() => {
            setSearchTerm(newTerm);
        });
    };
    const enrollments = data?.data ?? [];
    const meta = data?.meta;

    const handleChange = (value: string, enrollment: ClassEnrollment) => {
        setSelectedResidents([]);
        setChangeStatusValue({
            status: value,
            user_id: enrollment.user_id,
            name_full: enrollment.name_full
        });
        if (confirmStateChangeModal.current) {
            confirmStateChangeModal.current.showModal();
        }
    };

    const toggleSelection = (userId: number) => {
        setSelectedResidents((prev) =>
            prev.includes(userId)
                ? prev.filter((id) => id !== userId)
                : [...prev, userId]
        );
    };

    const handleSelectAll = () => {
        if (
            selectedResidents.length ===
            enrollments.filter((e) => e.completion_dt === '').length
        ) {
            setSelectedResidents([]);
        } else {
            setSelectedResidents(
                enrollments
                    .filter((e) => e.completion_dt === '' && isEditable(e))
                    .map((e) => e.user_id)
            );
        }
    };

    const handleOpenModalGraduate = () => {
        if (selectedResidents.length > 0 && confirmStateChangeModal.current) {
            confirmStateChangeModal.current.showModal();
        }
    };

    const handleShowCompletionDetails = async (enrollment: ClassEnrollment) => {
        const response = (await API.get<ProgramCompletion>(
            `users/${enrollment.user_id}/program-completions?class_id=${enrollment.class_id}`
        )) as ServerResponseMany<ProgramCompletion>;
        if (response.success && response.data.length > 0) {
            setCompletionDetails(response.data[0]);
            if (completionDetailsModal.current) {
                completionDetailsModal.current.showModal();
            }
        }
    };

    const handleSubmitEnrollmentChange = async () => {
        await API.patch(`program-classes/${class_id}/enrollments`, {
            // If one or more users are selected with the check-boxes, then they are going to be
            // 'Graduated'. If selectedResidents is empty, that means the Dropdown is being used
            // to change an individual status inline.
            enrollment_status: changeStatusValue?.status ?? 'Completed',
            user_ids:
                selectedResidents.length === 0
                    ? [changeStatusValue?.user_id]
                    : selectedResidents
        });
        setSelectedResidents([]);
        await mutate();
    };

    const isEditable = (enrollment: ClassEnrollment) =>
        enrollment.enrollment_status === EnrollmentStatus.Enrolled &&
        !selectedResidents.includes(enrollment.user_id);

    const areAllSelected =
        enrollments.length > 0 &&
        enrollments.filter((e) => e.completion_dt === '').length ===
            selectedResidents.length;

    const canToggle = (e: ClassEnrollment): boolean => {
        return (
            e.completion_dt === '' &&
            e.enrollment_status === EnrollmentStatus.Enrolled
        );
    };

    // limited options for the user to select so we cannot pass in the EnrollmentStatus enum
    enum EnrollmentStatusOptions {
        Enrolled = 'Enrolled',
        Cancelled = 'Cancelled',
        Completed = 'Completed',
        Withdrawn = 'Incomplete: Withdrawn',
        Dropped = 'Incomplete: Dropped',
        'Failed To Complete' = 'Incomplete: Failed to Complete'
    }

    return (
        <div className="flex flex-col gap-8">
            <div className="flex flex-row justify-between items-center">
                <div className="flex flex-row gap-2 items-center">
                    <SearchBar
                        searchTerm={searchTerm}
                        changeCallback={(term) => {
                            handleSearchTermChange(term);
                            setPage(1);
                        }}
                    />
                    <DropdownControl
                        customCallback={(value) => {
                            setSortQuery(value);
                            setPage(1);
                        }}
                        enumType={{
                            ...FilterResidentNames,
                            'Resident ID (Asc)': 'doc_id asc',
                            'Resident ID (Desc)': 'doc_id desc',
                            'Enrollment Date (Asc)': 'start_dt asc',
                            'Enrollment Date (Desc)': 'start_dt desc'
                        }}
                    />
                    <DropdownControl
                        customCallback={(value) => {
                            setFilterStatus(value);
                            setPage(1);
                        }}
                        enumType={{
                            All: 'all',
                            Enrolled: 'enrolled',
                            Completed: 'completed',
                            Withdrawn: 'incomplete: withdrawn',
                            Dropped: 'incomplete: dropped',
                            'Failed To Complete':
                                'incomplete: failed to complete',
                            Transferred: 'incomplete: transferred',
                            Canceled: 'incomplete: cancelled'
                        }}
                    />
                </div>
                <div className="flex gap-2">
                    {selectedResidents.length > 0 && (
                        <button
                            className="button"
                            onClick={handleOpenModalGraduate}
                        >
                            Graduate Selected
                        </button>
                    )}
                    <AddButton
                        label="Add Resident"
                        disabled={
                            clsInfo?.status === SelectedClassStatus.Cancelled ||
                            clsInfo?.status === SelectedClassStatus.Completed
                        }
                        onClick={() =>
                            navigate(
                                `/program-classes/${class_id}/enrollments/add`
                            )
                        }
                    />
                </div>
            </div>
            {!isLoading && !error && (
                <ClassEnrollmentDetailsTable
                    enrollments={enrollments}
                    statusOptions={EnrollmentStatusOptions}
                    selectedResidents={selectedResidents}
                    toggleSelection={toggleSelection}
                    handleSelectAll={handleSelectAll}
                    areAllSelected={areAllSelected}
                    canToggle={canToggle}
                    isEditable={isEditable}
                    handleChange={handleChange}
                    handleShowCompletionDetails={handleShowCompletionDetails}
                    showOthers={showOthers}
                    setShowOthers={setShowOthers}
                />
            )}
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
                ref={confirmStateChangeModal}
                type={TextModalType.Confirm}
                title={'Confirm Enrollment Action'}
                text={`Are you sure you want to permanently change the status to ${
                    changeStatusValue?.status ?? 'Completed'
                } for ${changeStatusValue?.name_full ?? 'the selected users'}? This action cannot be undone.`}
                onSubmit={() => {
                    void handleSubmitEnrollmentChange();
                }}
                onClose={() => {
                    if (confirmStateChangeModal.current) {
                        confirmStateChangeModal.current.close();
                    }
                    setChangeStatusValue(undefined);
                }}
            />
            <CompletionDetailsModal
                enrollment={completionDetails}
                modalRef={completionDetailsModal}
                onClose={() => setCompletionDetails(null)}
            />
        </div>
    );
}
