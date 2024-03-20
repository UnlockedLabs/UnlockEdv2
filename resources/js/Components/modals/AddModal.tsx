import { ReactNode, forwardRef } from "react";

interface AddModalProps {
    item: string;
    addForm: ReactNode;
}

const AddModal = forwardRef<HTMLDialogElement, AddModalProps>(function AddModal(
    { item, addForm },
    ref,
) {
    return (
        <dialog ref={ref} className="modal">
            <div className="modal-box">
                <div className="flex flex-col">
                    <span className="text-3xl font-semibold pb-6 text-neutral">
                        Add {item}
                    </span>
                    {addForm}
                </div>
            </div>
        </dialog>
    );
});

export default AddModal;
