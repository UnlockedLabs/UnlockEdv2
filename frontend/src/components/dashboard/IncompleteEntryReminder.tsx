import { Link } from 'react-router-dom';
import { PlayCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
    getIncompleteEntryBannerText
} from '@/pages/student/digital-transcript/entryTitleDisplay';
import {
    learningRecordPrimaryButtonClassName
} from '@/pages/student/digital-transcript/learningRecordButtons';

/**
 * Data for an in-progress achievement entry surfaced on the resident homepage.
 * `title` is the raw program / achievement name from storage (may be junk or empty).
 * `resumeHref` deep-links into the editor at the step they left off (`?edit=<id>`).
 */
export interface InProgressEntryReminderData {
    id: string;
    title: string;
    resumeHref: string;
}

export interface IncompleteEntryReminderProps {
    /** True when the resident has an unfinished achievement entry on this device. */
    hasInProgressEntry: boolean;
    /** In-progress entry props for copy + deep-link; required when `hasInProgressEntry` is true. */
    entry: InProgressEntryReminderData | null;
    /** When true, the resident dismissed this reminder for the current entry. */
    dismissed?: boolean;
    onDismiss?: () => void;
}

/**
 * Tier-1 banner nudge for returning residents with an incomplete achievement entry.
 * This banner is the sole prominent resume entry point on the homepage.
 */
export function IncompleteEntryReminder({
    hasInProgressEntry,
    entry,
    dismissed = false,
    onDismiss
}: IncompleteEntryReminderProps) {
    if (!hasInProgressEntry || !entry || dismissed) {
        return null;
    }

    return (
        <Alert
            className="border-[#556830]/30 bg-[#556830]/5"
            aria-labelledby="home-incomplete-entry-reminder-heading"
        >
            <PlayCircle
                className="text-[#556830] dark:text-primary"
                aria-hidden
            />
            <AlertTitle
                id="home-incomplete-entry-reminder-heading"
                className="text-foreground"
            >
                You have an unfinished achievement
            </AlertTitle>
            <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-sm leading-relaxed">
                    {getIncompleteEntryBannerText(entry.title)}
                </span>
                <div className="flex shrink-0 items-center gap-2">
                    <Button
                        asChild
                        size="sm"
                        className={`${learningRecordPrimaryButtonClassName} px-4`}
                    >
                        <Link to={entry.resumeHref}>
                            Finish your entry
                        </Link>
                    </Button>
                    {onDismiss ? (
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="shrink-0 text-muted-foreground hover:text-foreground"
                            onClick={onDismiss}
                        >
                            Dismiss
                        </Button>
                    ) : null}
                </div>
            </AlertDescription>
        </Alert>
    );
}
