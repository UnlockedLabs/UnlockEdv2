import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { ConfidenceSegmentedControl } from './ConfidenceSegmentedControl';
import {
    DOCUMENT_PREVIEW_LABELS,
    FUNNEL_PREVIEW_LABELS,
    FUNNEL_PREVIEW_SECTIONS,
    funnelReflectionFieldAnswered,
    LEARNING_RECORD_PREVIEW_LABELS,
    type ReflectionAnswerKey
} from './transcriptReflectionConfig';
import {
    isAdviceSectionFilled,
    isConnectsSectionFilled,
    isFinishSectionFilled,
    isHeadlineSectionFilled,
    isPrideSectionFilled,
    isStandoutSectionFilled,
    type LearningRecordDocumentSource
} from './learningRecordDocumentModel';

const narrativeBodyClass =
    'whitespace-pre-wrap text-[14px] font-normal leading-[1.6] text-foreground';

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

type NarrativeLabels = typeof DOCUMENT_PREVIEW_LABELS | typeof LEARNING_RECORD_PREVIEW_LABELS;

export type LearningRecordDocumentVariant = 'default' | 'funnel';

interface LearningRecordDocumentNarrativeProps {
    source: LearningRecordDocumentSource;
    documentVariant?: LearningRecordDocumentVariant;
    isRecord: boolean;
    labels: NarrativeLabels;
    headlineFilled: boolean;
    showAllNarrativeSections: boolean;
    showEmptyHint: boolean;
    skeletonEmpty: boolean;
    filledSectionsOnly?: boolean;
    emptyPh: string | undefined;
    answered: number;
    totalSlots: number;
    state: 'empty' | 'partial' | 'complete';
    EmptySlot: (props: { fallback: ReactNode; skeleton: ReactNode }) => ReactNode;
    PlaceholderText: (props: { children: ReactNode }) => ReactNode;
    SkeletonHeadline: () => ReactNode;
    SkeletonLines: (props: { count?: number }) => ReactNode;
}

function funnelSkillsText(source: LearningRecordDocumentSource): string {
    return source.topSkills.filter(Boolean).join(' ').trim();
}

function funnelFieldText(source: LearningRecordDocumentSource, key: ReflectionAnswerKey): string {
    if (key === 'topSkills') return funnelSkillsText(source);
    if (key === 'confidence') return source.confidence.trim();
    return source[key].trim();
}

function FunnelPreviewNarrative({ source }: { source: LearningRecordDocumentSource }) {
    return (
        <div className="flex min-w-0 flex-col gap-3">
            {FUNNEL_PREVIEW_SECTIONS.map((section) => {
                const sectionHasAnswers = section.fields.some((field) =>
                    funnelReflectionFieldAnswered(source, field)
                );
                if (!sectionHasAnswers) return null;

                return (
                    <div key={section.id} className="space-y-3">
                        <div className="my-3 flex items-center gap-3 break-inside-avoid">
                            <span
                                id={`lr-funnel-section-${section.id}`}
                                className="whitespace-nowrap text-xs font-medium uppercase tracking-widest text-black"
                            >
                                {section.title}
                            </span>
                            <div className="flex-1 border-t border-border/60" />
                        </div>

                        {section.fields.map((field) => {
                            if (!funnelReflectionFieldAnswered(source, field)) return null;

                            const labelId = `lr-funnel-field-${field}`;
                            const caption = FUNNEL_PREVIEW_LABELS[field];

                            if (field === 'confidence') {
                                return (
                                    <section
                                        key={field}
                                        aria-labelledby={labelId}
                                        className="break-inside-avoid space-y-2"
                                    >
                                        <SectionLabel id={labelId}>{caption}</SectionLabel>
                                        <ConfidenceSegmentedControl
                                            value={source.confidence}
                                            labelledBy={labelId}
                                            readOnly
                                        />
                                    </section>
                                );
                            }

                            const text = funnelFieldText(source, field);
                            return (
                                <section
                                    key={field}
                                    aria-labelledby={labelId}
                                    className="break-inside-avoid space-y-2"
                                >
                                    <SectionLabel id={labelId}>{caption}</SectionLabel>
                                    <p className={narrativeBodyClass}>{text}</p>
                                </section>
                            );
                        })}
                    </div>
                );
            })}
        </div>
    );
}

