import React, { forwardRef, useRef, useState } from 'react';
import {
    FormInputTypes,
    FormModal,
    Input,
    TextOnlyModal,
    TextModalType,
    showModal,
    closeModal
} from '.';
import { CancelEventReason, Class, ServerResponseMany } from '@/common';
import API from '@/api/api';
import { FieldValues, SubmitHandler } from 'react-hook-form';
import { useCheckResponse } from '@/Hooks/useCheckResponse';
import { useAuth } from '@/useAuth';
import { KeyedMutator } from 'swr';
import useSWR from 'swr';
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
    mutate: KeyedMutator<ServerResponseMany<Class>>;
}

export const BulkCancelSessionsModal = forwardRef(function (
    { facilityId, onSuccess, mutate }: BulkCancelSessionsModalProps,
    ref: React.ForwardedRef<HTMLDialogElement>
) {
    const { user } = useAuth();
    if (!user) {
        return null;
    }

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
    >(user && facilityId ? `/api/facilities/${facilityId}/instructors` : null);

    const instructors = instructorsResponse?.data ?? [];
    const instructorsErrorFiltered =
        instructorsError &&
        !instructorsError.message.includes('401') &&
        !instructorsError.message.includes('403')
            ? instructorsError
            : null;
    const confirmModalRef = useRef<HTMLDialogElement>(null);
    const [pendingRequest, setPendingRequest] =
        useState<BulkCancelSessionsRequest | null>(null);

    const checkResponse = useCheckResponse({
        refModal: ref,
        mutate: mutate
    });

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

    const executeBulkCancel = async (request: BulkCancelSessionsRequest) => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await API.post(
                'program-classes/bulk-cancel',
                request
            );

            const responseData = response.data as BulkCancelSessionsResponse;

            if (
                responseData &&
                'success' in responseData &&
                responseData.success
            ) {
                const successMessage =
                    responseData.message ??
                    `Successfully cancelled ${responseData.sessionCount ?? 0} sessions across ${responseData.classCount ?? 0} classes. ${responseData.studentCount ?? 0} students were affected.`;

                checkResponse(
                    Boolean(responseData.success),
                    'Failed to cancel sessions',
                    successMessage
                );

                if (onSuccess) {
                    onSuccess();
                }
            } else if (
                responseData &&
                'success' in responseData &&
                !responseData.success
            ) {
                setError(
                    'No sessions found to cancel for the selected instructor and date range.'
                );
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

            setPendingRequest(request);
            showModal(confirmModalRef);
            closeModal(ref);
            setIsLoading(false);
            return;
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
                    .filter((instructor) => instructor.id !== 0) // Filter out "Unassigned" instructor
                    .reduce(
                        (acc, instructor) => {
                            // For DropdownInput: key = display text, value = form value
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
        <>
            <FormModal
                submitText={isLoading ? 'Processing...' : 'Cancel Sessions'}
                ref={ref}
                title={'Cancel Classes by Instructor'}
                inputs={bulkCancelSessionsInputs}
                showCancel={true}
                onSubmit={handleBulkCancelSessions}
            />
            <TextOnlyModal
                ref={confirmModalRef}
                type={TextModalType.Confirm}
                title="Confirm Cancellation"
                text={
                    <p>
                        {pendingRequest
                            ? (() => {
                                  const endDate = new Date(
                                      pendingRequest.endDate
                                  );
                                  const today = new Date();
                                  today.setHours(0, 0, 0, 0);
                                  const isPastDate = endDate < today;
                                  return isPastDate
                                      ? `You are cancelling sessions in the past. This action cannot be undone. Are you sure you want to continue?`
                                      : `Are you sure you want to cancel ${preview?.upcomingSessionCount ?? 0} sessions across ${preview?.classCount ?? 0} classes? This action cannot be undone.`;
                              })()
                            : ''}
                    </p>
                }
                onSubmit={() => {
                    if (pendingRequest) {
                        void executeBulkCancel(pendingRequest);
                    }
                    closeModal(confirmModalRef);
                }}
                onClose={() => {
                    setPendingRequest(null);
                    closeModal(confirmModalRef);
                }}
            />
        </>
    );
});
