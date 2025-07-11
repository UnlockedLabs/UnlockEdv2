import { forwardRef, useState } from 'react';
import { User } from '@/common';
import { TextOnlyModal, TextModalType } from './';

interface DeactivateUserModalProps {
    user: User;
    onConfirm: () => void;
    onClose: () => void;
}

export const DeactivateUserModal = forwardRef<
    HTMLDialogElement,
    DeactivateUserModalProps
>(function DeactivateUserModal({ user, onConfirm, onClose }, ref) {
    const [confirmationText, setConfirmationText] = useState('');
    const expectedText = user.doc_id ?? user.id.toString();

    const handleSubmit = () => {
        if (confirmationText === expectedText) {
            onConfirm();
        }
    };

    return (
        <TextOnlyModal
            ref={ref}
            type={TextModalType.Confirm}
            title="Deactivate Account"
            text={
                <div className="space-y-4">
                    <div className="bg-grey-1 p-4 rounded-lg">
                        <h4 className="font-semibold mb-2">
                            Resident Information
                        </h4>
                        <p>
                            <strong>Name:</strong> {user.name_last},{' '}
                            {user.name_first}
                        </p>
                        <p>
                            <strong>Resident ID:</strong> {user.doc_id ?? 'N/A'}
                        </p>
                        <p>
                            <strong>Current Facility:</strong>{' '}
                            {user.facility?.name ?? 'Unknown'}
                        </p>
                    </div>

                    <div className="text-sm">
                        <p className="mb-2">
                            You are about to deactivate this resident's account.
                        </p>
                        <ul className="list-disc list-inside space-y-1 text-xs">
                            <li>
                                The resident will be withdrawn from all active
                                classes and programs
                            </li>
                            <li>
                                The resident's account will be locked and marked
                                as Deactivated
                            </li>
                            <li>
                                Staff will no longer be able to edit this
                                resident's account
                            </li>
                            <li>
                                The resident will not be able to log in or
                                enroll in new programs
                            </li>
                            <li>
                                The time this account was deactivated will be
                                recorded
                            </li>
                            <li>
                                The resident's account history and favorites
                                will be preserved and remain searchable
                            </li>
                        </ul>
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-2">
                            Type the resident's ID (
                            <strong>{expectedText}</strong>) to confirm:
                        </label>
                        <input
                            type="text"
                            value={confirmationText}
                            onChange={(e) =>
                                setConfirmationText(e.target.value)
                            }
                            className={`input input-bordered w-full ${
                                confirmationText &&
                                confirmationText !== expectedText
                                    ? 'border-red-400'
                                    : ''
                            }`}
                            placeholder={expectedText}
                            autoFocus
                        />
                        {confirmationText &&
                            confirmationText !== expectedText && (
                                <p className="text-red-500 text-xs mt-1">
                                    Please enter exactly: {expectedText}
                                </p>
                            )}
                    </div>
                </div>
            }
            onSubmit={handleSubmit}
            onClose={onClose}
        />
    );
});
