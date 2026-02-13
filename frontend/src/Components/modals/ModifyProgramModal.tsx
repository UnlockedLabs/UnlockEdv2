import { TextOnlyModal } from './TextOnlyModal';
import { closeModal, TextModalType } from '.';
import { forwardRef, useState } from 'react';
import { ProgramsOverviewTable, ProgramAction } from '@/common';

export const ProgramActionMessages = {
    set_available: {
        title: 'Set to Available',
        text: 'Setting this program to available will allow new classes to be created. Are you sure?'
    },
    set_inactive: {
        title: 'Set to Inactive',
        text: " You won't be able to create new classes for this program. \n Existing and scheduled classes will continue unless you cancel them manually."
    },
    archive: {
        title: 'Archive Program',
        text: 'Are you sure you would like to archive this program? Archiving this program will prevent new classes from being created. Existing data will remain available for reporting.'
    },
    reactivate: {
        title: 'Reactivate Program',
        text: "Reactivating this program will make it available again for use. Please choose the program's new status:"
    },
    delete: {
        title: 'Delete Program',
        text: 'This action will permanently delete the program and cannot be undone. To confirm, type the program name below:'
    }
};

const ModifyProgramModal = forwardRef(function (
    {
        action,
        program,
        onConfirm,
        onClose
    }: {
        action: ProgramAction | null;
        program: ProgramsOverviewTable;
        onConfirm: (newStatus?: boolean) => void;
        onClose: () => void;
    },
    ref: React.ForwardedRef<HTMLDialogElement>
) {
    const [chosenStatus, setChosenStatus] = useState<boolean>(true);
    const [confirmName, setConfirmName] = useState<string>('');

    if (!action) return null;

    const { title, text } = ProgramActionMessages[action];

    function close() {
        setChosenStatus(false);
        setConfirmName('');
        closeModal(ref);
        onClose?.();
    }

    if (action === 'delete') {
        const nameMatches = confirmName.trim() === program.program_name.trim();
        return (
            <dialog
                ref={ref}
                className="modal"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="modal-box" onClick={(e) => e.stopPropagation()}>
                    <span className="text-3xl font-semibold text-error">
                        {title}
                    </span>
                    <p className="py-4">{text}</p>
                    <div className="form-control">
                        <label className="label">
                            <span className="label-text font-medium">
                                Program name: {program.program_name}
                            </span>
                        </label>
                        <input
                            type="text"
                            className="input input-bordered w-full"
                            placeholder="Type program name to confirm"
                            value={confirmName}
                            onChange={(e) => {
                                e.stopPropagation();
                                setConfirmName(e.target.value);
                            }}
                            onClick={(e) => e.stopPropagation()}
                        />
                    </div>
                    <div className="modal-action">
                        <button
                            className="btn"
                            onClick={(e) => {
                                e.stopPropagation();
                                close();
                            }}
                        >
                            Cancel
                        </button>
                        <button
                            className="btn btn-error"
                            disabled={!nameMatches}
                            onClick={(e) => {
                                e.stopPropagation();
                                onConfirm();
                                close();
                            }}
                        >
                            Delete
                        </button>
                    </div>
                </div>
            </dialog>
        );
    }

    if (action === 'reactivate') {
        return (
            <dialog
                ref={ref}
                className="modal"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="modal-box" onClick={(e) => e.stopPropagation()}>
                    <span className={`text-3xl font-semibold text-neutral`}>
                        {' '}
                        {title}
                    </span>
                    <p className="py-4">{text}</p>
                    <div className="form-control">
                        <label className="label cursor-pointer">
                            <span className="label-text">Available</span>
                            <input
                                type="radio"
                                name="status"
                                className="radio"
                                checked={chosenStatus}
                                onChange={(e) => {
                                    e.stopPropagation();
                                    setChosenStatus(true);
                                }}
                            />
                        </label>
                        <label className="label cursor-pointer">
                            <span className="label-text">Inactive</span>
                            <input
                                type="radio"
                                name="status"
                                className="radio"
                                checked={!chosenStatus}
                                onChange={(e) => {
                                    e.stopPropagation();
                                    setChosenStatus(false);
                                }}
                            />
                        </label>
                    </div>
                    <div className="modal-action">
                        <button
                            className="btn"
                            onClick={(e) => {
                                e.stopPropagation();
                                close();
                            }}
                        >
                            Cancel
                        </button>
                        <button
                            className="btn btn-primary"
                            onClick={(e) => {
                                e.stopPropagation();
                                onConfirm(chosenStatus);
                                close();
                            }}
                        >
                            Confirm
                        </button>
                    </div>
                </div>
            </dialog>
        );
    }

    return (
        <div onClick={(e) => e.stopPropagation()}>
            <TextOnlyModal
                ref={ref}
                type={TextModalType.Confirm}
                title={title}
                text={text}
                onSubmit={() => {
                    onConfirm();
                    close();
                }}
                onClose={close}
            />
        </div>
    );
});

export default ModifyProgramModal;
