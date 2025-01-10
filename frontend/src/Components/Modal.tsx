import { ModalProps } from '@/common';
import { forwardRef, useState } from 'react';

const Modal = forwardRef<HTMLDialogElement, ModalProps>(function Modal(
    { type, item, form },
    ref
) {
    const [formKey, setFormKey] = useState(0);
    return (
        <dialog
            ref={ref}
            className="modal"
            onClose={() => setFormKey((prev) => prev + 1)}
        >
            <div className="modal-box">
                <div className="flex flex-col">
                    <span className="text-3xl font-semibold pb-6 text-neutral">
                        {type} {item}
                    </span>
                    <div key={formKey}>{form}</div>
                </div>
            </div>
        </dialog>
    );
});

export default Modal;
