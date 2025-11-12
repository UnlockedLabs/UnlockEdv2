import { useRef, useState, startTransition } from 'react';
import { useParams, useNavigate, useLoaderData } from 'react-router-dom';
import useSWR from 'swr';
import SearchBar from '@/Components/inputs/SearchBar';
import DropdownControl from '@/Components/inputs/DropdownControl';
import Pagination from '@/Components/Pagination';
import {
    Class,
    ClassEnrollment,
    ClassLoaderData,
    EnrollmentStatus,
    FilterResidentNames,
    ProgramCompletion,
    SelectedClassStatus,
    ServerResponseMany,
    ToastState
} from '@/common';
import API from '@/api/api';
import {
    closeModal,
    FormInputTypes,
    FormModal,
    showModal,
    TextModalType,
    TextOnlyModal
} from '@/Components/modals';
import CompletionDetailsModal from '@/Components/modals/CompletionDetailsModal';
import ClassEnrollmentDetailsTable from '@/Components/ClassEnrollmentDetailsTable';
import { AddButton } from '@/Components/inputs';
import { isCompletedCancelledOrArchived } from './ProgramOverviewDashboard';
import { FieldValues } from 'react-hook-form';
import { useToast } from '@/Context/ToastCtx';

interface StatusChange {
    name_full: string;
    user_id: number;
    status: string;
}

