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

const EnrollmentsTable: React.FC<EnrollmentTableProps> = ({
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
    return (
        <div className="overflow-hidden border p-4">
            <table className="table table-fixed w-full mb-2 shadow-lg">
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
                        <th className="h-14 px-2 text-center">Completion</th>
                        <th className="h-14">Enrollment Status</th>
                    </tr>
                </thead>
                <tbody>
                    {enrollments.length > 0 ? (
                        enrollments.map((enrollment: ClassEnrollment) => (
                            <tr
                                key={enrollment.id}
                                className="cursor-pointer h-16"
                                onClick={() => {
                                    if (canToggle(enrollment))
                                        toggleSelection(enrollment.user_id);
                                }}
                            >
                                <td className="pr-2">
                                    <input
                                        className="checkbox"
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
                                <td className="pr-2">{enrollment.name_full}</td>
                                <td className="pr-2">{enrollment.doc_id}</td>
                                <td>
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
                                <td>
                                    {isEditable(enrollment) ? (
                                        <DropdownControl
                                            enumType={inlineOptions}
                                            customCallback={(val) =>
                                                handleChange(val, enrollment)
                                            }
                                            label={enrollment.enrollment_status}
                                        />
                                    ) : (
                                        <span>
                                            {enrollment.enrollment_status}
                                        </span>
                                    )}
                                </td>
                            </tr>
                        ))
                    ) : (
                        <tr>
                            <td
                                colSpan={6}
                                className="text-center text-gray-500"
                            >
                                No enrollments found.
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
};

export default EnrollmentsTable;
