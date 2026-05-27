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
import { DigitalTranscriptWysiwygEntry } from './DigitalTranscriptWysiwygEntry';
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
    const backCommitRef = useRef<(() => void) | null>(null);
    const { hydrated, upsertCommittedEntry, deleteCommittedEntry, entries } = useTranscriptDraft();
    const { user } = useAuth();
    const residentName = learningRecordResidentDisplayName(user);
    const [exportRows, setExportRows] = useState<TranscriptEntry[]>(() =>
        readLearningRecordExportRows()
    );
    const [isExporting, setIsExporting] = useState(false);
    const [exportActive, setExportActive] = useState(false);
    const exportRootRef = useRef<HTMLDivElement>(null);
    const liveExportRowsRef = useRef(exportRows);
    liveExportRowsRef.current = exportRows;

    const canDownload = exportRows.length > 0 && !isExporting;

    const handleExportRowsChange = useCallback((rows: TranscriptEntry[]) => {
        setExportRows(rows);
    }, []);

    const handleRegisterBackCommit = useCallback((commit: () => void) => {
        backCommitRef.current = commit;
    }, []);

    const handleBack = useCallback(() => {
        backCommitRef.current?.();
        navigate(base);
    }, [navigate, base]);

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
            // #region agent log
            fetch('http://127.0.0.1:7605/ingest/222c6233-433f-42b0-8e1b-e79b53b2d8b4',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'55a621'},body:JSON.stringify({sessionId:'55a621',location:'DigitalTranscriptEntryPage.tsx:catch',message:'PDF export error',data:{name:err instanceof Error?err.name:'unknown',msg:err instanceof Error?err.message:String(err)},timestamp:Date.now(),hypothesisId:'H-C'})}).catch(()=>{});
            // #endregion
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
                            onClick={handleBack}
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
                </div>
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                    <DigitalTranscriptWysiwygEntry
                        base={base}
                        formVariant={formVariant}
                        hydrated={hydrated}
                        entries={entries}
                        upsertCommittedEntry={upsertCommittedEntry}
                        deleteCommittedEntry={deleteCommittedEntry}
                        onExportRowsChange={handleExportRowsChange}
                        onRegisterBackCommit={isFunnel ? handleRegisterBackCommit : undefined}
                    />
                </div>
            </div>
        </div>
    );
}
