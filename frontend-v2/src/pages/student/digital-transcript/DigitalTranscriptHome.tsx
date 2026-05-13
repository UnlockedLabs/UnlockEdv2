import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useTranscriptDraft } from '@/hooks/useTranscriptDraft';
import { getDigitalTranscriptBasePath, getDigitalTranscriptVariant } from './digitalTranscriptRoutes';
import {
    DigitalTranscriptEyebrow,
    DigitalTranscriptPageTitle,
    DigitalTranscriptShell,
    dtTitle
} from './DigitalTranscriptShell';
import { TranscriptResumePreview } from './TranscriptResumePreview';

export default function DigitalTranscriptHome() {
    const navigate = useNavigate();
    const { pathname } = useLocation();
    const base = getDigitalTranscriptBasePath(pathname);
    const variant = getDigitalTranscriptVariant(pathname);
    const isA = variant === 'a';
    const entryPath = `${base}/entry`;
    const { entries, hydrated, hasDraft, startFreshDraft } = useTranscriptDraft({ variant });
    const [confirmNewOpen, setConfirmNewOpen] = useState(false);

    if (!hydrated) {
        return (
            <DigitalTranscriptShell>
                <div className="flex min-h-[12rem] flex-col items-center justify-center gap-3 text-muted-foreground">
                    <div
                        className="size-8 rounded-full border-2 border-[#556830]/25 border-t-[#556830] animate-spin dark:border-primary/25 dark:border-t-primary"
                        aria-hidden
                    />
                    <p className="text-sm font-medium">Loading your record…</p>
                </div>
            </DigitalTranscriptShell>
        );
    }

    function handleStartNewClick() {
        if (hasDraft) setConfirmNewOpen(true);
        else navigate(entryPath);
    }

    function confirmStartFresh() {
        startFreshDraft();
        setConfirmNewOpen(false);
        navigate(entryPath);
    }

    const variantLabel = isA ? 'Build your achievements résumé' : 'Learning Record B';

    const primaryCtaLabel = isA
        ? hasDraft
            ? 'Start over'
            : entries.length === 0
              ? 'Start logging'
              : 'Add achievement'
        : hasDraft
          ? 'Start over'
          : 'Begin guided entry';

    const cardTitle = isA
        ? entries.length === 0 && !hasDraft
            ? 'Start logging'
            : 'Add achievement'
        : 'Add an achievement';

    return (
        <DigitalTranscriptShell variant="wide">
            <header className="mb-8">
                <DigitalTranscriptPageTitle>{variantLabel}</DigitalTranscriptPageTitle>
                <p className="max-w-prose text-pretty text-base leading-relaxed text-muted-foreground">
                    {isA ? (
                        <>
                            Build your transcript-style record right on the page—it saves as you go. Tap{' '}
                            <span className="font-medium text-foreground">Done</span> when one achievement feels
                            complete. For now, everything stays on this device.
                        </>
                    ) : (
                        <>
                            Capture what you achieved in your own words. A short guided flow, then a
                            preview—nothing is final until you accept it. For now, everything stays on this
                            device.
                        </>
                    )}
                </p>
            </header>

            <Card className="mt-10 overflow-hidden border-gray-200 bg-white shadow-sm dark:border-border dark:bg-card">
                <CardHeader className="space-y-1 border-b border-gray-100 bg-muted/50 pb-5 dark:border-border">
                    <CardTitle className={`text-lg font-semibold ${dtTitle}`}>{cardTitle}</CardTitle>
                    <CardDescription className="text-base leading-relaxed">
                        {hasDraft ? (
                            isA ? (
                                <>
                                    You have work in progress in the editor. Continue where you left off, or
                                    start fresh.
                                </>
                            ) : (
                                <>
                                    You have a draft in progress. Pick up where you left off, or start fresh.
                                </>
                            )
                        ) : isA ? (
                            entries.length === 0 ? (
                                <>
                                    Open the editor and fill in what you did. Nothing appears on this list until
                                    you tap Done.
                                </>
                            ) : (
                                <>
                                    You have saved {entries.length}{' '}
                                    {entries.length === 1 ? 'achievement' : 'achievements'}. Add another anytime.
                                </>
                            )
                        ) : (
                            'Finished a program or milestone? Log it while the details are still fresh.'
                        )}
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:flex-wrap">
                    {hasDraft && (
                        <Button asChild size="lg" className="sm:min-w-[11rem]">
                            <Link to={entryPath}>Continue draft</Link>
                        </Button>
                    )}
                    <Button
                        variant={hasDraft ? 'outline' : 'default'}
                        size="lg"
                        onClick={handleStartNewClick}
                        className="sm:min-w-[11rem]"
                    >
                        {primaryCtaLabel}
                    </Button>
                </CardContent>
            </Card>

            <section className="mt-14 space-y-6">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <DigitalTranscriptEyebrow>Saved entries</DigitalTranscriptEyebrow>
                        <h2 className={`mt-1 text-xl font-semibold tracking-tight ${dtTitle}`}>
                            On this device
                        </h2>
                    </div>
                    {entries.length > 0 && (
                        <p className="text-sm text-muted-foreground">
                            {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
                        </p>
                    )}
                </div>

                <Separator className="bg-gray-200 dark:bg-border" />

                {entries.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-gray-300 bg-white/60 px-6 py-12 text-center dark:border-border dark:bg-card/40">
                        <p className="mx-auto max-w-md text-sm leading-relaxed text-muted-foreground">
                            {isA ? (
                                <>
                                    Nothing saved yet. When you finish editing and tap{' '}
                                    <span className="font-medium text-foreground">Done</span>, your achievement
                                    appears here.
                                </>
                            ) : (
                                <>
                                    Nothing saved yet. When you finish the questions and tap{' '}
                                    <span className="font-medium text-foreground">Accept and save</span> on the
                                    preview screen, your achievement appears here.
                                </>
                            )}
                        </p>
                    </div>
                ) : (
                    <ul className="space-y-8">
                        {entries.map((entry) => (
                            <li key={entry.id}>
                                <TranscriptResumePreview source={entry} />
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            <AlertDialog open={confirmNewOpen} onOpenChange={setConfirmNewOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Start a new draft?</AlertDialogTitle>
                        <AlertDialogDescription>
                            {isA ? (
                                <>
                                    Your current in-progress text in the editor will be cleared. Entries you
                                    already saved stay on this list.
                                </>
                            ) : (
                                <>
                                    Your current in-progress answers will be cleared. Entries you already saved
                                    stay on this list.
                                </>
                            )}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmStartFresh}>Clear draft and start</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </DigitalTranscriptShell>
    );
}
