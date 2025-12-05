import { forwardRef, useEffect, useState } from 'react';
import { FormInputTypes, FormModal, Input } from '.';
import { CancelEventReason } from '@/common';
import API from '@/api/api';
import { FieldValues, SubmitHandler } from 'react-hook-form';
import { useCheckResponse } from '@/Hooks/useCheckResponse';
import { useAuth } from '@/useAuth';
import {
    Instructor,
    BulkCancelSessionsPreview,
    BulkCancelSessionsRequest,
    BulkCancelSessionsResponse,
    InstructorClassData
} from '@/types/events';

interface BulkCancelSessionsModalProps {
    ref: React.ForwardedRef<HTMLDialogElement>;
    onSuccess?: () => void;
    facilityId: number;
}

export const BulkCancelSessionsModal = forwardRef(function (
    { facilityId, onSuccess }: BulkCancelSessionsModalProps,
    ref: React.ForwardedRef<HTMLDialogElement>
) {
    const { user } = useAuth();
    if (!user) {
        return null;
    }

    const [instructors, setInstructors] = useState<Instructor[]>([]);
    const [preview, setPreview] = useState<BulkCancelSessionsPreview | null>(
        null
    );
    const [showPreview, setShowPreview] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [hasTriedFetch, setHasTriedFetch] = useState(false);
    const [currentFormValues, setCurrentFormValues] = useState({
        instructorId: null as number | null,
        startDate: '',
        endDate: ''
    });

    const checkResponse = useCheckResponse({
        refModal: ref,
        mutate: null as never // This modal doesn't need mutate functionality
    });

    const generatePreview = async (
        instructorId: number,
        startDate: string,
        endDate: string
    ) => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await API.get(
                `/instructors/${instructorId}/classes?start_date=${startDate}&end_date=${endDate}&facility_id=${facilityId}`
            );

            const classes = response.data as InstructorClassData[];
            const sessionCount = classes.reduce(
                (total: number, cls: InstructorClassData) =>
                    total + cls.sessionCount,
                0
            );
            const studentCount = classes.reduce(
                (total: number, cls: InstructorClassData) =>
                    total + cls.enrolledCount,
                0
            );

            setPreview({
                sessionCount,
                classCount: classes.length,
                studentCount,
                classes: classes.map((cls: InstructorClassData) => ({
                    classId: cls.id,
                    className: cls.name,
                    upcomingSessions: cls.upcomingSessions,
                    cancelledSessions: cls.cancelledSessions,
                    studentCount: cls.enrolledCount
                }))
            });
            setShowPreview(true);
        } catch {
            setError(
                'Failed to generate preview. Please check your date range and try again.'
            );
        } finally {
            setIsLoading(false);
        }
    };

    const handleInstructorChange = (instructorId: number) => {
        setCurrentFormValues((prev) => ({ ...prev, instructorId }));
        setPreview(null);
        setShowPreview(false);

        // Generate preview if all values exist
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

        // Generate preview if all values exist
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

    const handleBulkCancelSessions: SubmitHandler<FieldValues> = async (
        data
    ) => {
        setIsLoading(true);
        setError(null);

        try {
            const request: BulkCancelSessionsRequest = {
                instructorId: parseInt(String(data.instructorId)),
                startDate: String(data.startDate),
                endDate: String(data.endDate),
                reason: String(data.reason)
            };

            // Check if dates are in the past
            const endDate = new Date(String(data.endDate));
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const isPastDate = endDate < today;
            const confirmMessage = isPastDate
                ? `You are cancelling sessions in the past. This action cannot be undone. Are you sure you want to continue?`
                : `Are you sure you want to cancel ${preview?.sessionCount ?? 0} sessions across ${preview?.classCount ?? 0} classes? This action cannot be undone.`;

            if (!confirm(confirmMessage)) {
                return;
            }

            const response = await API.post(
                '/program-classes/bulk-cancel',
                request
            );

            const responseData = response.data as BulkCancelSessionsResponse;

            if (
                responseData &&
                'success' in responseData &&
                responseData.success
            ) {
                checkResponse(
                    Boolean(responseData.success),
                    'Failed to cancel sessions',
                    `Successfully cancelled ${responseData.sessionCount ?? 0} sessions across ${responseData.classCount ?? 0} classes. ${responseData.studentCount ?? 0} students were affected.`
                );

                if (onSuccess) {
                    onSuccess();
                }
            } else {
                const errorData = response.data as { error?: string };
                setError(errorData?.error ?? 'Failed to cancel sessions');
            }
        } catch {
            setError('Failed to cancel sessions. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    // Only fetch instructors when the modal is actually opened, not on mount
    useEffect(() => {
        // Only fetch if we have a user (authenticated) and haven't tried yet
        if (user && facilityId && !hasTriedFetch) {
            setHasTriedFetch(true);
            const fetchInstructors = async () => {
                try {
                    const response = await API.get(
                        `/facilities/${facilityId}/instructors`
                    );
                    setInstructors(response.data as Instructor[]);
                } catch (error: unknown) {
                    console.error('Error fetching instructors:', error);
                    // Don't set error for auth errors - this is expected when not logged in
                    const apiError = error as {
                        response?: { status?: number };
                    };
                    if (
                        apiError.response?.status !== 401 &&
                        apiError.response?.status !== 403
                    ) {
                        setError('Failed to load instructors');
                    }
                }
            };
            void fetchInstructors();
        }
    }, [user, facilityId, hasTriedFetch]);

    const bulkCancelSessionsInputs: Input[] = [
        {
            type: FormInputTypes.Dropdown,
            label: 'Instructor',
            interfaceRef: 'instructorId',
            required: true,
            enumType: instructors.reduce(
                (acc, instructor) => {
                    acc[instructor.id.toString()] =
                        `${instructor.name_first} ${instructor.name_last}`;
                    return acc;
                },
                {} as Record<string, string>
            ),
            onChange: (e) => handleInstructorChange(parseInt(e.target.value))
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
                          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 mb-4">
                              <h4 className="font-semibold text-yellow-800 mb-2">
                                  Cancellation Preview
                              </h4>
                              <div className="text-sm text-yellow-700 space-y-1">
                                  <p>
                                      <strong>Total Sessions:</strong>{' '}
                                      {preview.sessionCount}
                                  </p>
                                  <p>
                                      <strong>Classes Affected:</strong>{' '}
                                      {preview.classCount}
                                  </p>
                                  <p>
                                      <strong>Students Affected:</strong>{' '}
                                      {preview.studentCount}
                                  </p>
                                  {preview.classes.length > 0 && (
                                      <div className="mt-3">
                                          <strong>
                                              Classes to be affected:
                                          </strong>
                                          <ul className="list-disc list-inside mt-1">
                                              {preview.classes.map(
                                                  (cls, index) => (
                                                      <li key={index}>
                                                          {cls.className} (
                                                          {cls.upcomingSessions}{' '}
                                                          sessions,{' '}
                                                          {cls.studentCount}{' '}
                                                          students)
                                                      </li>
                                                  )
                                              )}
                                          </ul>
                                      </div>
                                  )}
                              </div>
                          </div>
                      )
                  }
              ]
            : []),
        ...(error
            ? [
                  {
                      type: FormInputTypes.Unique,
                      label: '',
                      interfaceRef: '',
                      required: false,
                      uniqueComponent: (
                          <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-4">
                              <p className="text-sm text-red-600">{error}</p>
                          </div>
                      ) as React.ReactElement
                  }
              ]
            : [])
    ];

    return (
        <FormModal
            submitText={isLoading ? 'Processing...' : 'Bulk Cancel Sessions'}
            ref={ref}
            title={'Bulk Cancel Sessions by Teacher'}
            inputs={bulkCancelSessionsInputs}
            showCancel={true}
            onSubmit={handleBulkCancelSessions}
        />
    );
});
