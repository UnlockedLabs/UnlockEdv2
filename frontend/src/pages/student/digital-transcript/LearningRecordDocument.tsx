import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { getEntryDisplayTitleOrNull } from './entryTitleDisplay';
import {
    confidenceScaleLabel,
    DOCUMENT_PREVIEW_LABELS,
    LEARNING_RECORD_PREVIEW_LABELS
} from './transcriptReflectionConfig';
import {
    countAnsweredReflections,
    getLearningRecordPreviewState,
    hasFilledFunnelReflectionSections,
    hasFilledMetadataSections,
    hasFilledNarrativeSections,
    isCompletedSectionFilled,
    isConfidenceSectionFilled,
    isProgramSectionFilled,
    isSkillsSectionFilled,
    reflectionSlotsTotal,
    type LearningRecordDocumentSource
} from './learningRecordDocumentModel';
import {
    LearningRecordDocumentNarrative,
    type LearningRecordDocumentVariant
} from './LearningRecordDocumentNarrative';

function formatCompletedLong(dateStr: string): string | null {
    if (!dateStr.trim()) return null;
    return new Date(`${dateStr}T12:00:00`).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

function confidenceSegments(level: string): number {
    if (!/^[1-5]$/.test(level)) return 0;
    return Number(level);
}

/** Scan + narrative section labels — 11px sentence case, document rhythm */
function SectionLabel({ id, children }: { id: string; children: ReactNode }) {
    return (
        <h3
            id={id}
            className="text-[11px] font-semibold tracking-[0.08em] text-muted-foreground"
        >
            {children}
        </h3>
    );
}

function PlaceholderText({ children }: { children: ReactNode }) {
    return <span className="italic text-muted-foreground">{children}</span>;
}

const skeletonBarClass = 'rounded-md bg-muted/70';

function SkeletonBar({ className }: { className?: string }) {
    return <div className={cn(skeletonBarClass, className)} aria-hidden />;
}

function SkeletonLines({ count = 4 }: { count?: number }) {
    const widths = ['w-full', 'w-[92%]', 'w-[88%]', 'w-[72%]', 'w-[64%]', 'w-[80%]'];
    return (
        <div className="space-y-2.5 pt-1" aria-hidden>
            {Array.from({ length: count }, (_, i) => (
                <div key={i} className={cn('h-2', skeletonBarClass, widths[i % widths.length])} />
            ))}
        </div>
    );
}

function SkeletonHeadline() {
    return (
        <div className="space-y-2.5 pt-0.5" aria-hidden>
            <SkeletonBar className="h-4 w-full" />
            <SkeletonBar className="h-4 w-[68%]" />
        </div>
    );
}

function SkeletonSkillPills() {
    return (
        <div className="flex flex-wrap gap-1.5 pt-0.5" aria-hidden>
            <SkeletonBar className="h-6 w-[4.5rem] rounded-full" />
            <SkeletonBar className="h-6 w-[5.25rem] rounded-full" />
            <SkeletonBar className="h-6 w-16 rounded-full" />
        </div>
    );
}

type EmptyPreviewVariant = 'placeholder' | 'skeleton';
export type LearningRecordDocumentLayout = 'default' | 'record';
export type { LearningRecordDocumentVariant };

interface LearningRecordDocumentProps {
    source: LearningRecordDocumentSource;
    /** Resident display name for funnel achievement header (not from form data). */
    residentName?: string;
    /** When false, hides the per-achievement readiness row (e.g. compact thumbnails). */
    showReadiness?: boolean;
    /** `record` — stacked program cards in the achievements-record preview. */
    layout?: LearningRecordDocumentLayout;
    /** Funnel entry — section-ordered right column; program/date only on the left. */
    documentVariant?: LearningRecordDocumentVariant;
    /** Extra classes on the root article (e.g. flex layout from parent card). */
    className?: string;
    /**
     * When set, empty metadata and narrative slots use this label (muted italic)
     * instead of the default instructional placeholders (entry-page preview).
     */
    emptyAnswerLabel?: string;
    /** Skeleton bars for empty slots (live achievements-record preview). */
    emptyPreviewVariant?: EmptyPreviewVariant;
    /** PDF export: render only sections with answers (no placeholders or skeletons). */
    filledSectionsOnly?: boolean;
}

export function LearningRecordDocument({
    source,
    residentName = '',
    showReadiness = true,
    layout = 'default',
    documentVariant = 'default',
    className,
    emptyAnswerLabel,
    emptyPreviewVariant = 'placeholder',
    filledSectionsOnly = false
}: LearningRecordDocumentProps) {
    const state = getLearningRecordPreviewState(source);
    const isFunnel = documentVariant === 'funnel';
    const isRecord = layout === 'record';
    const labels = isRecord ? LEARNING_RECORD_PREVIEW_LABELS : DOCUMENT_PREVIEW_LABELS;
    const emptyPh = emptyAnswerLabel?.trim();
    const skeletonEmpty = !filledSectionsOnly && emptyPreviewVariant === 'skeleton';
    const showAllNarrativeSections =
        !isFunnel &&
        !filledSectionsOnly &&
        (state !== 'empty' || Boolean(emptyPh) || skeletonEmpty);

    const showProgram = !filledSectionsOnly || isProgramSectionFilled(source);
    const showCompleted = isFunnel
        ? isCompletedSectionFilled(source)
        : !filledSectionsOnly || isCompletedSectionFilled(source);
    const showConfidence =
        !isFunnel && (!filledSectionsOnly || isConfidenceSectionFilled(source));
    const showSkills = !isFunnel && (!filledSectionsOnly || isSkillsSectionFilled(source));
    const showMetadataColumn =
        !isFunnel &&
        (!filledSectionsOnly || hasFilledMetadataSections(source));
    const showFunnelHeader =
        isFunnel &&
        (Boolean(residentName.trim()) ||
            showProgram ||
            showCompleted ||
            !filledSectionsOnly);
    const showNarrativeColumn = isFunnel
        ? !filledSectionsOnly || hasFilledFunnelReflectionSections(source)
        : !filledSectionsOnly || hasFilledNarrativeSections(source);
    const singleColumn =
        filledSectionsOnly && (showMetadataColumn !== showNarrativeColumn) && !isFunnel;

    function EmptySlot({ fallback, skeleton }: { fallback: ReactNode; skeleton: ReactNode }) {
        if (skeletonEmpty) return <>{skeleton}</>;
        if (emptyPh) return <PlaceholderText>{emptyPh}</PlaceholderText>;
        return <>{fallback}</>;
    }
    const answered = countAnsweredReflections(source);
    const totalSlots = reflectionSlotsTotal();
    const readinessPct = Math.round((answered / totalSlots) * 100);
    const seg = confidenceSegments(source.confidence);
    const dateShown = formatCompletedLong(source.completionDate);
    const headlineFilled = Boolean(source.oneSentence.trim());
    const residentDisplayName = residentName.trim();
    const programDisplayTitle = getEntryDisplayTitleOrNull(source.programName);

    const narrative = (
        <LearningRecordDocumentNarrative
            source={source}
            documentVariant={documentVariant}
            isRecord={isRecord}
            labels={labels}
            headlineFilled={headlineFilled}
            showAllNarrativeSections={showAllNarrativeSections}
            showEmptyHint={
                !filledSectionsOnly &&
                state === 'empty' &&
                !emptyPh &&
                !skeletonEmpty &&
                !isRecord
            }
            skeletonEmpty={skeletonEmpty}
            filledSectionsOnly={filledSectionsOnly}
            emptyPh={emptyPh}
            answered={answered}
            totalSlots={totalSlots}
            state={state}
            EmptySlot={EmptySlot}
            PlaceholderText={PlaceholderText}
            SkeletonHeadline={SkeletonHeadline}
            SkeletonLines={SkeletonLines}
        />
    );

    return (
        <article
            className={cn('learning-record-print-root flex min-h-0 flex-1 flex-col', className)}
            lang="en"
        >
            {showReadiness ? (
                <div className="print:hidden mb-4 shrink-0">
                    <div className="mb-1.5 flex items-baseline justify-between gap-2 text-xs text-muted-foreground">
                        <span className="leading-snug">Reflections you have added so far</span>
                        <span className="tabular-nums text-muted-foreground">
                            {answered} of {totalSlots}
                        </span>
                    </div>
                    <div className="h-1 overflow-hidden rounded-full bg-muted" role="img" aria-label={`${answered} of ${totalSlots} reflections added`}>
                        <div
                            className="h-full rounded-full bg-primary/45 transition-[width] duration-200 dark:bg-primary/50"
                            style={{ width: `${readinessPct}%` }}
                        />
                    </div>
                </div>
            ) : null}

            {isFunnel ? (
                <>
                    {showFunnelHeader ? (
                        <header
                            data-slot="funnel-achievement-header"
                            className="shrink-0 space-y-3 border-b border-border bg-muted/30 px-4 py-4"
                        >
                            {residentDisplayName || !filledSectionsOnly ? (
                                <p className="text-base font-medium text-foreground">
                                    {residentDisplayName || (
                                        <PlaceholderText>Resident name</PlaceholderText>
                                    )}
                                </p>
                            ) : null}
                            {showProgram || showCompleted ? (
                                <div className="flex items-start justify-between gap-4">
                                    {showProgram ? (
                                        <div className="min-w-0 flex-1 space-y-1">
                                            <SectionLabel id="lr-funnel-program">
                                                Achievement
                                            </SectionLabel>
                                            <p className="text-sm text-foreground">
                                                {programDisplayTitle ? (
                                                    programDisplayTitle
                                                ) : (
                                                    <EmptySlot
                                                        fallback={
                                                            <PlaceholderText>Your program</PlaceholderText>
                                                        }
                                                        skeleton={
                                                            <SkeletonBar className="inline-block h-3.5 w-40" />
                                                        }
                                                    />
                                                )}
                                            </p>
                                        </div>
                                    ) : null}
                                    {showCompleted ? (
                                        <div
                                            className={cn(
                                                'shrink-0 space-y-1',
                                                !showProgram && 'ml-auto'
                                            )}
                                        >
                                            <SectionLabel id="lr-funnel-completed">
                                                {labels.completed}
                                            </SectionLabel>
                                            <p className="text-sm text-foreground">{dateShown}</p>
                                        </div>
                                    ) : null}
                                </div>
                            ) : null}
                        </header>
                    ) : null}
                    {(showNarrativeColumn || !filledSectionsOnly) && (
                        <div className="flex min-w-0 flex-1 flex-col px-4 pb-4 pt-3">
                            {narrative}
                        </div>
                    )}
                </>
            ) : (
            <div
                className={cn(
                    'grid min-w-0 flex-1 grid-cols-1',
                    !singleColumn &&
                        (isRecord
                            ? 'gap-6 md:grid-cols-[minmax(11rem,13.5rem)_1fr] md:gap-0 md:divide-x md:divide-border'
                            : 'gap-5 md:grid-cols-[minmax(9.5rem,11.5rem)_1fr] md:gap-0 md:divide-x md:divide-border')
                )}
            >
                {showMetadataColumn ? (
                <div className="flex min-w-0 flex-col gap-5 md:pr-5">
                    {showProgram ? (
                    <section aria-labelledby="lr-doc-program" className="break-inside-avoid space-y-1.5">
                        <SectionLabel id="lr-doc-program">{labels.program}</SectionLabel>
                        <div className="text-[18px] font-medium leading-snug text-foreground">
                            {programDisplayTitle ? (
                                programDisplayTitle
                            ) : (
                                <EmptySlot
                                    fallback={<PlaceholderText>Your program</PlaceholderText>}
                                    skeleton={<SkeletonBar className="h-6 w-[88%] max-w-md" />}
                                />
                            )}
                        </div>
                    </section>
                    ) : null}

                    {showCompleted ? (
                    <section aria-labelledby="lr-doc-completed" className="break-inside-avoid space-y-1.5">
                        <SectionLabel id="lr-doc-completed">{labels.completed}</SectionLabel>
                        <div className="text-[13px] font-medium text-foreground">
                            {dateShown != null && dateShown !== '' ? (
                                dateShown
                            ) : (
                                <EmptySlot
                                    fallback={<PlaceholderText>Date</PlaceholderText>}
                                    skeleton={<SkeletonBar className="h-3.5 w-36" />}
                                />
                            )}
                        </div>
                    </section>
                    ) : null}

                    {showConfidence ? (
                    <section
                        aria-labelledby="lr-doc-confidence"
                        className="break-inside-avoid space-y-2"
                    >
                        <SectionLabel id="lr-doc-confidence">{labels.confidence}</SectionLabel>
                        <div className="flex gap-1" role="img" aria-label={`Confidence ${seg} out of 5`}>
                            {[1, 2, 3, 4, 5].map((i) => (
                                <div
                                    key={i}
                                    className={cn(
                                        'h-2.5 min-w-0 flex-1 rounded-sm',
                                        seg > 0 && i <= seg
                                            ? 'bg-foreground/90'
                                            : 'bg-muted/70'
                                    )}
                                />
                            ))}
                        </div>
                        {seg > 0 ? (
                            <p className="text-[12px] text-muted-foreground">{seg} out of 5</p>
                        ) : skeletonEmpty ? null : (
                            <p className="text-[12px] text-muted-foreground">
                                <PlaceholderText>Not selected yet</PlaceholderText>
                            </p>
                        )}
                    </section>
                    ) : null}

                    {showSkills ? (
                    <section aria-labelledby="lr-doc-skills" className="break-inside-avoid space-y-2">
                        <SectionLabel id="lr-doc-skills">{labels.skills}</SectionLabel>
                        {source.topSkills.length > 0 ? (
                            <ul className="flex list-none flex-wrap gap-1.5 p-0">
                                {source.topSkills.map((skill, idx) => (
                                    <li key={`${idx}-${skill}`}>
                                        <Badge
                                            variant="secondary"
                                            className={cn(
                                                'px-2.5 py-1 text-[12px] font-normal leading-normal',
                                                isRecord &&
                                                    'border-border/60 bg-muted/80 text-foreground'
                                            )}
                                        >
                                            {skill}
                                        </Badge>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <div className="text-[13px] text-muted-foreground">
                                <EmptySlot
                                    fallback={<PlaceholderText>Listed as you write</PlaceholderText>}
                                    skeleton={<SkeletonSkillPills />}
                                />
                            </div>
                        )}
                    </section>
                    ) : null}
                </div>
                ) : null}

                {showNarrativeColumn ? narrative : null}

            </div>
            )}

            {source.confidence.trim() && /^[1-5]$/.test(source.confidence) ? (
                <p className="sr-only">{confidenceScaleLabel(source.confidence)}</p>
            ) : null}
        </article>
    );
}
