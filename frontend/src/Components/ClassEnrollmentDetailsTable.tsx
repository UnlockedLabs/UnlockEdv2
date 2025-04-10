import React from 'react';
import DropdownControl from '@/Components/inputs/DropdownControl';
import { ClassEnrollment } from '@/common';

interface EnrollmentTableProps {
    enrollments: ClassEnrollment[];
    inlineOptions: Record<string, string>;
    selectedResidents: number[];
    toggleSelection: (userId: number) => void;
    handleSelectAll: () => void;
    areAllSelected: boolean;
    canToggle: (enrollment: ClassEnrollment) => boolean;
    isEditable: (enrollment: ClassEnrollment) => boolean;
    handleChange: (value: string, enrollment: ClassEnrollment) => void;
    handleShowCompletionDetails: (enrollment: ClassEnrollment) => Promise<void>;
}

const ClassEnrollmentDetailsTable: React.FC<EnrollmentTableProps> = ({
    enrollments,
    inlineOptions,
    selectedResidents,
    toggleSelection,
    handleSelectAll,
    areAllSelected,
    canToggle,
    isEditable,
    handleChange,
    handleShowCompletionDetails
}) => {
    const translateEnrollmentStatus = (status: string) => {
        if (status.startsWith('Incomplete: ')) {
            return status.replace('Incomplete: ', '');
        }
        return status;
    };
    return (
        <div className="relative w-full" style={{ overflowX: 'clip' }}>
            <table className="table-2 mb-4">
                <thead>
                    <tr className="grid grid-cols-6 pb-4">
                        <th className="justify-self-start pl-4">
                            <input
                                className="checkbox"
                                type="checkbox"
                                checked={areAllSelected}
                                onChange={handleSelectAll}
                            />
                        </th>
                        <th>Name</th>
                        <th>DOC ID</th>
                        <th>Enrolled Date</th>
                        <th>Completion</th>
                        <th className="justify-self-end pr-4">
                            Enrollment Status
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {enrollments.length > 0 ? (
                        enrollments.map((enrollment: ClassEnrollment) => (
                            <tr
                                key={enrollment.id}
                                className={`card h-16 w-full grid-cols-6 justify-items-center cursor-pointer ${!canToggle(enrollment) ? 'bg-gray-100' : ''}`}
                                onClick={() => {
                                    if (canToggle(enrollment))
                                        toggleSelection(enrollment.user_id);
                                }}
                            >
                                <td className="justify-self-start pl-4">
                                    <input
                                        className="checkbox justify-self-start"
                                        type="checkbox"
                                        checked={selectedResidents.includes(
                                            enrollment.user_id
                                        )}
                                        onChange={() => {
                                            if (canToggle(enrollment))
                                                toggleSelection(
                                                    enrollment.user_id
                                                );
                                        }}
                                        disabled={!canToggle(enrollment)}
                                        onClick={(e) => e.stopPropagation()}
                                    />
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
                                        <div className="flex flex-col justify-center items-center">
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
                                            customCallback={(val) =>
                                                handleChange(val, enrollment)
                                            }
                                            label={translateEnrollmentStatus(
                                                enrollment.enrollment_status
                                            )}
                                        />
                                    ) : (
                                        <div className="h-12 w-48 bg-white border-2 grey-1 rounded-md flex items-center justify-center">
                                            <span className="text-md font-bold">
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
                </tbody>
            </table>
        </div>
    );
};

export default ClassEnrollmentDetailsTable;
