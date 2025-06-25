import { forwardRef, useState, useRef } from 'react';
import { CloseX, CancelButton } from '../inputs';
import { DragDropFileInput } from '../inputs/DragDropFileInput';
import { ValidationResultsModal } from './ValidationResultsModal';
import { UploadCompleteModal } from './UploadCompleteModal';
import { showModal, closeModal } from '.';
import API from '@/api/api';
import { useToast } from '@/Context/ToastCtx';
import { ToastState, ServerResponseOne } from '@/common';

interface BulkUploadResponse {
    upload_id: string;
    valid_count: number;
    error_count: number;
    errors?: string[];
}

interface BulkCreateResponse {
    created_count: number;
    failed_count: number;
    errors?: string[];
}

export const BulkUploadModal = forwardRef<
    HTMLDialogElement,
    {
        onSuccess?: () => void;
    }
>(function BulkUploadModal({ onSuccess }, ref) {
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadResponse, setUploadResponse] =
        useState<BulkUploadResponse | null>(null);
    const [createResponse, setCreateResponse] =
        useState<BulkCreateResponse | null>(null);

    const validationResultsModal = useRef<HTMLDialogElement>(null);
    const uploadCompleteModal = useRef<HTMLDialogElement>(null);
    const { toaster } = useToast();

    const handleFileSelect = (file: File | null) => {
        setSelectedFile(file);
    };

    const handleClose = () => {
        setSelectedFile(null);
        setIsUploading(false);
        setUploadResponse(null);
        setCreateResponse(null);
        closeModal(ref);
    };

    const handleUpload = async () => {
        if (!selectedFile) return;

        setIsUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', selectedFile);
            const response = (await API.post(
                'users/bulk-upload',
                formData
            )) as ServerResponseOne<BulkUploadResponse>;

            if (response.success) {
                setUploadResponse(response.data);
                closeModal(ref);
                showModal(validationResultsModal);
            } else {
                toaster(
                    'Failed to upload file. Please try again.',
                    ToastState.error
                );
            }
        } catch (error) {
            console.error('Upload error:', error);
            toaster(
                'Failed to upload file. Please try again.',
                ToastState.error
            );
        } finally {
            setIsUploading(false);
        }
    };

    const handleCreateAccounts = async () => {
        if (!uploadResponse) return;

        try {
            const response = (await API.post(
                `users/bulk-create/${uploadResponse.upload_id}`,
                {}
            )) as ServerResponseOne<BulkCreateResponse>;

            if (response.success) {
                setCreateResponse(response.data);
                closeModal(validationResultsModal);
                showModal(uploadCompleteModal);
                onSuccess?.();
            } else {
                toaster(
                    'Failed to create accounts. Please try again.',
                    ToastState.error
                );
            }
        } catch (error) {
            console.error('Create accounts error:', error);
            toaster(
                'Failed to create accounts. Please try again.',
                ToastState.error
            );
        }
    };

    const handleDownloadTemplate = () => {
        const headers = ['Last Name', 'First Name', 'Resident ID', 'Username'];
        const csvContent = headers.join(',') + '\n';

        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'bulk_upload_template.csv';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
    };

    const handleDownloadErrorReport = async () => {
        if (!uploadResponse) return;

        try {
            const response = await fetch(
                `/api/users/bulk-upload/errors/${uploadResponse.upload_id}`
            );
            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = 'error_report.csv';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                window.URL.revokeObjectURL(url);
            } else {
                toaster('Failed to download error report.', ToastState.error);
            }
        } catch (error) {
            console.error('Download error report error:', error);
            toaster('Failed to download error report.', ToastState.error);
        }
    };

    return (
        <>
            <dialog ref={ref} className="modal" onClose={handleClose}>
                <div className="modal-box max-w-2xl">
                    <CloseX close={handleClose} />
                    <div className="flex flex-col gap-6">
                        <h2 className="text-3xl font-semibold text-neutral">
                            Bulk Create Accounts
                        </h2>

                        <div className="space-y-4">
                            <p className="body">
                                Upload a CSV to create multiple resident
                                accounts.
                            </p>
                            <p className="body">
                                Use the template below to make sure your file is
                                formatted correctly.
                            </p>

                            <button
                                type="button"
                                onClick={handleDownloadTemplate}
                                className="button-outline inline-flex items-center gap-2"
                            >
                                <svg
                                    className="w-4 h-4"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                                    />
                                </svg>
                                Download CSV Template
                            </button>
                        </div>

                        <DragDropFileInput
                            onFileSelect={handleFileSelect}
                            acceptedFileTypes=".csv"
                            maxSizeInMB={5}
                            currentFile={selectedFile}
                            disabled={isUploading}
                        />

                        <div className="flex justify-end gap-4 mt-6">
                            <CancelButton onClick={handleClose} />
                            <button
                                type="button"
                                onClick={() => void handleUpload()}
                                disabled={!selectedFile || isUploading}
                                className="button"
                            >
                                {isUploading ? 'Uploading...' : 'Upload'}
                            </button>
                        </div>
                    </div>
                </div>
            </dialog>

            <ValidationResultsModal
                ref={validationResultsModal}
                uploadResponse={uploadResponse}
                onCreateAccounts={() => void handleCreateAccounts()}
                onDownloadErrorReport={() => void handleDownloadErrorReport()}
                onClose={() => {
                    closeModal(validationResultsModal);
                    setUploadResponse(null);
                }}
            />

            <UploadCompleteModal
                ref={uploadCompleteModal}
                createResponse={createResponse}
                onDownloadErrorReport={() => void handleDownloadErrorReport()}
                onClose={() => {
                    closeModal(uploadCompleteModal);
                    setCreateResponse(null);
                    handleClose();
                }}
            />
        </>
    );
});
