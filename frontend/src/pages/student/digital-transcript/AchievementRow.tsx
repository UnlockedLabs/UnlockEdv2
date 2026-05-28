import { ChevronDown, ChevronUp } from 'lucide-react';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import type { TranscriptEntry } from '@/types/digital-transcript';
import {
    countEditorFormSlots,
    editorFormSlotsTotal
} from './learningRecordDocumentModel';
import type { LearningRecordFormVariant } from './learningRecordPrototypes';
import { AchievementForm } from './AchievementForm';
import { AchievementFormCategories } from './AchievementFormCategories';

function formatCompletedShort(iso: string): string {
    if (!iso.trim()) return '';
    return new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

function collapsedDateLine(entry: TranscriptEntry): string {
    const datePart = formatCompletedShort(entry.completionDate);
    return datePart ? `Completed ${datePart}` : 'Completion date not set';
}

interface AchievementRowProps {
    formVariant: LearningRecordFormVariant;
    entry: TranscriptEntry;
    isExpanded: boolean;
    onToggleExpand: () => void;
    onPatch: (patch: Partial<TranscriptEntry>) => void;
    onCancel?: () => void;
    onDone?: () => void;
    showDoneErrors?: boolean;
    showSaveErrors?: boolean;
    showDelete?: boolean;
    onDeleteRequest?: () => void;
    activeStep?: number;
    onActiveStepChange?: (step: number) => void;
}

export function AchievementRow({
    formVariant,
    entry,
    isExpanded,
    onToggleExpand,
    onPatch,
    onCancel,
    onDone,
    showDoneErrors = false,
    showSaveErrors = false,
    showDelete,
    onDeleteRequest,
    activeStep = 0,
    onActiveStepChange
}: AchievementRowProps) {
    if (formVariant === 'funnel') {
        return (
            <div
                data-slot="achievement-row"
                data-achievement-id={entry.id}
                className="shrink-0 overflow-hidden px-3 pb-3"
            >
                <AchievementForm
                    entry={entry}
                    onChange={onPatch}
                    showSaveErrors={showSaveErrors}
                    activeStep={activeStep}
                    onActiveStepChange={onActiveStepChange ?? (() => {})}
                />
            </div>
        );
    }

    const title = entry.programName.trim() || 'Untitled achievement';
    const filled = countEditorFormSlots(entry);
    const total = editorFormSlotsTotal();
    const complete = filled === total;
    const progressPct = Math.round((filled / total) * 100);

    return (
        <Collapsible
            open={isExpanded}
            data-slot="achievement-row"
            data-achievement-id={entry.id}
            className="shrink-0 overflow-hidden rounded-lg border border-border/80 bg-background"
        >
            <button
                type="button"
                data-slot="achievement-row-trigger"
                className="group flex w-full flex-col text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-muted"
                onClick={onToggleExpand}
                aria-expanded={isExpanded}
            >
                <span className="flex w-full items-center gap-3 px-3 py-3">
                    <span className="min-w-0 flex-1 space-y-0.5">
                        <span
                            className={cn(
                                'block text-sm font-semibold leading-snug text-foreground transition-colors duration-150',
                                'group-hover:text-[#556830]'
                            )}
                        >
                            {title}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                            {collapsedDateLine(entry)}
                        </span>
                    </span>
                    <span
                        className={cn(
                            'shrink-0 text-muted-foreground transition-colors duration-150',
                            'group-hover:text-[#556830]'
                        )}
                        aria-hidden
                    >
                        {isExpanded ? (
                            <ChevronUp className="size-5" />
                        ) : (
                            <ChevronDown className="size-5" />
                        )}
                    </span>
                </span>
                <span className="mx-3 mb-3 block h-0.5 overflow-hidden rounded-full bg-muted">
                    <span
                        className={cn(
                            'block h-full rounded-full transition-[width] duration-200',
                            complete ? 'bg-[#556830]' : 'bg-neutral-300 dark:bg-neutral-600'
                        )}
                        style={{ width: `${progressPct}%` }}
                        role="img"
                        aria-label={`${filled} of ${total} questions answered`}
                    />
                </span>
            </button>
            <CollapsibleContent forceMount className={cn(!isExpanded && 'hidden')}>
                <div className="border-t border-black/6 bg-background px-3 pb-3 pt-3">
                    <AchievementFormCategories
                        entry={entry}
                        onChange={onPatch}
                        onCancel={onCancel ?? (() => {})}
                        onDone={onDone ?? (() => {})}
                        showDoneErrors={showDoneErrors}
                        showDelete={showDelete}
                        onDeleteRequest={onDeleteRequest}
                    />
                </div>
            </CollapsibleContent>
        </Collapsible>
    );
}
