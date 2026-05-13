import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { TranscriptDraft } from '@/types/digital-transcript';
import {
    DigitalTranscriptBackLink,
    dtTitle
} from './DigitalTranscriptShell';
import { TranscriptResumePreview } from './TranscriptResumePreview';

type SaveStatus = 'idle' | 'saving' | 'saved';

interface DigitalTranscriptWysiwygEntryProps {
    base: string;
    draft: TranscriptDraft;
    updateDraft: (patch: Partial<TranscriptDraft>) => void;
    persistDraftNow: () => void;
    completeEntry: (source: TranscriptDraft) => void;
}

export function DigitalTranscriptWysiwygEntry({
    base,
    draft,
    updateDraft,
    persistDraftNow,
    completeEntry
}: DigitalTranscriptWysiwygEntryProps) {
    const navigate = useNavigate();
    const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
    const [showDoneErrors, setShowDoneErrors] = useState(false);

    const skipSaveStatusEffect = useRef(true);
    useEffect(() => {
        if (skipSaveStatusEffect.current) {
            skipSaveStatusEffect.current = false;
            return;
        }
        setSaveStatus('saving');
        const toSaved = window.setTimeout(() => setSaveStatus('saved'), 450);
        const toIdle = window.setTimeout(() => setSaveStatus('idle'), 3200);
        return () => {
            window.clearTimeout(toSaved);
            window.clearTimeout(toIdle);
        };
    }, [draft.updatedAt]);

    const programOk = Boolean(draft.programName.trim());
    const dateOk = Boolean(draft.completionDate.trim());

    function handleDone() {
        if (!programOk || !dateOk) {
            setShowDoneErrors(true);
            return;
        }
        setShowDoneErrors(false);
        persistDraftNow();
        completeEntry(draft);
        navigate(base);
    }

    return (
        <div
            data-slot="transcript-wysiwyg-outer"
            className="flex w-full flex-col min-h-[calc(100dvh-8rem)] lg:h-[calc(100dvh-8rem)] lg:max-h-[calc(100dvh-8rem)] lg:min-h-0 lg:overflow-hidden"
        >
            <div
                data-slot="transcript-wysiwyg-layout"
                className="flex min-h-0 w-full flex-1 flex-col overflow-hidden lg:flex-row lg:items-stretch"
            >
            {/* Left: editor workspace (reference — light form surface) */}
            <aside
                data-slot="transcript-wysiwyg-editor-pane"
                className="flex min-h-0 w-full flex-col overflow-hidden border-b border-border bg-white dark:border-border dark:bg-card lg:h-full lg:max-w-md lg:flex-[0_0_min(28rem,42vw)] lg:border-b-0 lg:border-r xl:max-w-lg"
            >
                <div className="shrink-0 border-b border-gray-100 bg-white px-5 py-4 sm:px-6 dark:border-border dark:bg-card">
                    <DigitalTranscriptBackLink to={base}>Back</DigitalTranscriptBackLink>
                    <div className="mt-4 space-y-1">
                        <h1
                            className={cn(
                                'text-balance text-2xl font-semibold tracking-tight sm:text-3xl',
                                dtTitle
                            )}
                        >
                            Your record
                        </h1>
                        <p className="max-w-prose pt-1 text-sm leading-relaxed text-muted-foreground">
                            Edit on the left—your card updates on the right. Nothing is saved to your list until
                            you tap Done.
                        </p>
                    </div>
                </div>

                <div
                    data-slot="transcript-wysiwyg-controls"
                    className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-6 sm:px-6"
                >
                    <div className="mx-auto max-w-xl space-y-8 pb-8">
                        <section className="space-y-4">
                            <h2 className={`text-xs font-semibold uppercase tracking-[0.14em] ${dtTitle}`}>
                                Basics
                            </h2>
                            <div className="space-y-2">
                                <Label htmlFor="wysiwyg-programName">Program or course name</Label>
                                <Input
                                    id="wysiwyg-programName"
                                    data-slot="transcript-program-name"
                                    value={draft.programName}
                                    onChange={(e) => updateDraft({ programName: e.target.value })}
                                    placeholder="e.g. GED prep, welding fundamentals"
                                    aria-invalid={showDoneErrors && !programOk}
                                />
                                {showDoneErrors && !programOk && (
                                    <p className="text-sm text-destructive" role="alert">
                                        Add a program or course name to continue.
                                    </p>
                                )}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="wysiwyg-completionDate">Completion date</Label>
                                <Input
                                    id="wysiwyg-completionDate"
                                    type="date"
                                    data-slot="transcript-completion-date"
                                    value={draft.completionDate}
                                    onChange={(e) => updateDraft({ completionDate: e.target.value })}
                                    aria-invalid={showDoneErrors && !dateOk}
                                />
                                {showDoneErrors && !dateOk && (
                                    <p className="text-sm text-destructive" role="alert">
                                        Add a completion date to continue.
                                    </p>
                                )}
                            </div>
                        </section>

                        <section className="space-y-4">
                            <h2 className={`text-xs font-semibold uppercase tracking-[0.14em] ${dtTitle}`}>
                                How this program felt for you
                            </h2>
                            <p className="text-sm text-muted-foreground">
                                How confident do you feel about your future since completing this program?
                            </p>
                            <RadioGroup
                                value={draft.confidence}
                                onValueChange={(v) => updateDraft({ confidence: v })}
                                className="grid gap-2"
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
                                        className="flex w-full items-center gap-3 rounded-lg border border-gray-200 bg-gray-50/50 px-3 py-2.5 transition-colors hover:border-[#556830]/40 dark:border-border dark:bg-muted/20 dark:hover:border-primary/40"
                                    >
                                        <Label
                                            htmlFor={`wysiwyg-conf-${val}`}
                                            className="min-w-0 flex-1 cursor-pointer text-sm font-normal leading-snug"
                                        >
                                            {label}
                                        </Label>
                                        <RadioGroupItem
                                            value={val}
                                            id={`wysiwyg-conf-${val}`}
                                            indicator="checkbox"
                                        />
                                    </div>
                                ))}
                            </RadioGroup>
                        </section>

                        <WysiwygTextarea
                            id="wysiwyg-oneSentence"
                            label="In one sentence"
                            value={draft.oneSentence}
                            onChange={(v) => updateDraft({ oneSentence: v })}
                        />
                        <WysiwygCommaTagField
                            id="wysiwyg-skillKnowledge"
                            label="New skill or knowledge"
                            value={draft.skillKnowledge}
                            onChange={(v) => updateDraft({ skillKnowledge: v })}
                        />
                        <WysiwygTextarea
                            id="wysiwyg-goalConnection"
                            label="Connection to your goals"
                            value={draft.goalConnection}
                            onChange={(v) => updateDraft({ goalConnection: v })}
                        />
                        <WysiwygTextarea
                            id="wysiwyg-pride"
                            label="Why you are proud"
                            value={draft.pride}
                            onChange={(v) => updateDraft({ pride: v })}
                        />
                        <WysiwygTextarea
                            id="wysiwyg-standoutMoment"
                            label="A moment or someone that stood out"
                            value={draft.standoutMoment}
                            onChange={(v) => updateDraft({ standoutMoment: v })}
                        />
                        <WysiwygTextarea
                            id="wysiwyg-adviceToPeer"
                            label="What you would tell another resident"
                            value={draft.adviceToPeer}
                            onChange={(v) => updateDraft({ adviceToPeer: v })}
                        />

                        <div className="flex flex-col-reverse gap-3 border-t border-gray-100 pt-6 dark:border-border sm:flex-row sm:justify-end">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                    persistDraftNow();
                                    navigate(base);
                                }}
                            >
                                Cancel
                            </Button>
                            <Button type="button" data-slot="transcript-done" onClick={handleDone}>
                                Done
                            </Button>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Right: preview canvas (reference — cool grey chrome, document on “paper”) */}
            <div
                data-slot="transcript-wysiwyg-preview-pane"
                className="flex min-h-[min(52vh,28rem)] flex-1 flex-col overflow-hidden bg-[#c4ccd6] dark:bg-slate-950 lg:min-h-0 lg:h-full lg:flex-1"
            >
                <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-400/30 bg-[#b6c0cd] px-[40px] py-2.5 dark:border-slate-700 dark:bg-slate-900">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-700 dark:text-slate-300">
                        Preview
                    </span>
                    <span className="rounded-full bg-white/60 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                        Live
                    </span>
                </div>

                <div className="relative flex min-h-0 flex-1 flex-col">
                    <div className="flex min-h-0 flex-1 items-start justify-center overflow-y-auto overscroll-contain p-[40px] lg:min-h-0 lg:overflow-y-auto">
                        <div className="w-full max-w-none">
                            <TranscriptResumePreview
                                source={draft}
                                className="max-w-none shadow-[0_1px_2px_rgba(15,23,42,0.05)] ring-1 ring-slate-900/[0.04] dark:shadow-[0_1px_2px_rgba(0,0,0,0.18)] dark:ring-white/[0.06]"
                            />
                        </div>
                    </div>

                    <footer className="flex shrink-0 items-center justify-between gap-4 border-t border-slate-400/25 bg-[#aeb8c7]/95 px-[40px] py-2.5 dark:border-slate-700 dark:bg-slate-900/95">
                        <p
                            data-slot="transcript-autosave-status"
                            className="text-xs font-medium text-slate-700 dark:text-slate-300"
                            aria-live="polite"
                        >
                            {saveStatus === 'saving' && 'Saving…'}
                            {saveStatus === 'saved' && 'Saved'}
                            {saveStatus === 'idle' && (
                                <span className="text-slate-500 dark:text-slate-500">&nbsp;</span>
                            )}
                        </p>
                        <span
                            className="text-[11px] font-medium tabular-nums text-slate-600 dark:text-slate-400"
                            aria-hidden
                        >
                            1 / 1
                        </span>
                    </footer>
                </div>
            </div>
        </div>
        </div>
    );
}

