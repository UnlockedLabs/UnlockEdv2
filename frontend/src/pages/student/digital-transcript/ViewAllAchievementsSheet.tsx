import { useCallback, useRef, useState } from 'react';
import { createPortal, flushSync } from 'react-dom';
import { Download, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    Sheet,
    SheetClose,
    SheetContent,
    SheetTitle
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import {
    downloadAllLearningRecordAchievementsPdf,
    learningRecordPdfFilename
} from '@/utils/downloadLearningRecordPdf';
import type { TranscriptEntry } from '@/types/digital-transcript';
import { LearningRecordExportContent } from './LearningRecordExportContent';
import { PrintShareHelpLink } from '@/components/learning-record/PrintShareHelpLink';
import {
    LEARNING_RECORD_BUTTON_SIZE,
    learningRecordOutlineButtonClassName
} from './learningRecordButtons';

export interface ViewAllAchievementsSheetProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    entries: TranscriptEntry[];
    residentName: string;
    documentVariant?: 'funnel' | 'default';
    embeddedLivePreview?: boolean;
}

export function ViewAllAchievementsSheet({
    open,
    onOpenChange,
    entries,
    residentName,
    documentVariant = 'funnel',
    embeddedLivePreview = documentVariant === 'funnel'
}: ViewAllAchievementsSheetProps) {
    const [exportRows, setExportRows] = useState<TranscriptEntry[]>([]);
    const [exportActive, setExportActive] = useState(false);
    const [isDownloadingAll, setIsDownloadingAll] = useState(false);
    const exportRootRef = useRef<HTMLDivElement>(null);
    const entriesRef = useRef(entries);
    entriesRef.current = entries;

    const waitForExportPaint = useCallback(async () => {
        await new Promise<void>((resolve) => {
            requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
        });
    }, []);

    const handleDownloadAll = useCallback(async () => {
        const entriesToExport = entriesRef.current;
        if (entriesToExport.length === 0 || isDownloadingAll) return;

        setIsDownloadingAll(true);
        let exportIndex = 0;

        flushSync(() => {
            setExportActive(true);
        });

        try {
            await downloadAllLearningRecordAchievementsPdf(
                async () => {
                    const entry = entriesToExport[exportIndex];
                    if (!entry) {
                        throw new Error('Export entry not found');
                    }
                    exportIndex += 1;
                    flushSync(() => {
                        setExportRows([entry]);
                    });
                    await waitForExportPaint();
                    const root = exportRootRef.current;
                    if (!root) {
                        throw new Error('Export content not ready');
                    }
                    return root;
                },
                entriesToExport.length,
                learningRecordPdfFilename(residentName)
            );
            toast.success('Your record was saved as a PDF');
        } catch {
            toast.error('Could not save PDF. Please try again.');
        } finally {
            setExportActive(false);
            setExportRows([]);
            setIsDownloadingAll(false);
        }
    }, [isDownloadingAll, residentName, waitForExportPaint]);

    return (
        <>
            {exportActive &&
                createPortal(
                    <div
                        data-slot="learning-record-pdf-capture"
                        aria-hidden
                        className="pointer-events-none fixed top-0 left-0 w-[8.5in] max-w-[816px] overflow-visible bg-background"
                        style={{ zIndex: -1, clipPath: 'inset(50%)' }}
                    >
                        <LearningRecordExportContent
                            ref={exportRootRef}
                            rows={exportRows}
                            residentName={residentName}
                            filledSectionsOnly
                            documentVariant={documentVariant}
                        />
                    </div>,
                    document.body
                )}
            <Sheet open={open} onOpenChange={onOpenChange}>
                <SheetContent
                    side="right"
                    className="flex h-full w-full flex-col gap-0 p-0 sm:max-w-none lg:w-[600px] lg:max-w-[600px] [&>button.absolute]:hidden"
                >
                    <div className="shrink-0 border-b border-border/60 bg-background px-6 pt-6 pb-4">
                        <div className="flex items-center justify-between gap-3">
                            <SheetTitle className="text-lg font-semibold tracking-tight">
                                Save your record as PDF
                            </SheetTitle>
                            <SheetClose
                                className="rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:outline-none"
                                aria-label="Close panel"
                            >
                                <X className="size-4" aria-hidden />
                            </SheetClose>
                        </div>
                        <div className="mt-3 flex flex-row items-center gap-4">
                            <Button
                                type="button"
                                variant="outline"
                                size={LEARNING_RECORD_BUTTON_SIZE}
                                className={cn(
                                    learningRecordOutlineButtonClassName,
                                    'px-4 has-[>svg]:px-4'
                                )}
                                disabled={
                                    entries.length === 0 || isDownloadingAll
                                }
                                aria-busy={isDownloadingAll}
                                onClick={() => void handleDownloadAll()}
                            >
                                {isDownloadingAll ? (
                                    <Loader2
                                        className="size-4 animate-spin"
                                        aria-hidden
                                    />
                                ) : (
                                    <Download className="size-4" aria-hidden />
                                )}
                                {isDownloadingAll
                                    ? 'Saving…'
                                    : 'Save all achievements as a PDF'}
                            </Button>
                            <PrintShareHelpLink className="h-10 shrink-0" />
                        </div>
                    </div>
                    <ScrollArea className="min-h-0 flex-1">
                        <div className="px-6 py-4">
                            {entries.map((entry, index) => (
                                <div
                                    key={entry.id}
                                    className={cn(index > 0 && 'mt-3')}
                                >
                                    <LearningRecordExportContent
                                        rows={[entry]}
                                        residentName={residentName}
                                        filledSectionsOnly={false}
                                        hidePreviewHeader
                                        embeddedLivePreview={
                                            embeddedLivePreview
                                        }
                                        documentVariant={documentVariant}
                                    />
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                </SheetContent>
            </Sheet>
        </>
    );
}
