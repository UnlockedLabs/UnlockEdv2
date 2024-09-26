import { ModalProps } from '@/common';
import { forwardRef } from 'react';

const Modal = forwardRef<HTMLDialogElement, ModalProps>(function Modal(
    { type, item, form },
    ref
) {
    return (
        <dialog ref={ref} className="modal">
            <div className="modal-box">
                <div className="flex flex-col">
                    <span className="text-3xl font-semibold pb-6 text-neutral">
                        {type} {item}
                    </span>
                    <div>{form}</div>
                </div>
            </div>
        </dialog>
    );
});

export default Modal;
