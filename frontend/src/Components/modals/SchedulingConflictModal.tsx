import { forwardRef } from 'react';
import { ConflictDetail } from '@/common';
import { TextModalType, TextOnlyModal } from '.';

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
        <TextOnlyModal
            ref={ref}
            type={TextModalType.Warning}
            title="Scheduling Conflicts Detected"
            action="Enroll Anyway"
            width="max-w-3xl"
            text={
                <div className="flex flex-col gap-4">
                    <p className="body text-grey-4">
                        The following users have scheduling conflicts with
                        existing classes. Do you want to proceed with enrollment
                        anyway? If not, click &apos;Cancel&apos; and de-select
                        conflicted residents.
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
                                    className="card p-3 bg-warning/10 border border-warning"
                                >
                                    <div className="flex flex-col">
                                        <p className="font-bold">
                                            {conflict.user_name}
                                        </p>
                                        <p className="text-sm text-grey-4">
                                            Conflicts with{' '}
                                            {conflict.conflicting_class} · {day}{' '}
                                            {startTime} – {endTime}
                                        </p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            }
            onSubmit={onConfirm}
            onClose={onClose}
        />
    );
});
