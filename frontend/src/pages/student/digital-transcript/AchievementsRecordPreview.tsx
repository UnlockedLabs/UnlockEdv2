import { useLayoutEffect, useMemo, useRef } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { useAuth } from '@/auth/useAuth';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { TranscriptEntry } from '@/types/digital-transcript';
import { sortEntriesNewestFirst } from './transcriptEntrySessionStorage';
import { LearningRecordExportContent } from './LearningRecordExportContent';
import { learningRecordOutlineButtonClassName, LEARNING_RECORD_BUTTON_SIZE } from './learningRecordButtons';
import { learningRecordResidentDisplayName } from './learningRecordResidentName';

export interface FunnelDownloadProps {
    onDownload: () => void;
    canDownload: boolean;
    isExporting: boolean;
}

interface AchievementsRecordPreviewProps {
    rows: TranscriptEntry[];
    anchorId: string | null;
    variant?: 'default' | 'funnel';
    funnelDownload?: FunnelDownloadProps;
}

export function AchievementsRecordPreview({
    rows,
    anchorId,
    variant = 'default',
    funnelDownload
}: AchievementsRecordPreviewProps) {
    const { user } = useAuth();
    const residentName = learningRecordResidentDisplayName(user);
    const docRows = useMemo(() => sortEntriesNewestFirst(rows), [rows]);
    const scrollRef = useRef<HTMLDivElement>(null);

    useLayoutEffect(() => {
        if (!anchorId || !scrollRef.current) return;
        const block = scrollRef.current.querySelector<HTMLElement>(
            `[data-achievement-id="${anchorId}"]`
        );
        block?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, [anchorId, docRows.length]);

    const isFunnel = variant === 'funnel';

    const previewContent = (
        <LearningRecordExportContent
            rows={docRows}
            residentName={residentName}
            anchorId={anchorId}
            hidePreviewHeader={isFunnel}
            embeddedLivePreview={isFunnel}
            documentVariant={isFunnel ? 'funnel' : 'default'}
        />
    );

    if (isFunnel) {
        return (
            <Card
                data-slot="transcript-wysiwyg-preview-pane"
                aria-label="Live preview"
                className="flex h-full min-h-0 min-w-0 flex-col gap-4 overflow-hidden p-4 max-[899px]:min-h-0"
            >
                {funnelDownload ? (
                    <div className="shrink-0">
                        <Button
                            type="button"
                            variant="outline"
                            size={LEARNING_RECORD_BUTTON_SIZE}
                            data-slot="digital-transcript-download"
                            className={learningRecordOutlineButtonClassName}
                            disabled={!funnelDownload.canDownload}
                            aria-busy={funnelDownload.isExporting}
                            onClick={funnelDownload.onDownload}
                        >
                            {funnelDownload.isExporting ? (
                                <Loader2 className="size-4 animate-spin" aria-hidden />
                            ) : (
                                <Download className="size-4" aria-hidden />
                            )}
                            {funnelDownload.isExporting
                                ? 'Downloading…'
                                : 'Download achievement as PDF'}
                        </Button>
                    </div>
                ) : null}
                <div
                    ref={scrollRef}
                    data-slot="achievements-record-preview-scroll"
                    className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
                >
                    {previewContent}
                </div>
            </Card>
        );
    }

    return (
        <div
            data-slot="achievements-record-preview"
            className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-muted/30"
        >
            <div
                ref={scrollRef}
                data-slot="achievements-record-preview-scroll"
                className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
            >
                {previewContent}
            </div>
        </div>
    );
}
