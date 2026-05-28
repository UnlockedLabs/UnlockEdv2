import { forwardRef } from 'react';
import { cn } from '@/lib/utils';
import type { TranscriptEntry } from '@/types/digital-transcript';
import { LearningRecordDocument } from './LearningRecordDocument';
import { programsCompletedLabel } from './learningRecordResidentName';

export function LearningRecordPreviewHeader({
    residentName,
    programCount
}: {
    residentName: string;
    programCount: number;
}) {
    return (
        <header
            data-slot="learning-record-preview-header"
            className="mb-6 shrink-0 space-y-1 break-inside-avoid"
        >
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Learning record
            </p>
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">{residentName}</h2>
            <p className="text-sm text-muted-foreground">{programsCompletedLabel(programCount)}</p>
        </header>
    );
}

export interface LearningRecordExportContentProps {
    rows: TranscriptEntry[];
    residentName: string;
    /** Dim non-focused achievements in the live preview */
    anchorId?: string | null;
    className?: string;
    /** PDF: only render sections that have answers (no skeletons or placeholders). */
    filledSectionsOnly?: boolean;
    /** Live funnel preview: header is replaced by the download action in the preview pane. */
    hidePreviewHeader?: boolean;
    /** Funnel live preview: parent card supplies padding and background. */
    embeddedLivePreview?: boolean;
}

export const LearningRecordExportContent = forwardRef<
    HTMLDivElement,
    LearningRecordExportContentProps
>(function LearningRecordExportContent(
    {
        rows,
        residentName,
        anchorId = null,
        className,
        filledSectionsOnly = false,
        hidePreviewHeader = false,
        embeddedLivePreview = false
    },
    ref
) {
    const highlightAnchor = Boolean(anchorId) && !filledSectionsOnly;
    const showPreviewHeader = !hidePreviewHeader;
    const shellClassName = embeddedLivePreview
        ? 'learning-record-pdf-export bg-transparent'
        : 'learning-record-pdf-export learning-record-print-root bg-background px-4 py-5 sm:px-5';

    if (rows.length === 0) {
        return (
            <div
                ref={ref}
                className={cn(
                    shellClassName,
                    !embeddedLivePreview && 'px-5 py-6',
                    className
                )}
            >
                {showPreviewHeader ? (
                    <LearningRecordPreviewHeader residentName={residentName} programCount={0} />
                ) : null}
                <p className="text-sm italic text-muted-foreground">
                    Add an achievement on the left to see your record here.
                </p>
            </div>
        );
    }

    return (
        <div
            ref={ref}
            data-slot="learning-record-export-content"
            className={cn(shellClassName, className)}
        >
            {showPreviewHeader ? (
                <LearningRecordPreviewHeader
                    residentName={residentName}
                    programCount={rows.length}
                />
            ) : null}
            <div className="flex flex-col gap-5 pb-4">
                {rows.map((entry) => (
                    <article
                        key={entry.id}
                        data-achievement-block
                        data-achievement-id={entry.id}
                        className={cn(
                            'break-inside-avoid rounded-lg border border-border/80 bg-card p-5 shadow-none sm:p-6',
                            highlightAnchor &&
                                entry.id !== anchorId &&
                                'opacity-[0.35] transition-opacity duration-300 ease-out'
                        )}
                    >
                        <LearningRecordDocument
                            source={entry}
                            layout="record"
                            showReadiness={false}
                            emptyPreviewVariant={filledSectionsOnly ? 'placeholder' : 'skeleton'}
                            filledSectionsOnly={filledSectionsOnly}
                            className="min-h-0"
                        />
                    </article>
                ))}
            </div>
        </div>
    );
});
