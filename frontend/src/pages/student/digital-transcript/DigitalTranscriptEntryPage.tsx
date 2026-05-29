import { useCallback, useRef, useState } from 'react';
import { createPortal, flushSync } from 'react-dom';
import { Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/useAuth';
import { Button } from '@/components/ui/button';
import { useTranscriptDraft } from '@/hooks/useTranscriptDraft';
import { cn } from '@/lib/utils';
import {
    downloadLearningRecordPdf,
    learningRecordPdfFilename
} from '@/utils/downloadLearningRecordPdf';
import { getDigitalTranscriptBasePath, setDigitalTranscriptStorageContext } from './digitalTranscriptRoutes';
import { getLearningRecordFormVariant } from './learningRecordPrototypes';
import {
    DigitalTranscriptWysiwygEntry,
    type AutoSaveStatus,
    type FunnelAutoSaveState,
    type FunnelFinishHandlers
} from './DigitalTranscriptWysiwygEntry';
import { DigitalTranscriptBackLink, DigitalTranscriptShell, dtPageSurface } from './DigitalTranscriptShell';
import { LearningRecordExportContent } from './LearningRecordExportContent';
import { learningRecordOutlineButtonClassName, LEARNING_RECORD_BUTTON_SIZE } from './learningRecordButtons';
import { learningRecordResidentDisplayName } from './learningRecordResidentName';
import { readLearningRecordExportRows } from './transcriptEntrySessionStorage';
import type { TranscriptEntry } from '@/types/digital-transcript';

function formatSavedTime(date: Date): string {
    return date.toLocaleTimeString(undefined, {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });
}

function AutoSaveLabel({
    status,
    lastSavedAt
}: {
    status: AutoSaveStatus;
    lastSavedAt: Date | null;
}) {
    if (status === 'pending' || status === 'saving') {
        return (
            <span
                data-slot="digital-transcript-autosave-status"
                className="text-sm text-muted-foreground"
                aria-live="polite"
            >
                Saving…
            </span>
        );
    }

    if (status === 'error') {
        return (
            <span
                data-slot="digital-transcript-autosave-status"
                className="text-sm text-destructive"
                aria-live="polite"
            >
                Failed to save
            </span>
        );
    }

    if (status === 'saved' && lastSavedAt) {
        return (
            <span
                data-slot="digital-transcript-autosave-status"
                className="text-sm text-muted-foreground"
                aria-live="polite"
            >
                Saved {formatSavedTime(lastSavedAt)}
            </span>
        );
    }

    return null;
}

export default function DigitalTranscriptEntryPage() {
    const navigate = useNavigate();
    const { pathname } = useLocation();
    const base = getDigitalTranscriptBasePath(pathname);
    setDigitalTranscriptStorageContext(base);
    const formVariant = getLearningRecordFormVariant(pathname);
    const isFunnel = formVariant === 'funnel';
    const funnelFinishRef = useRef<FunnelFinishHandlers | null>(null);
    const { hydrated, upsertCommittedEntry, deleteCommittedEntry, entries } = useTranscriptDraft();
    const { user } = useAuth();
    const residentName = learningRecordResidentDisplayName(user);
    const [exportRows, setExportRows] = useState<TranscriptEntry[]>(() =>
        readLearningRecordExportRows()
    );
    const [isExporting, setIsExporting] = useState(false);
    const [exportActive, setExportActive] = useState(false);
    const [autoSaveStatus, setAutoSaveStatus] = useState<AutoSaveStatus>('idle');
    const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
    const exportRootRef = useRef<HTMLDivElement>(null);
    const liveExportRowsRef = useRef(exportRows);
    liveExportRowsRef.current = exportRows;

    const canDownload = exportRows.length > 0 && !isExporting;

    const handleExportRowsChange = useCallback((rows: TranscriptEntry[]) => {
        setExportRows(rows);
    }, []);

    const handleRegisterFunnelFinish = useCallback((handlers: FunnelFinishHandlers) => {
        funnelFinishRef.current = handlers;
    }, []);

    const handleFunnelAutoSaveStatusChange = useCallback((state: FunnelAutoSaveState) => {
        setAutoSaveStatus(state.status);
        setLastSavedAt(state.lastSavedAt);
    }, []);

    const navigateHome = useCallback(() => {
        navigate(base);
    }, [navigate, base]);

    const handleFinish = useCallback(() => {
        const ok = funnelFinishRef.current?.validateFinishRequirements() ?? false;
        if (ok) navigateHome();
    }, [navigateHome]);

    const handleDownload = useCallback(async () => {
        const rows =
            liveExportRowsRef.current.length > 0
                ? liveExportRowsRef.current
                : readLearningRecordExportRows();
        if (rows.length === 0 || isExporting) return;

        setIsExporting(true);
        flushSync(() => {
            setExportActive(true);
            setExportRows(rows);
        });

        try {
            await new Promise<void>((resolve) => {
                requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
            });

            const root = exportRootRef.current;
            if (!root) {
                throw new Error('Export content not ready');
            }

            await downloadLearningRecordPdf(
                root,
                learningRecordPdfFilename(residentName)
            );
            toast.success('Learning record downloaded');
        } catch (err) {
            console.error('Learning record PDF export failed:', err);
            toast.error('Could not download PDF. Please try again.');
        } finally {
            setExportActive(false);
            setIsExporting(false);
        }
    }, [isExporting, residentName]);

    if (!hydrated) {
        return (
            <DigitalTranscriptShell variant="narrow">
                <div className="flex min-h-[12rem] flex-col items-center justify-center gap-3 text-muted-foreground">
                    <Loader2 className="size-8 animate-spin text-primary" aria-hidden />
                    <p className="text-sm font-medium">Loading your editor…</p>
                </div>
            </DigitalTranscriptShell>
        );
    }

    return (
        <div
            className={cn(
                'flex h-[calc(100dvh-4rem)] min-h-0 min-w-0 flex-1 flex-col overflow-hidden',
                dtPageSurface
            )}
        >
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
                            documentVariant={isFunnel ? 'funnel' : 'default'}
                        />
                    </div>,
                    document.body
                )}
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <div
                    data-slot="digital-transcript-entry-toolbar"
                    className="flex shrink-0 items-center justify-between gap-3 border-b border-border/60 bg-background px-4 py-3 print:hidden"
                >
                    {isFunnel ? (
                        <Button
                            type="button"
                            variant="ghost"
                            size={LEARNING_RECORD_BUTTON_SIZE}
                            data-slot="digital-transcript-back"
                            className="group h-10 gap-1.5 text-primary hover:bg-muted hover:text-primary"
                            onClick={navigateHome}
                        >
                            <span
                                className="inline-block transition-transform group-hover:-translate-x-0.5"
                                aria-hidden
                            >
                                ←
                            </span>
                            Back
                        </Button>
                    ) : (
                        <DigitalTranscriptBackLink to={base}>Back</DigitalTranscriptBackLink>
                    )}
                    <div className="flex items-center gap-2">
                        {isFunnel ? (
                            <AutoSaveLabel status={autoSaveStatus} lastSavedAt={lastSavedAt} />
                        ) : null}
                        {!isFunnel ? (
                            <Button
                                type="button"
                                variant="outline"
                                size={LEARNING_RECORD_BUTTON_SIZE}
                                data-slot="digital-transcript-download"
                                className={learningRecordOutlineButtonClassName}
                                disabled={!canDownload}
                                aria-busy={isExporting}
                                onClick={() => void handleDownload()}
                            >
                                {isExporting ? (
                                    <Loader2 className="size-4 animate-spin" aria-hidden />
                                ) : (
                                    <Download className="size-4" aria-hidden />
                                )}
                                {isExporting ? 'Downloading…' : 'Download'}
                            </Button>
                        ) : null}
                    </div>
                </div>
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                    <DigitalTranscriptWysiwygEntry
                        formVariant={formVariant}
                        hydrated={hydrated}
                        entries={entries}
                        upsertCommittedEntry={upsertCommittedEntry}
                        deleteCommittedEntry={deleteCommittedEntry}
                        onExportRowsChange={handleExportRowsChange}
                        funnelOnFinish={isFunnel ? handleFinish : undefined}
                        onRegisterFunnelFinish={isFunnel ? handleRegisterFunnelFinish : undefined}
                        onFunnelAutoSaveStatusChange={
                            isFunnel ? handleFunnelAutoSaveStatusChange : undefined
                        }
                        funnelDownload={
                            isFunnel
                                ? {
                                      onDownload: () => void handleDownload(),
                                      canDownload,
                                      isExporting
                                  }
                                : undefined
                        }
                    />
                </div>
            </div>
        </div>
    );
}
