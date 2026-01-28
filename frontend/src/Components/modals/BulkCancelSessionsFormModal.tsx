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
import { BulkCancelSessionsPreview as BulkCancelSessionsPreviewComponent } from './BulkCancelSessionsPreview';

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
    const [preview, setPreview] = useState<BulkCancelSessionsPreview | null>(
        null
    );
    const [showPreview, setShowPreview] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [currentFormValues, setCurrentFormValues] = useState({
        instructorId: null as number | null,
        startDate: '',
        endDate: ''
    });

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

    const generatePreview = async (
        instructorId: number,
        startDate: string,
        endDate: string
    ) => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await API.get(
                `instructors/${instructorId}/classes?start_date=${startDate}&end_date=${endDate}`
            );

            const classes = response.data as InstructorClassData[];
            const previewData = buildPreviewFromClasses(classes);
            setPreview(previewData);
            setShowPreview(true);
        } catch {
            setError(
                'Failed to generate preview. Please check your date range and try again.'
            );
        } finally {
            setIsLoading(false);
        }
    };

    const handleInstructorChange = (instructorId: number | null) => {
        setCurrentFormValues((prev) => ({ ...prev, instructorId }));
        setPreview(null);
        setShowPreview(false);

        if (
            instructorId &&
            currentFormValues.startDate &&
            currentFormValues.endDate
        ) {
            generatePreview(
                instructorId,
                currentFormValues.startDate,
                currentFormValues.endDate
            ).catch(() => {
                // Handle preview generation errors silently
            });
        }
    };

    const handleDateChange = (
        field: 'startDate' | 'endDate',
        value: string
    ) => {
        const newValues = { ...currentFormValues, [field]: value };
        setCurrentFormValues(newValues);
        setPreview(null);
        setShowPreview(false);

        if (
            currentFormValues.instructorId &&
            newValues.startDate &&
            newValues.endDate
        ) {
            generatePreview(
                currentFormValues.instructorId,
                newValues.startDate,
                newValues.endDate
            ).catch(() => {
                // Handle preview generation errors silently
            });
        }
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

            let currentPreview: BulkCancelSessionsPreview | null = preview;
            if (
                currentPreview?.sessionCount === undefined ||
                currentFormValues.instructorId !== request.instructorId ||
                currentFormValues.startDate !== request.startDate ||
                currentFormValues.endDate !== request.endDate
            ) {
                try {
                    const response = await API.get(
                        `instructors/${request.instructorId}/classes?start_date=${request.startDate}&end_date=${request.endDate}`
                    );

                    const classes = response.data as InstructorClassData[];
                    currentPreview = buildPreviewFromClasses(classes);
                    setPreview(currentPreview);
                } catch {
                    setError('Failed to fetch session data. Please try again.');
                    setIsLoading(false);
                    return;
                }
            }

            if (currentPreview && currentPreview.upcomingSessionCount === 0) {
                setError(
                    'No sessions found to cancel for the selected instructor and date range.'
                );
                setIsLoading(false);
                return;
            }

            onSubmit(request, currentPreview);
            setIsLoading(false);
        } catch {
            setError('Failed to cancel sessions. Please try again.');
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
            },
            onChange: (e) => {
                const value = e.target.value;
                handleInstructorChange(
                    value === '' ? null : parseInt(value, 10)
                );
            }
        },
        {
            type: FormInputTypes.Date,
            label: 'Start Date',
            interfaceRef: 'startDate',
            required: true,
            onChange: (e) => handleDateChange('startDate', e.target.value)
        },
        {
            type: FormInputTypes.Date,
            label: 'End Date',
            interfaceRef: 'endDate',
            required: true,
            onChange: (e) => handleDateChange('endDate', e.target.value)
        },
        {
            type: FormInputTypes.Dropdown,
            label: 'Reason for cancelling',
            interfaceRef: 'reason',
            enumType: CancelEventReason,
            required: true
        },
        ...(preview && showPreview
            ? [
                  {
                      type: FormInputTypes.Unique,
                      label: 'Preview',
                      interfaceRef: '',
                      required: false,
                      uniqueComponent: (
                          <BulkCancelSessionsPreviewComponent
                              preview={preview}
                              showPreview={showPreview}
                          />
                      )
                  }
              ]
            : []),
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
