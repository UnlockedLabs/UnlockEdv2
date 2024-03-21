import { ReactNode, forwardRef } from "react";

interface EditModalProps {
    item: string;
    editForm: ReactNode;
    onClose: () => void;
}

const EditModal = forwardRef<HTMLDialogElement, EditModalProps>(
    function EditModal({ item, editForm, onClose }, ref) {
        return (
            <dialog ref={ref} className="modal">
                <div className="modal-box">
                    <div className="flex flex-col">
                        <span className="text-3xl font-semibold pb-6 text-neutral">
                            Edit {item}
                        </span>
                        {editForm}
                    </div>
                </div>
            </dialog>
        );
    },
);

export default EditModal;
