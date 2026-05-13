import { useAuth } from '@/auth/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { TranscriptDraft, TranscriptEntry } from '@/types/digital-transcript';
import { dtTitle } from './DigitalTranscriptShell';

function residentDisplayName(user: ReturnType<typeof useAuth>['user']): string {
    if (!user) return 'Resident';
    const first = typeof user.name_first === 'string' ? user.name_first.trim() : '';
    const last = typeof user.name_last === 'string' ? user.name_last.trim() : '';
    const full = [first, last].filter(Boolean).join(' ');
    return full.length > 0 ? full : 'Resident';
}

type PreviewSource = Pick<
    TranscriptDraft,
    | 'programName'
    | 'completionDate'
    | 'confidence'
    | 'oneSentence'
    | 'skillKnowledge'
    | 'goalConnection'
    | 'pride'
    | 'standoutMoment'
    | 'adviceToPeer'
>;

const SECTIONS: { key: keyof PreviewSource; label: string }[] = [
    { key: 'confidence', label: 'Confidence about your future since this program' },
    { key: 'oneSentence', label: 'In one sentence' },
    { key: 'skillKnowledge', label: 'New skill or knowledge' },
    { key: 'goalConnection', label: 'Connection to your goals' },
    { key: 'pride', label: 'Why you are proud' },
    { key: 'standoutMoment', label: 'A moment or someone that stood out' },
    { key: 'adviceToPeer', label: 'What you would tell another resident' }
];

function confidenceLabel(v: string) {
    if (!/^[1-5]$/.test(v)) return v;
    const n = Number(v);
    const words = ['', 'Not at all', 'A little', 'Somewhat', 'Quite a bit', 'Very confident'];
    return `${n} — ${words[n] ?? v}`;
}

interface TranscriptResumePreviewProps {
    source: TranscriptEntry | TranscriptDraft;
    /** Merged onto the card; e.g. max-w-none + subtle shadow for embedded WYSIWYG canvas */
    className?: string;
}

export function TranscriptResumePreview({ source, className }: TranscriptResumePreviewProps) {
    const { user } = useAuth();
    const name = residentDisplayName(user);

    return (
        <Card
            data-slot="transcript-resume-preview"
            className={cn(
                'max-w-2xl border-l-4 border-l-[#556830] border-gray-200 bg-white shadow-md dark:border-border dark:border-l-primary dark:bg-card',
                className
            )}
        >
            <CardHeader className="space-y-2 border-b border-gray-100 pb-5 dark:border-border">
                <p
                    data-slot="transcript-resume-preview-eyebrow"
                    className="text-xs font-semibold leading-snug tracking-normal text-[#556830] dark:text-primary"
                >
                    Achievements logs of {name}
                </p>
                <CardTitle className={`text-2xl font-semibold tracking-tight sm:text-[1.65rem] ${dtTitle}`}>
                    {source.programName || 'Program'}
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                    Completed{' '}
                    <span className="font-medium text-foreground">
                        {source.completionDate
                            ? new Date(source.completionDate + 'T12:00:00').toLocaleDateString(undefined, {
                                  year: 'numeric',
                                  month: 'long',
                                  day: 'numeric'
                              })
                            : '—'}
                    </span>
                </p>
            </CardHeader>
            <CardContent className="space-y-8 pt-7">
                {SECTIONS.map(({ key, label }) => {
                    const raw = source[key];
                    const text = key === 'confidence' ? confidenceLabel(String(raw)) : String(raw || '');
                    if (!text) return null;
                    return (
                        <section key={key} className="space-y-2">
                            <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                                {label}
                            </h3>
                            <p className="text-[1.05rem] leading-relaxed text-foreground whitespace-pre-wrap">
                                {text}
                            </p>
                        </section>
                    );
                })}
            </CardContent>
        </Card>
    );
}
