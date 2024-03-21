import { ReactNode, forwardRef } from "react";

interface ModalProps {
    type: "Edit" | "Add" | "Delete";
    item: string;
    form: ReactNode | null;
    onSuccess: () => void;
    onCancel: () => void;
}

const Modal = forwardRef<HTMLDialogElement, ModalProps>(function Modal(
    { type, item, form, onSuccess, onCancel },
    ref,
) {
    return (
        <dialog ref={ref} className="modal">
            <div className="modal-box">
                <div className="flex flex-col">
                    <span className="text-3xl font-semibold pb-6 text-neutral">
                        {type} {item}
                    </span>
                    {type == "Delete" ? (
                        <div>
                            <p className="py-4">
                                Are you sure you would like to delete this{" "}
                                {item.toLowerCase()}?
                                <br /> This action cannot be undone.
                            </p>
                            <form
                                method="dialog"
                                className="flex flex-row justify-between"
                            >
                                <button
                                    className="btn"
                                    onClick={() => onCancel()}
                                >
                                    Cancel
                                </button>
                                <button
                                    className="btn btn-error"
                                    onClick={() => {
                                        onSuccess();
                                    }}
                                >
                                    Delete {item}
                                </button>
                            </form>
                        </div>
                    ) : (
                        <div>{form}</div>
                    )}
                </div>
            </div>
        </dialog>
    );
});

export default Modal;
