import { forwardRef } from 'react';
import { CloseX } from '../inputs';
import {
    CheckCircleIcon,
    ExclamationTriangleIcon
} from '@heroicons/react/24/outline';

interface BulkCreateResponse {
    created_count: number;
    failed_count: number;
    errors?: string[];
}

interface UploadCompleteModalProps {
    createResponse: BulkCreateResponse | null;
    onDownloadErrorReport: () => void;
    onClose: () => void;
}

export const UploadCompleteModal = forwardRef<
    HTMLDialogElement,
    UploadCompleteModalProps
>(function UploadCompleteModal(
    { createResponse, onDownloadErrorReport, onClose },
    ref
) {
    if (!createResponse) return null;

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
                                    {createResponse.created_count}
                                </span>{' '}
                                accounts successfully created
                            </p>

                            {createResponse.failed_count > 0 && (
                                <p className="body text-lg mt-2">
                                    <span className="font-bold text-warning">
                                        {createResponse.failed_count}
                                    </span>{' '}
                                    rows were not created due to errors
                                </p>
                            )}
                        </div>

                        {createResponse.failed_count > 0 && (
                            <div className="space-y-3 p-4 bg-warning/10 rounded-lg">
                                <div className="flex items-center gap-2">
                                    <ExclamationTriangleIcon className="w-5 h-5 text-warning" />
                                    <span className="body font-semibold">
                                        Some accounts could not be created
                                    </span>
                                </div>
                                <p className="body-small text-grey-4">
                                    Review and correct the errors in the
                                    downloaded file before re-uploading those
                                    rows.
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
