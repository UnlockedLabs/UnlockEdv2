import React, { forwardRef, useState } from 'react';
import { FormInputTypes, FormModal, Input } from '.';
import { CancelEventReason } from '@/common';
import API from '@/api/api';
import { FieldValues, SubmitHandler } from 'react-hook-form';
import useSWR from 'swr';
import {
    BulkCancelSessionsPreview,
    BulkCancelSessionsRequest,
    Instructor,
    InstructorClassData
} from '@/types/events';

interface BulkCancelSessionsFormModalProps {
    ref: React.ForwardedRef<HTMLDialogElement>;
    facilityId: number;
    onSubmit: (
        request: BulkCancelSessionsRequest,
        preview: BulkCancelSessionsPreview
    ) => void;
}

export const BulkCancelSessionsFormModal = forwardRef(function (
    { facilityId, onSubmit }: BulkCancelSessionsFormModalProps,
    ref: React.ForwardedRef<HTMLDialogElement>
) {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const { data: instructorsResponse, error: instructorsError } = useSWR<
        { message: string; data: Instructor[] },
        Error
    >(`/api/facilities/${facilityId}/instructors`);

    const instructors = instructorsResponse?.data ?? [];
    const instructorsErrorFiltered =
        instructorsError &&
        !instructorsError.message.includes('401') &&
        !instructorsError.message.includes('403')
            ? instructorsError
            : null;

    const buildPreviewFromClasses = (
        classes: InstructorClassData[]
    ): BulkCancelSessionsPreview => {
        const filteredClasses = classes.filter(
            (cls) => cls.upcomingSessions > 0
        );
        const upcomingSessionCount = classes.reduce(
            (total, cls) => total + cls.upcomingSessions,
            0
        );
        return {
            sessionCount: classes.reduce(
                (total, cls) => total + cls.sessionCount,
                0
            ),
            upcomingSessionCount,
            classCount: filteredClasses.length,
            studentCount: classes.reduce(
                (total, cls) => total + cls.enrolledCount,
                0
            ),
            classes: classes.map((cls) => ({
                classId: cls.id,
                className: cls.name,
                upcomingSessions: cls.upcomingSessions,
                cancelledSessions: cls.cancelledSessions,
                studentCount: cls.enrolledCount
            }))
        };
    };

    const handleSubmit: SubmitHandler<FieldValues> = async (data) => {
        setIsLoading(true);
        setError(null);

        try {
            const request: BulkCancelSessionsRequest = {
                instructorId: parseInt(String(data.instructorId)),
                startDate: String(data.startDate),
                endDate: String(data.endDate),
                reason: String(data.reason)
            };

            const response = await API.get(
                `instructors/${request.instructorId}/classes?start_date=${request.startDate}&end_date=${request.endDate}`
            );

            const classes = response.data as InstructorClassData[];
            const preview = buildPreviewFromClasses(classes);

            if (preview.upcomingSessionCount === 0) {
                setError(
                    'No sessions found to cancel for the selected instructor and date range.'
                );
                setIsLoading(false);
                return;
            }

            onSubmit(request, preview);
            setIsLoading(false);
        } catch {
            setError('Failed to fetch session data. Please try again.');
            setIsLoading(false);
        }
    };

    const bulkCancelSessionsInputs: Input[] = [
        {
            type: FormInputTypes.Dropdown,
            label: 'Instructor',
            interfaceRef: 'instructorId',
            required: true,
            enumType: {
                'Select an instructor...': '',
                ...instructors
                    .filter((instructor) => instructor.id !== 0)
                    .reduce(
                        (acc, instructor) => {
                            acc[
                                `${instructor.name_first} ${instructor.name_last}`
                            ] = instructor.id.toString();
                            return acc;
                        },
                        {} as Record<string, string>
                    )
            }
        },
        {
            type: FormInputTypes.Date,
            label: 'Start Date',
            interfaceRef: 'startDate',
            required: true
        },
        {
            type: FormInputTypes.Date,
            label: 'End Date',
            interfaceRef: 'endDate',
            required: true
        },
        {
            type: FormInputTypes.Dropdown,
            label: 'Reason for cancelling',
            interfaceRef: 'reason',
            enumType: CancelEventReason,
            required: true
        },
        ...(error || instructorsErrorFiltered
            ? [
                  {
                      type: FormInputTypes.Unique,
                      label: '',
                      interfaceRef: '',
                      required: false,
                      uniqueComponent: (
                          <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-4">
                              <p className="text-sm text-red-600">
                                  {error ?? 'Failed to load instructors'}
                              </p>
                          </div>
                      ) as React.ReactElement
                  }
              ]
            : [])
    ];

    return (
        <FormModal
            submitText={isLoading ? 'Processing...' : 'Cancel Sessions'}
            ref={ref}
            title={'Cancel Classes by Instructor'}
            inputs={bulkCancelSessionsInputs}
            showCancel={true}
            onSubmit={handleSubmit}
        />
    );
});
