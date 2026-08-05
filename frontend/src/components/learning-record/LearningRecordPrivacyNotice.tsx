import { ShieldCheck } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { LEARNING_RECORD_PRIVACY_NOTICE } from '@/data/learningRecordResidentCopy';
import { cn } from '@/lib/utils';

export interface LearningRecordPrivacyNoticeProps {
    /**
     * `short` — Learning Record landing page.
     * `full` — achievement entry form (expanded wording, same substance).
     */
    variant: 'short' | 'full';
    /** Caller owns spacing; the notice itself sets no margin. */
    className?: string;
}

/**
 * Persistent transparency notice telling residents how their Learning Record
 * data is used. Informational only — deliberately not dismissible and never a
 * gate: it must not block or delay starting an entry.
 *
 * Copy lives in `LEARNING_RECORD_PRIVACY_NOTICE` so both placements stay
 * consistent and Carolina's final wording is a one-file change.
 */
export function LearningRecordPrivacyNotice({
    variant,
    className
}: LearningRecordPrivacyNoticeProps) {
    const copy = LEARNING_RECORD_PRIVACY_NOTICE[variant];

    return (
        <Alert
            /*
             * `Alert` hardcodes role="alert" (an assertive live region), which
             * would interrupt screen readers on every page load. This notice is
             * passive, so downgrade to `note`. Safe because `Alert` spreads
             * props after its own role.
             */
            role="note"
            data-slot="learning-record-privacy-notice"
            className={cn('border-[#556830]/30 bg-[#556830]/5', className)}
        >
            <ShieldCheck
                className="text-[#556830] dark:text-primary"
                aria-hidden
            />
            <AlertTitle className="text-foreground">{copy.title}</AlertTitle>
            <AlertDescription>
                <span className="text-sm leading-relaxed">{copy.body}</span>
            </AlertDescription>
        </Alert>
    );
}
