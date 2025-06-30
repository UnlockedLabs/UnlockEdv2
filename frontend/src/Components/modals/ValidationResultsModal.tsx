import { forwardRef } from 'react';
import { CloseX, CancelButton } from '../inputs';
import {
    CheckCircleIcon,
    ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import { BulkUploadResponse } from '@/common';

interface ValidationResultsModalProps {
    uploadResponse: BulkUploadResponse | null;
    onCreateAccounts: () => void;
    onDownloadErrorReport: () => void;
    onClose: () => void;
}

export const ValidationResultsModal = forwardRef<
    HTMLDialogElement,
    ValidationResultsModalProps
>(function ValidationResultsModal(
    { uploadResponse, onCreateAccounts, onDownloadErrorReport, onClose },
    ref
) {
    if (!uploadResponse) {
        return null;
    }

    return (
        <dialog ref={ref} className="modal" onClose={onClose}>
            <div className="modal-box max-w-2xl">
                <CloseX close={onClose} />
                <div className="flex flex-col gap-6">
                    <h2 className="text-3xl font-semibold text-neutral">
                        Check Your File
                    </h2>

                    <div className="space-y-4">
                        <div className="flex items-center gap-3 p-4 bg-teal-1 rounded-lg">
                            <CheckCircleIcon className="w-6 h-6 text-teal-4" />
                            <span className="body font-semibold">
                                File validation complete
                            </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="card p-4">
                                <div className="flex items-center gap-3">
                                    <CheckCircleIcon className="w-8 h-8 text-success" />
                                    <div>
                                        <p className="text-2xl font-bold text-success">
                                            {uploadResponse.valid_count}
                                        </p>
                                        <p className="body-small text-grey-4">
                                            valid rows ready for account
                                            creation
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {uploadResponse.error_count > 0 && (
                                <div className="card p-4">
                                    <div className="flex items-center gap-3">
                                        <ExclamationTriangleIcon className="w-8 h-8 text-warning" />
                                        <div>
                                            <p className="text-2xl font-bold text-error">
                                                {uploadResponse.error_count}
                                            </p>
                                            <p className="body-small text-grey-4">
                                                rows with errors need attention
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {uploadResponse.error_count > 0 && (
                            <div className="space-y-3">
                                <div className="flex items-center gap-2">
                                    <ExclamationTriangleIcon className="w-5 h-5 text-warning" />
                                    <span className="body font-semibold">
                                        Error Report Available
                                    </span>
                                </div>
                                <p className="body text-grey-4">
                                    Download CSV file with error details to fix
                                    now
                                </p>
                                <button
                                    type="button"
                                    onClick={() => void onDownloadErrorReport()}
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
                                    Download Error File
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="flex justify-end gap-4 mt-6">
                        <CancelButton onClick={onClose} />
                        {uploadResponse.valid_count > 0 && (
                            <button
                                type="button"
                                onClick={() => void onCreateAccounts()}
                                className="button"
                            >
                                Create Accounts
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </dialog>
    );
});
