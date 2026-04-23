import { ReactNode } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog';

interface FormModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    description?: string;
    children: ReactNode;
    className?: string;
    preventAutoFocus?: boolean;
}

export function FormModal({
    open,
    onOpenChange,
    title,
    description,
    children,
    className,
    preventAutoFocus
}: FormModalProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                className={className}
                onOpenAutoFocus={preventAutoFocus ? (e) => e.preventDefault() : undefined}
            >
                <DialogHeader>
                    <DialogTitle className="text-[#203622]">
                        {title}
                    </DialogTitle>
                    {description && (
                        <DialogDescription>{description}</DialogDescription>
                    )}
                </DialogHeader>
                {children}
            </DialogContent>
        </Dialog>
    );
}
