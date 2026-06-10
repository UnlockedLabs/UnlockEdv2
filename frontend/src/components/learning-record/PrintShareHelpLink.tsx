import { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog';
import {
    LEARNING_RECORD_PRINT_SHARE_FAQ,
    LEARNING_RECORD_SAVED_HERE_FAQ
} from '@/data/learningRecordResidentCopy';
import { cn } from '@/lib/utils';

interface PrintShareHelpLinkProps {
    className?: string;
    /** For text on dark backgrounds (e.g. home start card). */
    variant?: 'default' | 'onDark';
}

export function PrintShareHelpLink({
    className,
    variant = 'default'
}: PrintShareHelpLinkProps) {
    const [open, setOpen] = useState(false);

    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                className={cn(
                    'inline-flex w-fit items-center text-left text-sm underline underline-offset-2 transition-opacity hover:opacity-80',
                    variant === 'onDark'
                        ? 'text-white/90'
                        : 'text-[#556830] dark:text-primary',
                    className
                )}
            >
                What does this mean?
            </button>
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-base">
                            {LEARNING_RECORD_PRINT_SHARE_FAQ.question}
                        </DialogTitle>
                        <DialogDescription className="text-sm leading-relaxed text-muted-foreground">
                            {LEARNING_RECORD_PRINT_SHARE_FAQ.answer}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2 border-t border-border pt-4">
                        <p className="text-sm font-medium text-foreground">
                            {LEARNING_RECORD_SAVED_HERE_FAQ.question}
                        </p>
                        <p className="text-sm leading-relaxed text-muted-foreground">
                            {LEARNING_RECORD_SAVED_HERE_FAQ.answer}
                        </p>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
