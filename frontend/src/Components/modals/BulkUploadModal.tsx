import { forwardRef, useState, useRef, useEffect } from 'react';
import { CloseX, CancelButton } from '../inputs';
import { DragDropFileInput } from '../inputs/DragDropFileInput';
import { ValidationResultsModal } from './ValidationResultsModal';
import { UploadCompleteModal } from './UploadCompleteModal';
import { showModal, closeModal } from '.';
import API from '@/api/api';
import { useToast } from '@/Context/ToastCtx';
import { ToastState, ServerResponseOne, BulkUploadResponse } from '@/common';
import { ArrowDownTrayIcon } from '@heroicons/react/24/outline';

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
    const [createdCount, setCreatedCount] = useState<number | null>(null);
    const [errorData, setErrorData] = useState<{
        errorCount: number;
        errorCsvData: string | undefined;
    }>({ errorCount: 0, errorCsvData: undefined });
    const [modalStep, setModalStep] = useState<
        'upload' | 'validation' | 'complete'
    >('upload');

    const validationResultsModal = useRef<HTMLDialogElement>(null);
    const uploadCompleteModal = useRef<HTMLDialogElement>(null);
    const { toaster } = useToast();

    const dragDropInputRef = useRef<{ clear: () => void }>(null);

    useEffect(() => {
        if (modalStep === 'validation' && uploadResponse) {
            closeModal(ref); // close upload modal first
            showModal(validationResultsModal); // open  validation modal
        } else if (modalStep === 'complete' && createdCount !== null) {
            closeModal(validationResultsModal);
            showModal(uploadCompleteModal);
        }
    }, [modalStep, uploadResponse, createdCount]);

    const handleFileSelect = (file: File | null) => {
        setSelectedFile(file);
    };

    const handleClose = () => {
        setSelectedFile(null);
        setIsUploading(false);
        setUploadResponse(null);
        setCreatedCount(null);
        setErrorData({ errorCount: 0, errorCsvData: undefined });
        setModalStep('upload');
        dragDropInputRef.current?.clear?.();
        closeModal(ref);
    };

    const handleUpload = async () => {
        if (!selectedFile) return;

        setIsUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', selectedFile);

            const response = (await API.post(
                'users/bulk/upload',
                formData
            )) as ServerResponseOne<BulkUploadResponse>;

            if (response.success && response.data) {
                setUploadResponse(response.data);
                setErrorData({
                    errorCount: response.data.error_count,
                    errorCsvData: response.data.error_csv_data
                });
                setModalStep('validation');
            } else {
                toaster(
                    `${response.message || 'Failed to upload file.'}`,
                    ToastState.error
                );
            }
        } catch (error) {
            toaster(
                `${error instanceof Error ? error.message : 'An error occurred while uploading the file.'}`,
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
                'users/bulk/create',
                uploadResponse.valid_rows
            )) as ServerResponseOne<number>;

            if (response.success) {
                setCreatedCount(response.data);
                setModalStep('complete');
                onSuccess?.();
            } else {
                toaster(
                    'Failed to create accounts. Please try again.',
                    ToastState.error
                );
            }
        } catch {
            toaster(
                'Failed to create accounts. Please try again.',
                ToastState.error
            );
        }
    };

    const handleDownloadTemplate = () => {
        const headers = ['LastName', 'FirstName', 'ResidentID', 'Username'];
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
        if (!errorData.errorCsvData) {
            toaster('No error report available.', ToastState.error);
            return;
        }

        try {
            const binaryString = atob(errorData.errorCsvData);

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
        } catch {
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
                                    <ArrowDownTrayIcon className="w-4 h-4" />
                                    Download Template
                                </button>
                            </div>
                        </div>

                        <DragDropFileInput
                            ref={dragDropInputRef}
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
                uploadResponse={uploadResponse}
                createdCount={createdCount}
                errorCount={errorData.errorCount}
                errorCsvData={errorData.errorCsvData}
                onDownloadErrorReport={() => void handleDownloadErrorReport()}
                onClose={() => {
                    closeModal(uploadCompleteModal);
                    setCreatedCount(null);
                    setModalStep('upload');
                    handleClose();
                }}
            />
        </>
    );
});
