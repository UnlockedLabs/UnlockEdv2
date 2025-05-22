import DropdownControl from '@/Components/inputs/DropdownControl';
import { ClassEnrollment, EnrollmentStatus } from '@/common';

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
    showOthers: boolean;
    setShowOthers: (show: boolean) => void;
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
    showOthers,
    setShowOthers
}) => {
    const translateEnrollmentStatus = (status: string) =>
        status.startsWith('Incomplete: ')
            ? status.replace('Incomplete: ', '')
            : status;

    const enrolledStudents = enrollments.filter(
        (e) => e.enrollment_status === EnrollmentStatus.Enrolled
    );
    const otherStatusStudents = enrollments.filter(
        (e) => e.enrollment_status !== EnrollmentStatus.Enrolled
    );

    const renderTableHeader = (enrolled: boolean) => (
        <tr className="grid grid-cols-6 justify-items-start pb-4">
            <th className="justify-self-start pl-4">
                {enrolled && (
                    <input
                        className="checkbox"
                        type="checkbox"
                        checked={areAllSelected}
                        onChange={handleSelectAll}
                    />
                )}
            </th>
            <th className="pr-4">Name</th>
            <th>DOC ID</th>
            <th>Enrolled Date</th>
            <th>Completion</th>
            <th>Enrollment Status</th>
        </tr>
    );

    const renderTableBody = (rows: ClassEnrollment[], enrolled: boolean) => (
        <>
            {rows.length > 0 ? (
                rows.map((enrollment) => (
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
                            {enrolled && (
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
                        <td className="px-2">
                            {new Date(
                                enrollment.created_at
                            ).toLocaleDateString()}
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
                                <DropdownControl
                                    enumType={inlineOptions}
                                    value={enrollment.enrollment_status}
                                    customCallback={(val) =>
                                        handleChange(val, enrollment)
                                    }
                                />
                            ) : (
                                <div className="h-12 w-48 border-2 grey-3 rounded-md flex items-center justify-center">
                                    <span className="menu-title">
                                        {translateEnrollmentStatus(
                                            enrollment.enrollment_status
                                        )}
                                    </span>
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
            <h2 className="text-xl font-bold mb-2">Enrolled Students</h2>
            <table className="table-2 mb-4">
                <thead>{renderTableHeader(true)}</thead>
                <tbody>{renderTableBody(enrolledStudents, true)}</tbody>
            </table>
            {otherStatusStudents.length > 0 && (
                <button
                    type="button"
                    className="button-outline mb-2"
                    onClick={() => setShowOthers(!showOthers)}
                >
                    {showOthers ? 'Hide Other' : 'Show Other'}
                </button>
            )}

            {showOthers && (
                <>
                    <h2 className="text-xl font-bold my-2">
                        Graduated/Incomplete Status Students
                    </h2>
                    <table className="table-2 mb-4">
                        <thead>{renderTableHeader(false)}</thead>
                        <tbody>
                            {renderTableBody(otherStatusStudents, false)}
                        </tbody>
                    </table>
                </>
            )}
        </div>
    );
};

export default ClassEnrollmentDetailsTable;
