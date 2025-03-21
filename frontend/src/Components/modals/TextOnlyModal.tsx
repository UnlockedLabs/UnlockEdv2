import { forwardRef, ReactNode } from 'react';
import { CancelSubmitRow, CloseX } from '../inputs';
import { TextModalType } from '.';

interface TextModalProps {
    type: TextModalType;
    title: string;
    text: string;
    onSubmit: () => void;
    onClose: () => void;
}
export const TextOnlyModal = forwardRef(function TextModal(
    {
        type,
        title,
        text,
        onSubmit,
        onClose,
        children
    }: TextModalProps & { children?: ReactNode },
    ref: React.ForwardedRef<HTMLDialogElement>
) {
    return (
        <dialog ref={ref} className="modal">
            <div className="modal-box">
                <CloseX close={onClose} />
                <div className="flex flex-col gap-6">
                    <span className={`text-3xl font-semibold text-neutral`}>
                        {title}
                    </span>
                    <p>{text}</p>
                    {type === TextModalType.Information ? (
                        <>{children}</>
                    ) : (
                        <CancelSubmitRow
                            type={type}
                            onCancel={onClose}
                            onSubmit={onSubmit}
                        />
                    )}
                </div>
            </div>
        </dialog>
    );
});