export default function ClassEnrollmentDetails() {
    const { class_id } = useParams<{ class_id: string }>();
    const navigate = useNavigate();
    const { redirect, class: clsInfo } = useLoaderData() as ClassLoaderData;
    const blockEdits = isCompletedCancelledOrArchived(clsInfo ?? ({} as Class));
    const { toaster } = useToast();

    const [searchTerm, setSearchTerm] = useState('');
    const [sortQuery, setSortQuery] = useState<string>(
        FilterResidentNames['Resident Name (A-Z)']
    );
    const [viewMode, setViewMode] = useState<'enrolled' | 'other'>('enrolled');
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [page, setPage] = useState(1);
    const [perPage, setPerPage] = useState(20);
    const [selectedResidents, setSelectedResidents] = useState<number[]>([]);
    const [completionDetails, setCompletionDetails] =
        useState<ProgramCompletion | null>(null);
    const [changeStatusValue, setChangeStatusValue] = useState<StatusChange>();
    const confirmStateChangeModal = useRef<HTMLDialogElement>(null);
    const completionDetailsModal = useRef<HTMLDialogElement>(null);
    const reasonModalRef = useRef<HTMLDialogElement>(null);
    const requiresReason = (status?: string) =>
        [
            'incomplete: withdrawn',
            'incomplete: dropped',
            'incomplete: failed to complete'
        ].includes(status?.toLowerCase() ?? '');

    const getStatusParam = () => {
        if (viewMode === 'enrolled') {
            return 'enrolled';
        }
        if (filterStatus === 'all' || filterStatus === '') {
            return 'not_enrolled';
        }
        return filterStatus;
    };

    const status = getStatusParam();
    const { data, error, isLoading, mutate } = useSWR<
        ServerResponseMany<ClassEnrollment>,
        Error
    >(
        `/api/program-classes/${class_id}/enrollments?search=${searchTerm}&page=${page}&per_page=${perPage}&order_by=${sortQuery}&status=${status}`
    );

    const otherStatus = viewMode === 'enrolled' ? 'not_enrolled' : 'enrolled';
    const { data: otherData, mutate: mutateOther } = useSWR<
        ServerResponseMany<ClassEnrollment>,
        Error
    >(
        `/api/program-classes/${class_id}/enrollments?per_page=1&status=${otherStatus}`
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

    const enrolledCount =
        viewMode === 'enrolled'
            ? meta?.total ?? 0
            : otherData?.meta?.total ?? 0;
    const otherCount =
        viewMode === 'enrolled'
            ? otherData?.meta?.total ?? 0
            : meta?.total ?? 0;

    const refreshEnrollmentData = async () => {
        await Promise.all([mutate(), mutateOther()]);
    };

    const handleViewModeChange = (mode: 'enrolled' | 'other') => {
        setViewMode(mode);
        setPage(1);
        setSelectedResidents([]);
        setFilterStatus('all');
    };

    const handleChange = (value: string, enrollment: ClassEnrollment) => {
        setSelectedResidents([]);
        setChangeStatusValue({
            status: value,
            user_id: enrollment.user_id,
            name_full: enrollment.name_full
        });
        if (requiresReason(value)) {
            showModal(reasonModalRef);
        } else {
            showModal(confirmStateChangeModal);
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
        if (selectedResidents.length === 0) return;
        setChangeStatusValue({
            status: EnrollmentStatus.Completed,
            user_id: selectedResidents[0],
            name_full:
                selectedResidents.length > 1
                    ? `${selectedResidents.length} Residents`
                    : enrollments.find(
                          (e) => e.user_id === selectedResidents[0]
                      )?.name_full ?? ''
        });
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

    const handleSubmitEnrollmentChange = async (reasonText?: string) => {
        if (!changeStatusValue) return;
        const { status, user_id } = changeStatusValue;
        const resp = await API.patch(
            `program-classes/${class_id}/enrollments`,
            {
                // If one or more users are selected with the check-boxes, then they are going to be
                // 'Graduated'. If selectedResidents is empty, that means the Dropdown is being used
                // to change an individual status inline.
                enrollment_status: changeStatusValue?.status ?? 'Completed',
                user_ids:
                    selectedResidents.length > 0
                        ? selectedResidents
                        : [user_id],
                ...(requiresReason(status) && {
                    change_reason: reasonText?.trim()
                })
            }
        );

        if (resp.success) {
            setSelectedResidents([]);
            setChangeStatusValue(undefined);
            await refreshEnrollmentData();
        } else {
            toaster(
                "Unable to update resident's enrollment status",
                ToastState.error
            );
        }
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
        'Segregated - Dropped' = 'Incomplete: Segregated',
        'Failed To Complete' = 'Incomplete: Failed to Complete'
    }

    const getEnrollmentStatusOptions = (): Record<string, string> => {
        switch (
            clsInfo?.status //displays differently per scheduled or active see asana ticket ID 394
        ) {
            case SelectedClassStatus.Scheduled:
                return Object.fromEntries(
                    Object.entries(EnrollmentStatusOptions).filter(
                        ([value]) =>
                            value === 'Cancelled' || value === 'Enrolled'
                    )
                );
            case SelectedClassStatus.Active:
                return Object.fromEntries(
                    Object.entries(EnrollmentStatusOptions).filter(
                        ([value]) => value !== 'Cancelled'
                    )
                );
            default:
                return { ...EnrollmentStatusOptions };
        }
    };

    return (
        <div className="flex flex-col gap-8">
            <div className="flex flex-row justify-between items-center">
                <div className="flex flex-row gap-2 items-center">
                    <div className="inline-flex rounded-md border border-grey-2 h-12">
                        <button
                            onClick={() => handleViewModeChange('enrolled')}
                            className={`px-4 text-sm font-medium transition-colors ${
                                viewMode === 'enrolled'
                                    ? 'bg-teal-3 text-white hover:bg-teal-4'
                                    : 'bg-transparent text-body-text hover:bg-teal-1'
                            } rounded-l-md`}
                        >
                            Enrolled ({enrolledCount})
                        </button>
                        <button
                            onClick={() => handleViewModeChange('other')}
                            className={`px-4 text-sm font-medium transition-colors border-l border-grey-2 ${
                                viewMode === 'other'
                                    ? 'bg-teal-3 text-white hover:bg-teal-4'
                                    : 'bg-transparent text-body-text hover:bg-teal-1'
                            } rounded-r-md`}
                        >
                            Graduated/Other ({otherCount})
                        </button>
                    </div>
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
                    {viewMode === 'other' && (
                        <DropdownControl
                            customCallback={(value) => {
                                setFilterStatus(value);
                                setPage(1);
                            }}
                            enumType={{
                                All: 'all',
                                Completed: 'completed',
                                Withdrawn: 'incomplete: withdrawn',
                                Dropped: 'incomplete: dropped',
                                'Failed To Complete':
                                    'incomplete: failed to complete',
                                Transferred: 'incomplete: transferred',
                                Segregated: 'incomplete: segregated',
                                Cancelled: 'cancelled'
                            }}
                        />
                    )}
                </div>
                <div
                    className={`flex gap-2 ${blockEdits ? 'tooltip tooltip-left' : ''}`}
                    data-tip={
                        blockEdits
                            ? `This class is ${clsInfo?.status.toLowerCase()} and cannot be modified.`
                            : undefined
                    }
                >
                    {selectedResidents.length > 0 &&
                        clsInfo?.status === SelectedClassStatus.Active && (
                            <button
                                disabled={blockEdits}
                                className="button"
                                onClick={handleOpenModalGraduate}
                            >
                                Graduate Selected
                            </button>
                        )}
                    <AddButton
                        label="Add Resident"
                        disabled={blockEdits}
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
                    statusOptions={getEnrollmentStatusOptions()}
                    selectedResidents={selectedResidents}
                    toggleSelection={toggleSelection}
                    handleSelectAll={handleSelectAll}
                    areAllSelected={areAllSelected}
                    canToggle={canToggle}
                    isEditable={isEditable}
                    handleChange={handleChange}
                    handleShowCompletionDetails={handleShowCompletionDetails}
                    viewMode={viewMode}
                    classInfo={clsInfo}
                    onEnrollmentUpdate={() => void refreshEnrollmentData()}
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

            <FormModal
                ref={reasonModalRef}
                title="Confirm Enrollment Action"
                showCancel
                submitText="Confirm"
                defaultValues={{ reason: '' }}
                inputs={[
                    {
                        type: FormInputTypes.TextArea,
                        label: `Please add the reason for changing ${changeStatusValue?.name_full}'s status to ${changeStatusValue?.status}`,
                        interfaceRef: 'change_reason',
                        required: true,
                        length: 255,
                        validate: (val: string) =>
                            val.trim().length > 0 || 'Reason is required'
                    }
                ]}
                onSubmit={async (formData: FieldValues) => {
                    const reason = (
                        formData as { change_reason: string }
                    ).change_reason.trim();
                    await handleSubmitEnrollmentChange(reason);
                    closeModal(reasonModalRef);
                    setChangeStatusValue(undefined);
                }}
                onClose={() => {
                    closeModal(reasonModalRef);
                    setChangeStatusValue(undefined);
                }}
            />
            <TextOnlyModal
                ref={confirmStateChangeModal}
                type={TextModalType.Confirm}
                title="Confirm Enrollment Action"
                text={`Are you sure you want to permanently change the status to "${changeStatusValue?.status}" for ${changeStatusValue?.name_full ?? 'the selected users'}? This cannot be undone.`}
                onSubmit={() => void handleSubmitEnrollmentChange()}
                onClose={() => {
                    closeModal(confirmStateChangeModal);
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