interface WysiwygCommaTagFieldProps {
    id: string;
    label: string;
    value: string;
    onChange: (v: string) => void;
}

function parseCommaTags(raw: string): string[] {
    return raw
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
}

function joinCommaTags(tags: string[]): string {
    return tags.join(', ');
}

function WysiwygCommaTagField({ id, label, value, onChange }: WysiwygCommaTagFieldProps) {
    const slot = id.replace('wysiwyg-', 'transcript-');
    const tags = useMemo(() => parseCommaTags(value), [value]);
    const [input, setInput] = useState('');

    const commit = useCallback(
        (next: string[]) => {
            onChange(joinCommaTags(next));
        },
        [onChange]
    );

    const addTokens = useCallback(
        (raw: string) => {
            const extra = parseCommaTags(raw);
            if (extra.length === 0) return;
            commit([...tags, ...extra]);
            setInput('');
        },
        [tags, commit]
    );

    function removeAt(index: number) {
        commit(tags.filter((_, i) => i !== index));
    }

    function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            addTokens(input);
            return;
        }
        if (e.key === 'Backspace' && input === '' && tags.length > 0) {
            e.preventDefault();
            removeAt(tags.length - 1);
        }
    }

    function handleBlur() {
        if (input.trim()) addTokens(input);
    }

    return (
        <div className="space-y-2" data-slot={slot}>
            <Label htmlFor={id}>{label}</Label>
            <p id={`${id}-hint`} className="text-xs text-muted-foreground">
                Separate items with commas, or press Enter after each one.
            </p>
            <div
                data-slot={`${slot}-tags`}
                className="flex min-h-[6.5rem] flex-col gap-2 rounded-md border border-gray-200 bg-white p-2 dark:border-input dark:bg-background"
            >
                <div className="flex flex-wrap gap-1.5" role="list">
                    {tags.map((tag, i) => (
                        <Badge
                            key={`${i}-${tag}`}
                            variant="secondary"
                            className="max-w-full gap-1 px-2 py-1 text-xs font-normal"
                            role="listitem"
                        >
                            <span className="max-w-[14rem] truncate">{tag}</span>
                            <button
                                type="button"
                                className="-mr-0.5 rounded-sm p-0.5 text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                                onClick={() => removeAt(i)}
                                aria-label={`Remove ${tag}`}
                            >
                                <X className="size-3.5 shrink-0" aria-hidden />
                            </button>
                        </Badge>
                    ))}
                </div>
                <Input
                    id={id}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onBlur={handleBlur}
                    placeholder="Add an item…"
                    aria-describedby={`${id}-hint`}
                    className="h-9 border-0 bg-transparent px-1 shadow-none focus-visible:ring-0"
                />
            </div>
        </div>
    );
}

interface WysiwygTextareaProps {
    id: string;
    label: string;
    value: string;
    onChange: (v: string) => void;
}

function WysiwygTextarea({ id, label, value, onChange }: WysiwygTextareaProps) {
    const slot = id.replace('wysiwyg-', 'transcript-');
    return (
        <div className="space-y-2">
            <Label htmlFor={id}>{label}</Label>
            <Textarea
                id={id}
                data-slot={slot}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                rows={4}
                className="min-h-24 resize-y border-gray-200 bg-white dark:border-input dark:bg-background"
            />
        </div>
    );
}
