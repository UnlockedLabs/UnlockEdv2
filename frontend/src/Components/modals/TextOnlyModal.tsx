import { forwardRef, ReactNode } from 'react';
import { CancelSubmitRow, CloseX } from '../inputs';
import { TextModalType } from '.';

type ModalWidth =
    | 'max-w-lg'
    | 'max-w-xl'
    | 'max-w-2xl'
    | 'max-w-3xl'
    | 'max-w-4xl';
interface TextModalProps {
    type: TextModalType;
    title: string;
    text: string | ReactNode;
    onSubmit: () => void;
    onClose: () => void;
    /**
     * Optional attribute sets the width of the modal box. If you need it to be wider just add one of these options below.
     * @default "max-w-md"
     * Allowed: "max-w-lg" | "max-w-xl" | "max-w-2xl" | "max-w-3xl" | "max-w-4xl"
     */
    width?: ModalWidth;
}
export const TextOnlyModal = forwardRef(function TextModal(
    {
        type,
        title,
        text,
        onSubmit,
        onClose,
        children,
        width
    }: TextModalProps & { children?: ReactNode },
    ref: React.ForwardedRef<HTMLDialogElement>
) {
    return (
        <dialog
            ref={ref}
            className="modal"
            onKeyDown={(event) => {
                if (event.key === 'Escape') onClose();
            }}
        >
            <div className={`modal-box ` + (width ? width : '')}>
                <CloseX close={onClose} />
                <div className="flex flex-col gap-6">
                    <span className={`text-3xl font-semibold text-neutral`}>
                        {title}
                    </span>
                    {typeof text === 'string' ? (
                        <p className="whitespace-pre-line body">{text}</p>
                    ) : (
                        text
                    )}
                    {type === TextModalType.Information ? (
                        <>{children}</>
                    ) : (
                        <CancelSubmitRow
                            type={type}
                            onCancel={onClose}
                            onSubmit={onSubmit}
                            action={title}
                        />
                    )}
                </div>
            </div>
        </dialog>
    );
});
