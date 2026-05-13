import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { useTranscriptDraft } from '@/hooks/useTranscriptDraft';
import { TRANSCRIPT_STEP_COUNT } from '@/types/digital-transcript';
import { getDigitalTranscriptBasePath, getDigitalTranscriptVariant } from './digitalTranscriptRoutes';
import { DigitalTranscriptWysiwygEntry } from './DigitalTranscriptWysiwygEntry';
import {
    DigitalTranscriptBackLink,
    DigitalTranscriptEyebrow,
    DigitalTranscriptPageTitle,
    DigitalTranscriptShell,
    dtAccentSoft,
    dtTitle
} from './DigitalTranscriptShell';
import { TranscriptResumePreview } from './TranscriptResumePreview';
import {
    FIRST_SKIPPABLE_STEP_INDEX,
    getSkipPatchForStep,
    validateTranscriptStep
} from './transcriptSurveyValidation';

const STEP_FOCUS: Record<number, string> = {
    0: 'Program details',
    1: 'How you feel',
    2: 'Your summary',
    3: 'What you gained',
    4: 'Looking forward',
    5: 'What matters to you',
    6: 'Standout moment',
    7: 'Advice for others'
};

export default function DigitalTranscriptEntryPage() {
    const navigate = useNavigate();
    const { pathname } = useLocation();
    const base = getDigitalTranscriptBasePath(pathname);
    const variant = getDigitalTranscriptVariant(pathname);
    const {
        draft,
        hydrated,
        updateDraft,
        ensureDraft,
        goToPreview,
        goToSurveyFromPreview,
        completeEntry,
        persistDraftNow
    } = useTranscriptDraft({ variant });
    const [stepError, setStepError] = useState(false);

    useEffect(() => {
        if (!hydrated) return;
        if (!draft) ensureDraft();
    }, [hydrated, draft, ensureDraft]);

    if (!hydrated || !draft) {
        return (
            <DigitalTranscriptShell variant="narrow">
                <div className="flex min-h-[12rem] flex-col items-center justify-center gap-3 text-muted-foreground">
                    <div
                        className="size-8 rounded-full border-2 border-[#556830]/25 border-t-[#556830] animate-spin dark:border-primary/25 dark:border-t-primary"
                        aria-hidden
                    />
                    <p className="text-sm font-medium">
                        {variant === 'a' ? 'Loading your editor…' : 'Preparing your questions…'}
                    </p>
                </div>
            </DigitalTranscriptShell>
        );
    }

    if (variant === 'a') {
        return (
            <DigitalTranscriptWysiwygEntry
                base={base}
                draft={draft}
                updateDraft={updateDraft}
                persistDraftNow={persistDraftNow}
                completeEntry={completeEntry}
            />
        );
    }

    const d = draft;
    const progressValue = ((d.stepIndex + 1) / TRANSCRIPT_STEP_COUNT) * 100;

    function handleNext() {
        if (!validateTranscriptStep(d.stepIndex, d)) {
            setStepError(true);
            return;
        }
        setStepError(false);
        if (d.stepIndex < TRANSCRIPT_STEP_COUNT - 1) {
            updateDraft({ stepIndex: d.stepIndex + 1 });
        } else {
            goToPreview();
        }
    }

    function handleBack() {
        setStepError(false);
        if (d.stepIndex > 0) {
            updateDraft({ stepIndex: d.stepIndex - 1 });
        }
    }

    const canSkipCurrentStep =
        d.stepIndex >= FIRST_SKIPPABLE_STEP_INDEX && d.stepIndex <= TRANSCRIPT_STEP_COUNT - 1;

    function handleSkipQuestion() {
        const patch = getSkipPatchForStep(d.stepIndex);
        if (!patch) return;
        setStepError(false);
        if (d.stepIndex < TRANSCRIPT_STEP_COUNT - 1) {
            updateDraft({ ...patch, stepIndex: d.stepIndex + 1 });
        } else {
            updateDraft({ ...patch, uiPhase: 'preview' });
        }
    }

    function handleAccept() {
        persistDraftNow();
        completeEntry(d);
        navigate(base);
    }

    if (d.uiPhase === 'preview') {
        return (
            <DigitalTranscriptShell variant="wide">
                <DigitalTranscriptBackLink to={base}>Back</DigitalTranscriptBackLink>

                <header className="mt-10 space-y-3">
                    <DigitalTranscriptEyebrow>Review</DigitalTranscriptEyebrow>
                    <DigitalTranscriptPageTitle>Your preview</DigitalTranscriptPageTitle>
                    <p className="max-w-prose text-pretty text-base leading-relaxed text-muted-foreground">
                        This is how your answers read together—like a short record you could show someone.
                        Edit anything that does not sound like you, then save when it feels right.
                    </p>
                </header>

                <div className="mt-10">
                    <TranscriptResumePreview source={d} />
                </div>

                <div className="mt-12 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end sm:gap-4">
                    <Button type="button" variant="outline" size="lg" onClick={goToSurveyFromPreview}>
                        Back to edit
                    </Button>
                    <Button type="button" size="lg" onClick={handleAccept}>
                        Accept and save
                    </Button>
                </div>
            </DigitalTranscriptShell>
        );
    }

    return (
        <DigitalTranscriptShell variant="narrow">
            <DigitalTranscriptBackLink to={base}>Back</DigitalTranscriptBackLink>

            <header className="mt-8 space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                    <DigitalTranscriptEyebrow>Guided entry</DigitalTranscriptEyebrow>
                    <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${dtAccentSoft} text-[#556830] dark:text-primary`}
                    >
                        {STEP_FOCUS[d.stepIndex] ?? 'Question'}
                    </span>
                </div>
                <DigitalTranscriptPageTitle>Log a program achievement</DigitalTranscriptPageTitle>
            </header>

            <Card className="mt-8 overflow-hidden border-gray-200 bg-white shadow-sm dark:border-border dark:bg-card">
                <div className="space-y-2 border-b border-gray-100 bg-muted/40 px-5 py-4 dark:border-border sm:px-6">
                    <div className="flex items-center justify-between gap-4 text-xs font-medium text-muted-foreground">
                        <span>
                            Step {d.stepIndex + 1} of {TRANSCRIPT_STEP_COUNT}
                        </span>
                        <span className="hidden sm:inline">Saves as you go</span>
                    </div>
                    <Progress
                        value={progressValue}
                        className="h-1.5"
                        indicatorClassName="bg-[#556830] dark:bg-primary"
                    />
                </div>

                <CardContent className="space-y-6 px-5 py-8 sm:px-7">
                    {d.stepIndex === 0 && (
                        <div className="space-y-6">
                            <p className="text-base leading-relaxed text-muted-foreground">
                                Start with the basics. You can change these later until you accept the final
                                preview.
                            </p>
                            <div className="space-y-2">
                                <Label htmlFor="programName" className={`text-sm font-medium ${dtTitle}`}>
                                    Program or course name
                                </Label>
                                <Input
                                    id="programName"
                                    data-slot="transcript-program-name"
                                    value={d.programName}
                                    onChange={(e) => updateDraft({ programName: e.target.value })}
                                    placeholder="e.g. GED prep, welding fundamentals"
                                    className="border-gray-200 bg-white text-base dark:border-input dark:bg-background"
                                    aria-invalid={stepError && !d.programName.trim()}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="completionDate" className={`text-sm font-medium ${dtTitle}`}>
                                    Completion date
                                </Label>
                                <Input
                                    id="completionDate"
                                    type="date"
                                    data-slot="transcript-completion-date"
                                    value={d.completionDate}
                                    onChange={(e) => updateDraft({ completionDate: e.target.value })}
                                    className="border-gray-200 bg-white dark:border-input dark:bg-background"
                                    aria-invalid={stepError && !d.completionDate.trim()}
                                />
                            </div>
                        </div>
                    )}

                    {d.stepIndex === 1 && (
                        <div className="space-y-5">
                            <p className={`text-lg font-medium leading-snug ${dtTitle}`}>
                                How confident do you feel about your future since completing this program?
                            </p>
                            <RadioGroup
                                value={d.confidence}
                                onValueChange={(v) => updateDraft({ confidence: v })}
                                className="grid gap-2.5"
                            >
                                {(
                                    [
                                        ['1', 'Not at all confident'],
                                        ['2', 'A little confident'],
                                        ['3', 'Somewhat confident'],
                                        ['4', 'Quite confident'],
                                        ['5', 'Very confident']
                                    ] as const
                                ).map(([val, label]) => (
                                    <div
                                        key={val}
                                        className="flex w-full items-center gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2.5 transition-colors hover:border-[#556830]/45 dark:border-border dark:bg-background dark:hover:border-primary/50"
                                    >
                                        <Label
                                            htmlFor={`conf-${val}`}
                                            className="min-w-0 flex-1 cursor-pointer text-base font-normal leading-snug"
                                        >
                                            {label}
                                        </Label>
                                        <RadioGroupItem
                                            value={val}
                                            id={`conf-${val}`}
                                            indicator="checkbox"
                                        />
                                    </div>
                                ))}
                            </RadioGroup>
                        </div>
                    )}

                    {d.stepIndex === 2 && (
                        <StepTextarea
                            id="oneSentence"
                            lead="Put it in one line—what was this for you?"
                            label="How would you explain this in one sentence?"
                            value={d.oneSentence}
                            onChange={(v) => updateDraft({ oneSentence: v })}
                            invalid={stepError}
                        />
                    )}

                    {d.stepIndex === 3 && (
                        <StepTextarea
                            id="skillKnowledge"
                            lead="Skills, ideas, habits—anything new counts."
                            label="What new skill or knowledge did this program give you?"
                            value={d.skillKnowledge}
                            onChange={(v) => updateDraft({ skillKnowledge: v })}
                            invalid={stepError}
                        />
                    )}

                    {d.stepIndex === 4 && (
                        <StepTextarea
                            id="goalConnection"
                            lead="Jobs, training, personal goals—whatever fits."
                            label="What does this connect to for a goal, job, or career you are working toward now or in the future?"
                            value={d.goalConnection}
                            onChange={(v) => updateDraft({ goalConnection: v })}
                            invalid={stepError}
                        />
                    )}

                    {d.stepIndex === 5 && (
                        <StepTextarea
                            id="pride"
                            lead="There is no wrong answer."
                            label="Why are you proud of it?"
                            value={d.pride}
                            onChange={(v) => updateDraft({ pride: v })}
                            invalid={stepError}
                        />
                    )}

                    {d.stepIndex === 6 && (
                        <StepTextarea
                            id="standoutMoment"
                            lead="A person, a day, a breakthrough—whatever stayed with you."
                            label="Was there a moment or someone from this program that stood out for you?"
                            value={d.standoutMoment}
                            onChange={(v) => updateDraft({ standoutMoment: v })}
                            invalid={stepError}
                        />
                    )}

                    {d.stepIndex === 7 && (
                        <StepTextarea
                            id="adviceToPeer"
                            lead="Imagine someone in your unit considering the same program."
                            label="What is one thing you would tell another resident about this program?"
                            value={d.adviceToPeer}
                            onChange={(v) => updateDraft({ adviceToPeer: v })}
                            invalid={stepError}
                        />
                    )}

                    {stepError && (
                        <p className="text-sm font-medium text-destructive" role="alert">
                            Add a bit more here before continuing—we need something for this step.
                        </p>
                    )}

                    {canSkipCurrentStep && (
                        <div className="rounded-lg border border-gray-200/90 bg-gray-50/90 px-4 py-3 text-sm leading-relaxed text-muted-foreground dark:border-border dark:bg-muted/30">
                            <span className={`font-semibold text-[#556830] dark:text-primary`}>Optional.</span>{' '}
                            Use <span className="font-medium text-foreground">Skip this question</span> to leave
                            this one blank, or write an answer and press Continue.
                        </div>
                    )}
                </CardContent>

                <div className="flex flex-col-reverse gap-3 border-t border-gray-100 bg-muted/30 px-5 py-4 dark:border-border sm:flex-row sm:items-center sm:justify-between sm:px-7">
                    <Button type="button" variant="ghost" onClick={handleBack} disabled={d.stepIndex === 0}>
                        Back
                    </Button>
                    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:gap-3">
                        {canSkipCurrentStep && (
                            <Button type="button" variant="outline" onClick={handleSkipQuestion}>
                                Skip this question
                            </Button>
                        )}
                        <Button type="button" onClick={handleNext}>
                            {d.stepIndex === TRANSCRIPT_STEP_COUNT - 1 ? 'Save and preview' : 'Continue'}
                        </Button>
                    </div>
                </div>
            </Card>
        </DigitalTranscriptShell>
    );
}

function StepTextarea({
    id,
    lead,
    label,
    value,
    onChange,
    invalid
}: {
    id: string;
    lead?: string;
    label: string;
    value: string;
    onChange: (v: string) => void;
    invalid: boolean;
}) {
    return (
        <div className="space-y-4">
            {lead ? (
                <p className="text-sm font-medium leading-relaxed text-muted-foreground">{lead}</p>
            ) : null}
            <div className="space-y-2">
                <Label htmlFor={id} className={`text-lg font-medium leading-snug ${dtTitle}`}>
                    {label}
                </Label>
                <Textarea
                    id={id}
                    data-slot={`transcript-${id}`}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    rows={5}
                    className="min-h-32 resize-y border-gray-200 bg-white text-base leading-relaxed dark:border-input dark:bg-background"
                    aria-invalid={invalid && !value.trim()}
                />
            </div>
        </div>
    );
}
