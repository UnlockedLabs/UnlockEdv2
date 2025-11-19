import { forwardRef } from 'react';
import { CloseX, CancelButton } from '../inputs';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { ConflictDetail } from '@/common';

interface SchedulingConflictModalProps {
    conflicts: ConflictDetail[];
    onConfirm: () => void;
    onClose: () => void;
}

export const SchedulingConflictModal = forwardRef<
    HTMLDialogElement,
    SchedulingConflictModalProps
>(function SchedulingConflictModal({ conflicts, onConfirm, onClose }, ref) {
    if (!conflicts || conflicts.length === 0) {
        return null;
    }

    return (
        <dialog ref={ref} className="modal" onClose={onClose}>
            <div className="modal-box max-w-3xl">
                <CloseX close={onClose} />
                <div className="flex flex-col gap-6">
                    <div className="flex items-center gap-3">
                        <ExclamationTriangleIcon className="w-8 h-8 text-warning" />
                        <h2 className="text-2xl font-semibold text-neutral">
                            Scheduling Conflicts Detected
                        </h2>
                    </div>

                    <p className="body text-grey-4">
                        The following users have scheduling conflicts with
                        existing classes. Do you want to proceed with enrollment
                        anyway? If not, click 'Cancel' and de-select conflicted
                        residents.
                    </p>

                    <div className="max-h-60 overflow-y-auto space-y-3 px-4">
                        {conflicts.map((conflict, index) => {
                            const start = new Date(conflict.conflict_start);
                            const end = new Date(conflict.conflict_end);
                            const day = start.toLocaleDateString('en-US', {
                                weekday: 'short'
                            });
                            const startTime = start.toLocaleTimeString(
                                'en-US',
                                {
                                    hour: 'numeric',
                                    minute: '2-digit'
                                }
                            );
                            const endTime = end.toLocaleTimeString('en-US', {
                                hour: 'numeric',
                                minute: '2-digit'
                            });

                            return (
                                <div
                                    key={index}
                                    className="card p-3 bg-warning-light border-warning"
                                >
                                    <div className="flex flex-col">
                                        <p className="font-bold">
                                            {conflict.user_name}
                                        </p>
                                        <p className="text-sm text-grey-5">
                                            Conflicts with{' '}
                                            {conflict.conflicting_class} · {day}{' '}
                                            {startTime} – {endTime}
                                        </p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div className="flex justify-end gap-4 mt-4">
                        <CancelButton onClick={onClose} label="Cancel" />
                        <button
                            type="button"
                            onClick={onConfirm}
                            className="button bg-warning text-white hover:bg-warning-dark"
                        >
                            Enroll Anyway
                        </button>
                    </div>
                </div>
            </div>
        </dialog>
    );
});
