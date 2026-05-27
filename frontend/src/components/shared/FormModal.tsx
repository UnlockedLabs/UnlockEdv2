import { ReactNode } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface FormModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: ReactNode;
    description?: ReactNode;
    children: ReactNode;
    className?: string;
    /** Extra classes for the title. Pass a `text-*` class to override the default brand-green color. */
    titleClassName?: string;
    /** Extra classes for the description. */
    descriptionClassName?: string;
    /** Extra classes for the DialogHeader wrapper (use when overriding DialogContent padding). */
    headerClassName?: string;
    /** Extra classes for the close (X) button. */
    closeButtonClassName?: string;
    preventAutoFocus?: boolean;
    /** Prevent the dialog from closing when the user clicks outside. */
    preventOutsideClose?: boolean;
}

export function FormModal({
    open,
    onOpenChange,
    title,
    description,
    children,
    className,
    titleClassName,
    descriptionClassName,
    headerClassName,
    closeButtonClassName,
    preventAutoFocus,
    preventOutsideClose
}: FormModalProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                className={className}
                closeButtonClassName={closeButtonClassName}
                onOpenAutoFocus={preventAutoFocus ? (e) => e.preventDefault() : undefined}
                onPointerDownOutside={preventOutsideClose ? (e) => e.preventDefault() : undefined}
            >
                <DialogHeader className={headerClassName}>
                    <DialogTitle className={cn('text-brand-dark', titleClassName)}>
                        {title}
                    </DialogTitle>
                    {description && (
                        <DialogDescription className={descriptionClassName}>
                            {description}
                        </DialogDescription>
                    )}
                </DialogHeader>
                {children}
            </DialogContent>
        </Dialog>
    );
}
