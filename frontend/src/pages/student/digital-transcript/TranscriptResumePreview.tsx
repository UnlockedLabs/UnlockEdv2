import { useAuth } from '@/auth/useAuth';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { TranscriptDraft, TranscriptEntry } from '@/types/digital-transcript';
import { LearningRecordDocument } from './LearningRecordDocument';

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
    | 'topSkills'
    | 'whatMadeYouFinish'
    | 'goalConnection'
    | 'pride'
    | 'standoutMoment'
    | 'adviceToPeer'
>;

interface TranscriptResumePreviewProps {
    source: TranscriptEntry | TranscriptDraft;
    /** Merged onto the card; e.g. max-w-none + subtle shadow for embedded WYSIWYG canvas */
    className?: string;
    /**
     * `paper` — neutral chrome for the live WYSIWYG preview column.
     * `default` — moss accent for list / standalone views.
     */
    variant?: 'default' | 'paper';
    /** Hide the per-achievement readiness bar (e.g. home thumbnail). */
    hideReadiness?: boolean;
}

export function TranscriptResumePreview({
    source,
    className,
    variant = 'default',
    hideReadiness = false
}: TranscriptResumePreviewProps) {
    const { user } = useAuth();
    const name = residentDisplayName(user);
    const isPaper = variant === 'paper';
    const doc: PreviewSource = {
        programName: source.programName,
        completionDate: source.completionDate,
        confidence: source.confidence,
        oneSentence: source.oneSentence,
        topSkills: source.topSkills ?? [],
        whatMadeYouFinish: source.whatMadeYouFinish,
        goalConnection: source.goalConnection,
        pride: source.pride,
        standoutMoment: source.standoutMoment,
        adviceToPeer: source.adviceToPeer
    };

    return (
        <Card
            data-slot="transcript-resume-preview"
            className={cn(
                'max-w-2xl border-gray-200 bg-white shadow-md dark:border-border dark:bg-card',
                isPaper
                    ? 'border border-gray-200/90 shadow-[0_8px_40px_rgba(15,23,42,0.08)] ring-1 ring-slate-900/[0.03] dark:border-slate-700 dark:shadow-[0_12px_40px_rgba(0,0,0,0.35)] dark:ring-white/[0.05]'
                    : 'border-l-4 border-l-[#556830] dark:border-l-primary',
                className
            )}
        >
            <CardHeader
                className={cn(
                    'space-y-2 border-b border-gray-100 pb-5 dark:border-border',
                    isPaper && '!px-0 !pt-0 pb-4'
                )}
            >
                <header>
                    <h4
                        data-slot="transcript-resume-preview-eyebrow"
                        className={cn(
                            'text-base font-semibold leading-snug tracking-tight',
                            isPaper
                                ? 'text-slate-600 dark:text-muted-foreground'
                                : 'text-[#556830] dark:text-primary'
                        )}
                    >
                        Achievements logs of {name}
                    </h4>
                </header>
            </CardHeader>
            <CardContent
                className={cn(
                    isPaper ? 'flex min-h-0 flex-1 flex-col px-0 py-4' : 'space-y-8 pt-7'
                )}
            >
                <LearningRecordDocument
                    source={doc}
                    showReadiness={!hideReadiness}
                    className={cn(isPaper && 'px-0')}
                />
            </CardContent>
        </Card>
    );
}
