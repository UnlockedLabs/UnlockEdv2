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
        text: 'Marking this program inactive will prevent new classes from being created. Existing active and scheduled classes will continue. Scheduled classes will require manual review if you wish to cancel them. Are you sure?'
    },
    archive: {
        title: 'Archive Program',
        text: 'Are you sure you would like to archive this program? Archiving this program will prevent new classes from being created. Existing data will remain available for reporting.'
    },
    reactivate: {
        title: 'Reactivate Program',
        text: 'Reactivating this program will make it available again for use. Please choose the program’s new status:'
    }
};

const ModifyProgramModal = forwardRef(function (
    {
        action,
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

    if (!action) return null;

    const { title, text } = ProgramActionMessages[action];

    function close() {
        setChosenStatus(false);
        closeModal(ref);
        onClose?.();
    }

    if (action === 'reactivate') {
        return (
            <dialog
                ref={ref}
                className="modal"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="modal-box" onClick={(e) => e.stopPropagation()}>
                    <h3 className="font-bold text-lg">{title}</h3>
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
