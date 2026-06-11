import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { TranscriptEntry } from '@/types/digital-transcript';
import { countAnsweredReflections, reflectionSlotsTotal } from './learningRecordDocumentModel';
import { LearningRecordDocument } from './LearningRecordDocument';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

function entryFingerprint(e: TranscriptEntry): string {
    return [
        e.id,
        e.programName,
        e.completionDate,
        e.confidence,
        e.topSkills.join(''),
        e.whatMadeYouFinish,
        e.goalConnection,
        e.pride,
        e.standoutMoment,
        e.adviceToPeer,
        e.oneSentence
    ].join('');
}

/** US Letter height/width for portrait page */
const LETTER_H_PER_W = 11 / 8.5;

interface AchievementPreviewProps {
    previewSource: TranscriptEntry | null;
    /** Shown above the progress bar (e.g. "Currently editing achievement 3") */
    previewHeading: string | null;
    emptyMessage?: string;
}

export function AchievementPreview({
    previewSource,
    previewHeading,
    emptyMessage = 'Expand an achievement on the left to preview it here.'
}: AchievementPreviewProps) {
    const pagesHostRef = useRef<HTMLDivElement>(null);
    const previewContentRef = useRef<HTMLDivElement>(null);
    const [pageHeightPx, setPageHeightPx] = useState(480);
    const [contentHeightPx, setContentHeightPx] = useState(0);

    const answered = previewSource ? countAnsweredReflections(previewSource) : 0;
    const totalSlots = reflectionSlotsTotal();
    const readinessPct = Math.round((answered / Math.max(1, totalSlots)) * 100);

    const measureKey = previewSource ? entryFingerprint(previewSource) : 'empty';

    useLayoutEffect(() => {
        function measure() {
            const hostEl = pagesHostRef.current;
            const contentEl = previewContentRef.current;
            if (!hostEl) return;
            const w = hostEl.clientWidth;
            if (w < 48) return;
            const letterH = w * LETTER_H_PER_W;
            const maxH = hostEl.clientHeight;
            const h = Math.max(220, Math.floor(Math.min(letterH, maxH)));
            setPageHeightPx(h);
            if (contentEl) {
                setContentHeightPx(contentEl.offsetHeight);
            }
        }

        measure();
        const ro = new ResizeObserver(() => {
            measure();
            const c = previewContentRef.current;
            if (c) setContentHeightPx(c.offsetHeight);
        });
        const hostEl = pagesHostRef.current;
        const contentEl = previewContentRef.current;
        if (hostEl) ro.observe(hostEl);
        if (contentEl) ro.observe(contentEl);
        return () => ro.disconnect();
    }, [measureKey]);

    const totalPages = useMemo(
        () => Math.max(1, Math.ceil(contentHeightPx / Math.max(1, pageHeightPx))),
        [contentHeightPx, pageHeightPx]
    );

    if (!previewSource || !previewHeading) {
        return (
            <div
                data-slot="achievement-preview"
                className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background px-4 pt-4 pb-3"
            >
                <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 text-center">
                    <p className="text-sm italic text-muted-foreground">{emptyMessage}</p>
                </div>
            </div>
        );
    }

    return (
        <div
            data-slot="achievement-preview"
            className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background px-4 pt-4 pb-3"
        >
            <p className="shrink-0 text-sm font-medium text-foreground">{previewHeading}</p>
            <div className="mt-2 mb-3 shrink-0">
                <div className="mb-1 flex items-baseline justify-between gap-2 text-xs text-muted-foreground">
                    <span>Reflections answered</span>
                    <span className="tabular-nums">
                        {answered} of {totalSlots}
                    </span>
                </div>
                <div
                    className="h-1 overflow-hidden rounded-full bg-muted"
                    role="img"
                    aria-label={`${answered} of ${totalSlots} reflections answered`}
                >
                    <div
                        className="h-full rounded-full bg-primary/45 transition-[width] duration-200 dark:bg-primary/50"
                        style={{ width: `${readinessPct}%` }}
                    />
                </div>
            </div>

            <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
                <div
                    ref={pagesHostRef}
                    className="flex min-h-0 flex-1 flex-col items-center justify-start gap-3 overflow-y-auto overscroll-contain pb-2"
                >
                    <div
                        ref={previewContentRef}
                        className="flex w-full max-w-[min(100%,min(42rem,90vw))] shrink-0 flex-col"
                    >
                        <LearningRecordDocument
                            source={previewSource}
                            showReadiness={false}
                            emptyPreviewVariant="skeleton"
                            className="min-h-0"
                        />
                    </div>
                    {totalPages > 1
                        ? Array.from({ length: totalPages - 1 }, (_, i) => (
                              <div
                                  key={`letter-blank-${i}`}
                                  className="box-border w-full max-w-[min(100%,min(42rem,90vw))] shrink-0 rounded-md border border-border bg-background p-3 shadow-sm"
                                  style={{ minHeight: pageHeightPx }}
                                  aria-hidden
                              />
                          ))
                        : null}
                </div>

                <div
                    role="status"
                    aria-live="polite"
                    aria-atomic="true"
                    data-slot="transcript-page-indicator"
                    className={cn(
                        buttonVariants({ variant: 'secondary', size: 'sm' }),
                        'print:hidden pointer-events-none absolute bottom-3 right-3 z-30 h-9 min-w-[4.5rem] rounded-full border border-border/80 bg-background/90 text-[11px] font-medium tabular-nums shadow-lg ring-1 ring-black/5 backdrop-blur-sm dark:bg-card/90 dark:ring-white/10'
                    )}
                >
                    {totalPages} / {totalPages}
                </div>
            </div>
        </div>
    );
}
