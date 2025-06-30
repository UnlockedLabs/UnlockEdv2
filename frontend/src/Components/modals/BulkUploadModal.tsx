import { forwardRef, useState, useRef, useEffect } from 'react';
import { CloseX, CancelButton } from '../inputs';
import { DragDropFileInput } from '../inputs/DragDropFileInput';
import { ValidationResultsModal } from './ValidationResultsModal';
import { UploadCompleteModal } from './UploadCompleteModal';
import { showModal, closeModal } from '.';
import API from '@/api/api';
import { useToast } from '@/Context/ToastCtx';
import {
    ToastState,
    ServerResponseOne,
    BulkUploadResponse,
    BulkCreateResponse
} from '@/common';

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
    const [modalStep, setModalStep] = useState<
        'upload' | 'validation' | 'complete'
    >('upload');

    const validationResultsModal = useRef<HTMLDialogElement>(null);
    const uploadCompleteModal = useRef<HTMLDialogElement>(null);
    const { toaster } = useToast();

    // when modalStep changes to validation, show validation modal
    useEffect(() => {
        if (modalStep === 'validation' && uploadResponse) {
            closeModal(ref); // close upload modal first
            setTimeout(() => {
                showModal(validationResultsModal); // open  validation modal
            }, 100);
        } else if (modalStep === 'complete' && createResponse) {
            closeModal(validationResultsModal);
            setTimeout(() => {
                showModal(uploadCompleteModal);
            }, 100);
        }
    }, [modalStep, uploadResponse, createResponse]);

    const handleFileSelect = (file: File | null) => {
        setSelectedFile(file);
    };

    const handleClose = () => {
        setSelectedFile(null);
        setIsUploading(false);
        setUploadResponse(null);
        setCreateResponse(null);
        setModalStep('upload');
        closeModal(ref);
    };

    const handleUpload = async () => {
        if (!selectedFile) return;

        setIsUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', selectedFile);

            const response = await fetch('/api/users/bulk/upload', {
                method: 'POST',
                credentials: 'include',
                body: formData
            });

            const data = (await response.json()) as {
                message: string;
                data: BulkUploadResponse;
            };

            if (response.ok && data.data) {
                setUploadResponse(data.data);
                setModalStep('validation');
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
            const response = (await API.post('users/bulk/create', {
                valid_rows: uploadResponse.valid_rows
            })) as ServerResponseOne<BulkCreateResponse>;

            if (response.success) {
                setCreateResponse(response.data);
                setModalStep('complete');
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

    const handleDownloadErrorReport = () => {
        if (!uploadResponse?.error_csv_data) {
            return;
        }

        try {
            const binaryString = atob(uploadResponse.error_csv_data);

            const uint8Array = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                uint8Array[i] = binaryString.charCodeAt(i);
            }

            const blob = new Blob([uint8Array], { type: 'text/csv' });

            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;

            const originalName =
                selectedFile?.name?.replace('.csv', '') ?? 'upload';
            link.download = `${originalName}-error_report.csv`;

            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Download error report error:', error);
            toaster('Failed to download error report.', ToastState.error);
        }
    };

    return (
        <>
            <dialog ref={ref} className="modal">
                <div className="modal-box max-w-2xl">
                    <CloseX close={handleClose} />
                    <div className="flex flex-col gap-6">
                        <h2 className="text-3xl font-semibold text-neutral">
                            Bulk Create Accounts
                        </h2>

                        <div className="space-y-4">
                            <div className="flex flex-col gap-2">
                                <p className="body">
                                    Upload a CSV file with user information to
                                    create multiple accounts at once.
                                </p>
                                <button
                                    type="button"
                                    onClick={() =>
                                        void handleDownloadTemplate()
                                    }
                                    className="button-outline self-start inline-flex items-center gap-2"
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
                                    Download Template
                                </button>
                            </div>
                        </div>

                        <DragDropFileInput
                            onFileSelect={handleFileSelect}
                            acceptedFileTypes=".csv"
                            maxSizeInMB={5}
                            currentFile={selectedFile}
                            disabled={isUploading}
                        />

                        {selectedFile && (
                            <p className="text-sm text-base-content/70">
                                Click Continue to check the file for errors
                                before creating resident accounts.
                            </p>
                        )}

                        <div className="flex justify-end gap-4 mt-6">
                            <CancelButton onClick={handleClose} />
                            <button
                                type="button"
                                onClick={() => void handleUpload()}
                                disabled={!selectedFile || isUploading}
                                className="button"
                            >
                                {isUploading ? 'Uploading...' : 'Continue'}
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
                    setModalStep('upload');
                }}
            />

            <UploadCompleteModal
                ref={uploadCompleteModal}
                createResponse={createResponse}
                onDownloadErrorReport={() => void handleDownloadErrorReport()}
                onClose={() => {
                    closeModal(uploadCompleteModal);
                    setCreateResponse(null);
                    setModalStep('upload');
                    handleClose();
                }}
            />
        </>
    );
});
