import { forwardRef } from "react";

interface DeleteModalProps {
    item: string;
    deleteFunction: () => void;
    onClose: () => void;
}

const DeleteModal = forwardRef<HTMLDialogElement, DeleteModalProps>(
    function DeleteModal({ item, deleteFunction, onClose }, ref) {
        return (
            <dialog ref={ref} className="modal">
                <div className="modal-box">
                    <form method="dialog">
                        <button
                            className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
                            onClick={() => onClose()}
                        >
                            ✕
                        </button>
                    </form>
                    <h3 className="font-bold text-lg">Delete {item}</h3>
                    <p className="py-4">
                        Are you sure you would like to delete this{" "}
                        {item.toLowerCase()}? <br /> This action cannot be
                        undone.
                    </p>
                    <form
                        method="dialog"
                        className="flex flex-row justify-between"
                    >
                        <button className="btn" onClick={() => onClose()}>
                            Cancel
                        </button>
                        <button
                            className="btn btn-error"
                            onClick={() => {
                                deleteFunction(), onClose();
                            }}
                        >
                            Delete {item}
                        </button>
                    </form>
                </div>
            </dialog>
        );
    },
);

export default DeleteModal;
