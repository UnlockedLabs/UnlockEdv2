import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { TranscriptEntry } from '@/types/digital-transcript';
import { cn } from '@/lib/utils';
import { FUNNEL_FIELD_DESCRIPTIONS } from './transcriptReflectionConfig';
import { learningRecordQuestionHeaderClassName } from './learningRecordButtons';

interface AchievementFormMetadataProps {
    entry: TranscriptEntry;
    onChange: (patch: Partial<TranscriptEntry>) => void;
    showSaveErrors?: boolean;
    /** Categories variant — alias for showSaveErrors. */
    showDoneErrors?: boolean;
    /** When true, adds a bottom border to separate metadata from reflection sections. */
    showSectionDivider?: boolean;
    /** Funnel variant — optional completion date, achievement labels. */
    variant?: 'default' | 'funnel';
}

export function AchievementFormMetadata({
    entry,
    onChange,
    showSaveErrors,
    showDoneErrors,
    showSectionDivider = false,
    variant = 'default'
}: AchievementFormMetadataProps) {
    const showErrors = showSaveErrors ?? showDoneErrors ?? false;
    const isFunnel = variant === 'funnel';
    const programOk = Boolean(entry.programName.trim());
    const dateOk = Boolean(entry.completionDate.trim());
    const programLabel = isFunnel ? 'Achievement' : 'Program name';
    const dateLabel = isFunnel ? 'Program completion date' : 'Completion date';

    return (
        <div
            data-slot="achievement-form-metadata"
            className={cn('space-y-8', showSectionDivider && 'border-b border-border/70 pb-6')}
        >
            <div>
                <div className={learningRecordQuestionHeaderClassName}>
                    <Label
                        htmlFor={`ach-program-${entry.id}`}
                        className="text-base font-medium leading-snug text-foreground"
                    >
                        {programLabel}
                    </Label>
                    {isFunnel ? (
                        <p className="text-xs leading-relaxed text-muted-foreground">
                            {FUNNEL_FIELD_DESCRIPTIONS.programName}
                        </p>
                    ) : null}
                </div>
                <Input
                    id={`ach-program-${entry.id}`}
                    data-slot="transcript-program-name"
                    value={entry.programName}
                    onChange={(e) => onChange({ programName: e.target.value })}
                    aria-invalid={showErrors && !programOk}
                    className="h-10 border-border/80 bg-muted/40"
                />
                {showErrors && !programOk ? (
                    <p className="mt-2 text-sm text-destructive" role="alert">
                        {showSaveErrors
                            ? 'Please enter an achievement name to save your record.'
                            : 'Add a program or course name to continue.'}
                    </p>
                ) : null}
            </div>

            <div>
                <div className={learningRecordQuestionHeaderClassName}>
                    <Label
                        htmlFor={`ach-date-${entry.id}`}
                        className="text-base font-medium leading-snug text-foreground"
                    >
                        {dateLabel}
                    </Label>
                    {isFunnel ? (
                        <p className="text-xs leading-relaxed text-muted-foreground">
                            {FUNNEL_FIELD_DESCRIPTIONS.completionDate}
                        </p>
                    ) : null}
                </div>
                <Input
                    id={`ach-date-${entry.id}`}
                    type="date"
                    data-slot="transcript-completion-date"
                    value={entry.completionDate}
                    onChange={(e) => onChange({ completionDate: e.target.value })}
                    aria-invalid={!isFunnel && showErrors && !dateOk}
                    className="h-10 border-border/80 bg-muted/40"
                />
                {!isFunnel && showErrors && !dateOk ? (
                    <p className="mt-2 text-sm text-destructive" role="alert">
                        {showSaveErrors
                            ? 'Please add a completion date to save your achievement.'
                            : 'Add a completion date to continue.'}
                    </p>
                ) : null}
            </div>
        </div>
    );
}
