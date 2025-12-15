import DropdownControl from '@/Components/inputs/DropdownControl';
import { ClassEnrollment, EnrollmentStatus, Class } from '@/common';
import EditableEnrollmentDate from './EditableEnrollmentDate';
import ULIComponent from './ULIComponent';
import { InformationCircleIcon } from '@heroicons/react/24/outline';

interface EnrollmentTableProps {
    enrollments: ClassEnrollment[];
    statusOptions: Record<string, string>;
    selectedResidents: number[];
    toggleSelection: (userId: number) => void;
    handleSelectAll: () => void;
    areAllSelected: boolean;
    canToggle: (enrollment: ClassEnrollment) => boolean;
    isEditable: (enrollment: ClassEnrollment) => boolean;
    handleChange: (value: string, enrollment: ClassEnrollment) => void;
    handleShowCompletionDetails: (enrollment: ClassEnrollment) => Promise<void>;
    viewMode: 'enrolled' | 'other';
    classInfo?: Class;
    onEnrollmentUpdate: () => void;
}

const ClassEnrollmentDetailsTable: React.FC<EnrollmentTableProps> = ({
    enrollments,
    statusOptions: inlineOptions,
    selectedResidents,
    toggleSelection,
    handleSelectAll,
    areAllSelected,
    canToggle,
    isEditable,
    handleChange,
    handleShowCompletionDetails,
    viewMode,
    classInfo,
    onEnrollmentUpdate
}) => {
    const translateEnrollmentStatus = (status: string) =>
        status.startsWith('Incomplete: ')
            ? status.replace('Incomplete: ', '')
            : status;

    const isEnrolledView = viewMode === 'enrolled';

    const renderTableHeader = () => (
        <tr className="grid grid-cols-6 justify-items-start pb-4">
            <th className="justify-self-start pl-4">
                {isEnrolledView && (
                    <input
                        className="checkbox"
                        type="checkbox"
                        checked={areAllSelected}
                        onChange={handleSelectAll}
                    />
                )}
            </th>
            <th className="pr-4">Name</th>
            <th>Resident ID</th>
            <th>Enrolled Date</th>
            <th>Completion</th>
            <th>Enrollment Status</th>
        </tr>
    );

    const renderTableBody = () => (
        <>
            {enrollments.length > 0 ? (
                enrollments.map((enrollment) => (
                    <tr
                        key={enrollment.id}
                        className={`card h-16 w-full grid-cols-6 justify-items-start cursor-pointer ${
                            !canToggle(enrollment) ? 'bg-background' : ''
                        }`}
                        onClick={() => {
                            if (canToggle(enrollment)) {
                                toggleSelection(enrollment.user_id);
                            }
                        }}
                    >
                        <td className="justify-self-start pl-4">
                            {isEnrolledView && (
                                <input
                                    className="checkbox justify-self-start"
                                    type="checkbox"
                                    checked={selectedResidents.includes(
                                        enrollment.user_id
                                    )}
                                    onChange={() => {
                                        if (canToggle(enrollment)) {
                                            toggleSelection(enrollment.user_id);
                                        }
                                    }}
                                    disabled={!canToggle(enrollment)}
                                    onClick={(e) => e.stopPropagation()}
                                />
                            )}
                        </td>
                        <td className="px-2">{enrollment.name_full}</td>
                        <td className="px-2">{enrollment.doc_id}</td>
                        <td
                            className="px-2"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <EditableEnrollmentDate
                                enrollment={enrollment}
                                classInfo={classInfo}
                                onUpdate={onEnrollmentUpdate}
                                disabled={
                                    enrollment.enrollment_status !==
                                    EnrollmentStatus.Enrolled
                                }
                            />
                        </td>
                        <td className="text-center">
                            {enrollment.completion_dt ? (
                                <div className="flex flex-col justify-center items-start">
                                    <span>
                                        {new Date(
                                            enrollment.completion_dt
                                        ).toLocaleDateString()}
                                    </span>
                                    <button
                                        className="text-primary text-sm underline"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            void handleShowCompletionDetails(
                                                enrollment
                                            );
                                        }}
                                    >
                                        Details
                                    </button>
                                </div>
                            ) : (
                                'N/A'
                            )}
                        </td>
                        <td
                            className="pr-4"
                            onClick={(e) => {
                                e.stopPropagation();
                            }}
                        >
                            {isEditable(enrollment) ? (
                                <div className="sm:min-w-[10rem] sm:max-w-[10rem] lg:min-w-[11.6rem] lg:max-w-[11.6rem]">
                                    <DropdownControl
                                        enumType={inlineOptions}
                                        value={enrollment.enrollment_status}
                                        customCallback={(val) =>
                                            handleChange(val, enrollment)
                                        }
                                    />
                                </div>
                            ) : (
                                <div className="min-h-12 sm:min-w-[10rem] sm:max-w-[10rem] lg:min-w-[11.6rem] lg:max-w-[11.6rem] border-2 grey-3 rounded-md flex flex-col items-center justify-center text-center px-2">
                                    <div className="flex items-center gap-2 justify-center break-words">
                                        <span className="menu-title text-[12px] leading-5">
                                            {translateEnrollmentStatus(
                                                enrollment.enrollment_status
                                            )}
                                        </span>
                                        {viewMode === 'other' &&
                                            enrollment.change_reason && (
                                                <ULIComponent
                                                    icon={InformationCircleIcon}
                                                    tooltipClassName="tooltip-left cursor-help"
                                                    dataTip={
                                                        enrollment.change_reason
                                                    }
                                                />
                                            )}
                                    </div>
                                </div>
                            )}
                        </td>
                    </tr>
                ))
            ) : (
                <tr>
                    <td colSpan={6} className="text-center">
                        No enrollments found.
                    </td>
                </tr>
            )}
        </>
    );

    return (
        <div className="relative w-full" style={{ overflowX: 'clip' }}>
            <h2 className="text-xl font-bold mb-2">
                {isEnrolledView
                    ? 'Enrolled Students'
                    : 'Graduated/Incomplete Status Students'}
            </h2>
            <table className="table-2 mb-4">
                <thead>{renderTableHeader()}</thead>
                <tbody>{renderTableBody()}</tbody>
            </table>
        </div>
    );
};

export default ClassEnrollmentDetailsTable;