export function LearningRecordDocumentNarrative({
    source,
    documentVariant = 'default',
    isRecord,
    labels,
    headlineFilled,
    showAllNarrativeSections,
    showEmptyHint,
    skeletonEmpty,
    filledSectionsOnly = false,
    emptyPh,
    answered,
    totalSlots,
    state,
    EmptySlot,
    PlaceholderText,
    SkeletonHeadline,
    SkeletonLines
}: LearningRecordDocumentNarrativeProps) {
    if (documentVariant === 'funnel') {
        return <FunnelPreviewNarrative source={source} />;
    }

    const showHeadline = !filledSectionsOnly || isHeadlineSectionFilled(source);
    const showPride = !filledSectionsOnly || isPrideSectionFilled(source);
    const showStandout = !filledSectionsOnly || isStandoutSectionFilled(source);
    const showFinish = !filledSectionsOnly || isFinishSectionFilled(source);
    const showConnects = !filledSectionsOnly || isConnectsSectionFilled(source);
    const showAdvice = !filledSectionsOnly || isAdviceSectionFilled(source);

    return (
        <div className={cn('flex min-w-0 flex-col md:pl-5', isRecord ? 'gap-6' : 'gap-5')}>
            {showHeadline ? (
                isRecord ? (
                    <section aria-label="Program headline" className="break-inside-avoid">
                        {headlineFilled ? (
                            <p className="font-serif text-[22px] font-normal leading-[1.35] text-foreground md:text-[24px]">
                                &ldquo;{source.oneSentence.trim()}&rdquo;
                            </p>
                        ) : (
                            <div className="text-[14px] leading-[1.6] text-muted-foreground">
                                <EmptySlot
                                    fallback={
                                        <PlaceholderText>
                                            Your one-sentence summary will appear here.
                                        </PlaceholderText>
                                    }
                                    skeleton={<SkeletonHeadline />}
                                />
                            </div>
                        )}
                    </section>
                ) : (
                    <section
                        aria-labelledby="lr-doc-headline"
                        className={cn(
                            'break-inside-avoid space-y-2 rounded-md border-l-4 border-border bg-muted/25 px-3 py-3 dark:bg-muted/15',
                            headlineFilled && 'border-l-primary/60 bg-muted/15 dark:bg-muted/10'
                        )}
                    >
                        <SectionLabel id="lr-doc-headline">
                            {DOCUMENT_PREVIEW_LABELS.headline}
                        </SectionLabel>
                        {headlineFilled ? (
                            <p className="font-serif text-[20px] font-normal not-italic leading-[1.4] text-foreground">
                                {source.oneSentence.trim()}
                            </p>
                        ) : (
                            <div className="text-[14px] leading-[1.6] text-muted-foreground">
                                <EmptySlot
                                    fallback={
                                        <PlaceholderText>
                                            You&apos;ll write a one-sentence summary at the end. It will
                                            appear here.
                                        </PlaceholderText>
                                    }
                                    skeleton={<SkeletonHeadline />}
                                />
                            </div>
                        )}
                    </section>
                )
            ) : null}

            {showEmptyHint ? (
                <div className="space-y-2 break-inside-avoid" aria-hidden>
                    <p className="text-sm text-muted-foreground">
                        Your reflections will appear here as you answer.
                    </p>
                    <SkeletonLines count={4} />
                </div>
            ) : null}

            {showAllNarrativeSections || filledSectionsOnly ? (
                <>
                    {showPride ? (
                        <section aria-labelledby="lr-doc-pride" className="break-inside-avoid space-y-2">
                            <SectionLabel id="lr-doc-pride">{labels.pride}</SectionLabel>
                            {source.pride.trim() ? (
                                <p className={narrativeBodyClass}>{source.pride.trim()}</p>
                            ) : (
                                <div className="text-[14px] leading-[1.6] text-muted-foreground">
                                    <EmptySlot
                                        fallback={
                                            <PlaceholderText>Add your answer on the left</PlaceholderText>
                                        }
                                        skeleton={<SkeletonLines count={3} />}
                                    />
                                </div>
                            )}
                        </section>
                    ) : null}

                    {showStandout ? (
                        <section aria-labelledby="lr-doc-standout" className="break-inside-avoid space-y-2">
                            <SectionLabel id="lr-doc-standout">{labels.standout}</SectionLabel>
                            {source.standoutMoment.trim() ? (
                                <p className={narrativeBodyClass}>{source.standoutMoment.trim()}</p>
                            ) : (
                                <div className="text-[14px] leading-[1.6] text-muted-foreground">
                                    <EmptySlot
                                        fallback={
                                            <PlaceholderText>Add your answer on the left</PlaceholderText>
                                        }
                                        skeleton={<SkeletonLines count={3} />}
                                    />
                                </div>
                            )}
                        </section>
                    ) : null}

                    {showFinish ? (
                        <section aria-labelledby="lr-doc-finish" className="break-inside-avoid space-y-2">
                            <SectionLabel id="lr-doc-finish">{labels.finish}</SectionLabel>
                            {source.whatMadeYouFinish.trim() ? (
                                <p className={narrativeBodyClass}>{source.whatMadeYouFinish.trim()}</p>
                            ) : (
                                <div className="text-[14px] leading-[1.6] text-muted-foreground">
                                    <EmptySlot
                                        fallback={
                                            <PlaceholderText>Add your answer on the left</PlaceholderText>
                                        }
                                        skeleton={<SkeletonLines count={3} />}
                                    />
                                </div>
                            )}
                        </section>
                    ) : null}

                    {showConnects ? (
                        <section aria-labelledby="lr-doc-connects" className="break-inside-avoid space-y-2">
                            <SectionLabel id="lr-doc-connects">{labels.connects}</SectionLabel>
                            {source.goalConnection.trim() ? (
                                <p className={narrativeBodyClass}>{source.goalConnection.trim()}</p>
                            ) : (
                                <div className="text-[14px] leading-[1.6] text-muted-foreground">
                                    <EmptySlot
                                        fallback={
                                            <PlaceholderText>Add your answer on the left</PlaceholderText>
                                        }
                                        skeleton={<SkeletonLines count={3} />}
                                    />
                                </div>
                            )}
                        </section>
                    ) : null}

                    {showAdvice ? (
                        !isRecord ? (
                            <section
                                aria-labelledby="lr-doc-advice"
                                className="break-inside-avoid space-y-2 border-t border-border pt-5"
                            >
                                <SectionLabel id="lr-doc-advice">
                                    {DOCUMENT_PREVIEW_LABELS.advice}
                                </SectionLabel>
                                {source.adviceToPeer.trim() ? (
                                    <blockquote className="m-0 border-none p-0 text-[14px] font-normal italic leading-[1.6] text-muted-foreground">
                                        {source.adviceToPeer.trim()}
                                    </blockquote>
                                ) : (
                                    <div className="text-[14px] leading-[1.6] text-muted-foreground">
                                        <EmptySlot
                                            fallback={
                                                <PlaceholderText>
                                                    Add your answer on the left
                                                </PlaceholderText>
                                            }
                                            skeleton={<SkeletonLines count={3} />}
                                        />
                                    </div>
                                )}
                            </section>
                        ) : source.adviceToPeer.trim() || skeletonEmpty ? (
                            <footer className="break-inside-avoid pt-1">
                                {source.adviceToPeer.trim() ? (
                                    <blockquote className="m-0 border-none p-0 text-[14px] font-normal italic leading-[1.6] text-muted-foreground">
                                        &ldquo;{source.adviceToPeer.trim()}&rdquo;
                                    </blockquote>
                                ) : (
                                    <div className="text-[14px] leading-[1.6] text-muted-foreground">
                                        <EmptySlot
                                            fallback={
                                                <PlaceholderText>
                                                    Add your answer on the left
                                                </PlaceholderText>
                                            }
                                            skeleton={<SkeletonLines count={2} />}
                                        />
                                    </div>
                                )}
                            </footer>
                        ) : null
                    ) : null}

                    {state === 'partial' &&
                    answered < totalSlots &&
                    !emptyPh &&
                    !skeletonEmpty &&
                    !isRecord &&
                    !filledSectionsOnly ? (
                        <div className="print:hidden space-y-2 break-inside-avoid text-sm text-muted-foreground">
                            <p>More reflections will appear as you answer.</p>
                            <SkeletonLines count={2} />
                        </div>
                    ) : null}
                </>
            ) : null}
        </div>
    );
}
