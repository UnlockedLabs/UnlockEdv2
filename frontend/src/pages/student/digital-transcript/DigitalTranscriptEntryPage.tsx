import { useCallback, useRef, useState } from 'react';
import { createPortal, flushSync } from 'react-dom';
import { Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/useAuth';
import { ConfirmDialog } from '@/components/shared';
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
    type FunnelToolbarHandlers
} from './DigitalTranscriptWysiwygEntry';
import { DigitalTranscriptBackLink, DigitalTranscriptShell, dtPageSurface } from './DigitalTranscriptShell';
import { LearningRecordExportContent } from './LearningRecordExportContent';
import { learningRecordResidentDisplayName } from './learningRecordResidentName';
import { readLearningRecordExportRows } from './transcriptEntrySessionStorage';
import type { TranscriptEntry } from '@/types/digital-transcript';

const digitalTranscriptBackLinkClassName =
    'group inline-flex items-center gap-1.5 text-sm font-medium text-primary transition-colors hover:text-primary/80';

export default function DigitalTranscriptEntryPage() {
    const navigate = useNavigate();
    const { pathname } = useLocation();
    const base = getDigitalTranscriptBasePath(pathname);
    setDigitalTranscriptStorageContext(base);
    const formVariant = getLearningRecordFormVariant(pathname);
    const isFunnel = formVariant === 'funnel';
    const funnelToolbarRef = useRef<FunnelToolbarHandlers | null>(null);
    const { hydrated, upsertCommittedEntry, deleteCommittedEntry, entries } = useTranscriptDraft();
    const { user } = useAuth();
    const residentName = learningRecordResidentDisplayName(user);
    const [exportRows, setExportRows] = useState<TranscriptEntry[]>(() =>
        readLearningRecordExportRows()
    );
    const [isExporting, setIsExporting] = useState(false);
    const [exportActive, setExportActive] = useState(false);
    const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
    const exportRootRef = useRef<HTMLDivElement>(null);
    const liveExportRowsRef = useRef(exportRows);
    liveExportRowsRef.current = exportRows;

    const canDownload = exportRows.length > 0 && !isExporting;

    const handleExportRowsChange = useCallback((rows: TranscriptEntry[]) => {
        setExportRows(rows);
    }, []);

    const handleRegisterFunnelToolbar = useCallback((handlers: FunnelToolbarHandlers) => {
        funnelToolbarRef.current = handlers;
    }, []);

    const navigateHome = useCallback(() => {
        navigate(base);
    }, [navigate, base]);

    const requestLeave = useCallback(() => {
        if (!isFunnel) {
            navigateHome();
            return;
        }
        if (funnelToolbarRef.current?.hasUnsavedChanges()) {
            setLeaveConfirmOpen(true);
            return;
        }
        navigateHome();
    }, [isFunnel, navigateHome]);

    const handleConfirmLeave = useCallback(() => {
        setLeaveConfirmOpen(false);
        funnelToolbarRef.current?.cancel();
        navigateHome();
    }, [navigateHome]);

    const handleSave = useCallback(() => {
        const saved = funnelToolbarRef.current?.save() ?? false;
        if (saved) navigateHome();
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
                        <button
                            type="button"
                            data-slot="digital-transcript-back"
                            className={digitalTranscriptBackLinkClassName}
                            onClick={requestLeave}
                        >
                            <span
                                className="inline-block transition-transform group-hover:-translate-x-0.5"
                                aria-hidden
                            >
                                ←
                            </span>
                            Back
                        </button>
                    ) : (
                        <DigitalTranscriptBackLink to={base}>Back</DigitalTranscriptBackLink>
                    )}
                    <div className="flex items-center gap-2">
                        {isFunnel ? (
                            <>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    data-slot="digital-transcript-cancel"
                                    className="bg-background"
                                    onClick={requestLeave}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="button"
                                    size="sm"
                                    data-slot="digital-transcript-save"
                                    className="bg-[#556830] text-white hover:bg-[#203622]"
                                    onClick={handleSave}
                                >
                                    Save changes
                                </Button>
                            </>
                        ) : null}
                        {!isFunnel ? (
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                data-slot="digital-transcript-download"
                                className="gap-1.5 bg-background"
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
                        onRegisterFunnelToolbar={
                            isFunnel ? handleRegisterFunnelToolbar : undefined
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
            {isFunnel ? (
                <ConfirmDialog
                    open={leaveConfirmOpen}
                    onOpenChange={setLeaveConfirmOpen}
                    title="Leave without saving?"
                    description="Your changes haven't been saved yet. If you leave now, they won't be added to your record."
                    confirmLabel="Leave"
                    cancelLabel="Keep editing"
                    variant="destructive"
                    onConfirm={handleConfirmLeave}
                />
            ) : null}
        </div>
    );
}
