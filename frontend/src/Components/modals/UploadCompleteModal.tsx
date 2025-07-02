import { forwardRef } from 'react';
import { CloseX } from '../inputs';
import {
    CheckCircleIcon,
    ExclamationTriangleIcon,
    ArrowDownTrayIcon
} from '@heroicons/react/24/outline';
import type { BulkUploadResponse } from '@/common';

interface UploadCompleteModalProps {
    uploadResponse: BulkUploadResponse | null;
    createdCount: number | null;
    errorCount: number;
    errorCsvData: string | undefined;
    onDownloadErrorReport: () => void;
    onClose: () => void;
}

export const UploadCompleteModal = forwardRef<
    HTMLDialogElement,
    UploadCompleteModalProps
>(function UploadCompleteModal(
    { createdCount, errorCount, errorCsvData, onDownloadErrorReport, onClose },
    ref
) {
    if (!createdCount) return null;

    const hasErrors = errorCount > 0 && errorCsvData;

    return (
        <dialog ref={ref} className="modal" onClose={onClose}>
            <div className="modal-box max-w-2xl">
                <CloseX close={onClose} />
                <div className="flex flex-col gap-6">
                    <div className="text-center">
                        <CheckCircleIcon className="w-16 h-16 text-success mx-auto mb-4" />
                        <h2 className="text-3xl font-semibold text-neutral">
                            Bulk Upload Complete
                        </h2>
                    </div>

                    <div className="space-y-4">
                        <div className="text-center">
                            <p className="body text-lg">
                                <span className="font-bold text-success">
                                    {createdCount}
                                </span>{' '}
                                accounts successfully created
                            </p>
                        </div>

                        {hasErrors && (
                            <div className="space-y-3 p-4 bg-warning/10 rounded-lg">
                                <div className="flex items-center gap-2">
                                    <ExclamationTriangleIcon className="w-5 h-5 text-warning" />
                                    <span className="body font-semibold">
                                        Error Report Available
                                    </span>
                                </div>
                                <p className="body-small text-grey-4">
                                    Download the error report to see which rows
                                    had validation errors. Fix the errors and
                                    upload those rows again.
                                </p>
                                <button
                                    type="button"
                                    onClick={() => void onDownloadErrorReport()}
                                    className="button-outline inline-flex items-center gap-2"
                                >
                                    <ArrowDownTrayIcon className="w-4 h-4" />
                                    Download Error File
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="flex justify-center mt-6">
                        <button
                            type="button"
                            onClick={onClose}
                            className="button"
                        >
                            Return to Residents
                        </button>
                    </div>
                </div>
            </div>
        </dialog>
    );
});
