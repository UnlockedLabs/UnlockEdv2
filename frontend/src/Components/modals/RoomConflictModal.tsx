import { forwardRef } from 'react';
import { CloseX, CancelButton } from '../inputs';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import type { RoomConflict } from '@/common';
import { textMonthLocalDate } from '../helperFunctions/formatting';

interface RoomConflictModalProps {
    conflicts: RoomConflict[];
    roomName?: string;
    timezone: string;
    onClose: () => void;
}

export const RoomConflictModal = forwardRef<
    HTMLDialogElement,
    RoomConflictModalProps
>(function RoomConflictModal({ conflicts, roomName, timezone, onClose }, ref) {
    return (
        <dialog ref={ref} className="modal" onClose={onClose}>
            {conflicts && conflicts.length > 0 && (
                <div className="modal-box max-w-xl">
                    <CloseX close={onClose} />
                    <div className="flex flex-col gap-6">
                        <div className="flex items-center gap-3">
                            <ExclamationTriangleIcon className="w-8 h-8 text-warning" />
                            <h2 className="text-2xl font-semibold text-neutral">
                                Room Conflict Detected
                            </h2>
                        </div>

                        <p className="body text-grey-4">
                            {roomName
                                ? `${roomName} is`
                                : 'The selected room is'}{' '}
                            already booked during the requested time. Please
                            choose a different room or adjust your schedule.
                        </p>

                        <div className="space-y-3">
                            <span className="body font-semibold">
                                Conflicting Classes:
                            </span>
                            <div className="space-y-2 max-h-64 overflow-y-auto">
                                {conflicts.map((conflict, index) => (
                                    <div
                                        key={`${conflict.conflicting_event_id}-${index}`}
                                        className="card p-3 bg-base-200"
                                    >
                                        <div className="flex flex-col gap-1">
                                            <span className="body font-medium">
                                                {conflict.class_name}
                                            </span>
                                            <span className="body-small text-grey-4">
                                                {textMonthLocalDate(
                                                    conflict.start_time,
                                                    true,
                                                    timezone
                                                )}{' '}
                                                &ndash;{' '}
                                                {new Date(
                                                    conflict.end_time
                                                ).toLocaleTimeString('en-US', {
                                                    hour: 'numeric',
                                                    minute: '2-digit',
                                                    hour12: true,
                                                    timeZone: timezone
                                                })}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="flex justify-end mt-2">
                            <CancelButton onClick={onClose} label="Close" />
                        </div>
                    </div>
                </div>
            )}
        </dialog>
    );
});
