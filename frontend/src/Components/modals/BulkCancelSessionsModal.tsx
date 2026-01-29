import React, { forwardRef, useRef, useState } from 'react';
import { Class, ServerResponseMany } from '@/common';
import { showModal, closeModal } from '.';
import { BulkCancelSessionsFormModal } from './BulkCancelSessionsFormModal';
import { BulkCancelSessionsConfirmModal } from './BulkCancelSessionsConfirmModal';
import {
    BulkCancelSessionsPreview,
    BulkCancelSessionsRequest
} from '@/types/events';
import { KeyedMutator } from 'swr';

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
    const [pendingRequest, setPendingRequest] =
        useState<BulkCancelSessionsRequest | null>(null);
    const [pendingPreview, setPendingPreview] =
        useState<BulkCancelSessionsPreview | null>(null);
    const confirmModalRef = useRef<HTMLDialogElement>(null);

    const handleFormSubmit = (
        request: BulkCancelSessionsRequest,
        preview: BulkCancelSessionsPreview
    ) => {
        setPendingRequest(request);
        setPendingPreview(preview);
        closeModal(ref);
        showModal(confirmModalRef);
    };

    const handleConfirmClose = () => {
        setPendingRequest(null);
        setPendingPreview(null);
        closeModal(confirmModalRef);
        // Return to form modal if the main modal is still supposed to be open
        // Note: The form modal will be reopened by the parent component typically
    };

    const handleConfirmSuccess = () => {
        setPendingRequest(null);
        setPendingPreview(null);
        if (onSuccess) {
            onSuccess();
        }
    };

    return (
        <>
            <BulkCancelSessionsFormModal
                ref={ref}
                facilityId={facilityId}
                onSubmit={handleFormSubmit}
            />
            <BulkCancelSessionsConfirmModal
                ref={confirmModalRef}
                request={pendingRequest}
                preview={pendingPreview}
                onSuccess={handleConfirmSuccess}
                onClose={handleConfirmClose}
                mutate={mutate}
            />
        </>
    );
});
