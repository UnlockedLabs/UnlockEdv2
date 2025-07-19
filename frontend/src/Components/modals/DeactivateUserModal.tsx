import { forwardRef, useState } from 'react';
import { User } from '@/common';
import { FormModal, FormInputTypes, Input } from './';
import { FieldValues, SubmitHandler } from 'react-hook-form';

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
    const isValidConfirmation = confirmationText === expectedText;

    const handleSubmit: SubmitHandler<FieldValues> = () => {
        onConfirm();
    };

    const deactivateUserInputs: Input[] = [
        {
            type: FormInputTypes.Unique,
            label: '',
            interfaceRef: '',
            required: false,
            uniqueComponent: (
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
                        <ul className="list-disc list-outside space-y-1 text-xs pl-4">
                            <li>
                                The resident will be withdrawn from all active
                                classes and programs.
                            </li>
                            <li>
                                The resident's account will be locked and marked
                                as Deactivated.
                            </li>
                            <li>
                                Staff will no longer be able to edit this
                                resident's account.
                            </li>
                            <li>
                                The resident will not be able to log in or
                                enroll in new programs.
                            </li>
                            <li>
                                The time this account was deactivated will be
                                recorded.
                            </li>
                            <li>
                                The resident's account history and favorites
                                will be preserved and remain searchable.
                            </li>
                        </ul>
                    </div>
                </div>
            )
        },
        {
            type: FormInputTypes.Text,
            label: `Type the resident's ID (${expectedText}) to confirm:`,
            interfaceRef: 'confirmation',
            required: true,
            length: 50,
            placeholder: expectedText,
            onChange: (e) => setConfirmationText(e.target.value),
            validate: (value: string) => {
                if (value !== expectedText) {
                    return `Please enter exactly: ${expectedText}`;
                }
                return true;
            }
        }
    ];

    return (
        <FormModal
            ref={ref}
            title="Deactivate Account"
            inputs={deactivateUserInputs}
            onSubmit={handleSubmit}
            onClose={onClose}
            showCancel={true}
            submitText="Deactivate User"
            enableSubmit={isValidConfirmation}
        />
    );
});
