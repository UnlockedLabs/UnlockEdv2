import React, { forwardRef, useState, useEffect } from 'react';
import { TextOnlyModal, TextModalType, closeModal } from '.';
import { Class, ServerResponseMany } from '@/common';
import API from '@/api/api';
import { useCheckResponse } from '@/Hooks/useCheckResponse';
import { KeyedMutator } from 'swr';
import {
    BulkCancelSessionsPreview,
    BulkCancelSessionsRequest,
    BulkCancelSessionsResponse
} from '@/types/events';

interface BulkCancelSessionsConfirmModalProps {
    ref: React.ForwardedRef<HTMLDialogElement>;
    request: BulkCancelSessionsRequest | null;
    preview: BulkCancelSessionsPreview | null;
    onSuccess?: () => void;
    onClose?: () => void;
    mutate: KeyedMutator<ServerResponseMany<Class>>;
}

export const BulkCancelSessionsConfirmModal = forwardRef(function (
    {
        request,
        preview,
        onSuccess,
        onClose,
        mutate
    }: BulkCancelSessionsConfirmModalProps,
    ref: React.ForwardedRef<HTMLDialogElement>
) {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setError(null);
    }, [request, preview]);

    const checkResponse = useCheckResponse({
        refModal: ref,
        mutate: mutate
    });

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

    const handleConfirm = () => {
        if (request) {
            void executeBulkCancel(request);
        }
        closeModal(ref);
    };

    const handleClose = () => {
        setError(null);
        closeModal(ref);
        if (onClose) {
            onClose();
        }
    };

    const getConfirmationText = (): string => {
        if (!request || !preview) {
            return '';
        }

        const endDate = new Date(request.endDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const isPastDate = endDate < today;

        return isPastDate
            ? 'You are cancelling sessions in the past. This action cannot be undone. Are you sure you want to continue?'
            : `Are you sure you want to cancel ${preview.upcomingSessionCount ?? 0} sessions across ${preview.classCount ?? 0} classes? This action cannot be undone.`;
    };

    return (
        <TextOnlyModal
            ref={ref}
            type={TextModalType.Confirm}
            title="Confirm Cancellation"
            text={
                <p>
                    {getConfirmationText()}
                    {error && (
                        <div className="mt-3 text-sm text-red-600">{error}</div>
                    )}
                </p>
            }
            onSubmit={handleConfirm}
            onClose={handleClose}
            action={isLoading ? 'Processing...' : undefined}
        />
    );
});
