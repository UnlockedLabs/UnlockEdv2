import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { TranscriptEntry } from '@/types/digital-transcript';
import { ConfidenceSegmentedControl } from './ConfidenceSegmentedControl';
import { ReflectionTextField } from './ReflectionTextField';
import {
    reflectionStepByKey,
    FUNNEL_FIELD_DESCRIPTIONS,
    FUNNEL_REFLECTION_TEXT_NUDGES,
    getReflectionNudgeTone,
    NUDGE_TONE_CLASSES,
    nudgeTrackFillRatio,
    type ReflectionAnswerKey,
    type ReflectionTextFieldKey
} from './transcriptReflectionConfig';
import { TopSkillsTagField } from './TopSkillsTagField';

interface ReflectionStepFieldProps {
    entry: TranscriptEntry;
    stepKey: ReflectionAnswerKey;
    onChange: (patch: Partial<TranscriptEntry>) => void;
    /** Funnel: render topSkills as plain text stored in topSkills[0]. */
    skillsAsParagraph?: boolean;
    labelOverride?: string;
    useFunnelNudges?: boolean;
}

type EntryTextFieldKey = Exclude<ReflectionTextFieldKey, 'topSkillsParagraph'>;

function textFieldKey(key: ReflectionAnswerKey): EntryTextFieldKey | null {
    if (key === 'topSkills' || key === 'confidence') return null;
    return key;
}

function FunnelSkillsInput({
    id,
    label,
    value,
    onChange
}: {
    id: string;
    label: string;
    value: string;
    onChange: (v: string) => void;
}) {
    const nudge = FUNNEL_REFLECTION_TEXT_NUDGES.topSkillsParagraph;
    const len = value.length;
    const tone = getReflectionNudgeTone(len, nudge);
    const toneCls = NUDGE_TONE_CLASSES[tone];
    const fill = nudgeTrackFillRatio(len, nudge);

    function handleChange(next: string) {
        if (next.length <= nudge.maxLength) onChange(next);
        else onChange(next.slice(0, nudge.maxLength));
    }

    return (
        <div className="space-y-2">
            <Label htmlFor={id}>{label}</Label>
            <p className="text-xs leading-relaxed text-muted-foreground">{nudge.hint}</p>
            <div
                className={cn(
                    'overflow-hidden rounded-lg border border-border/80 bg-muted/30 shadow-none',
                    'flex flex-col'
                )}
            >
                <Textarea
                    id={id}
                    data-slot="transcript-top-skills"
                    value={value}
                    onChange={(e) => handleChange(e.target.value)}
                    maxLength={nudge.maxLength}
                    rows={4}
                    className="min-h-24 resize-y rounded-none border-0 bg-transparent px-3 py-2.5 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                />
                <div
                    className={cn('h-1 w-full shrink-0', toneCls.trackBg)}
                    aria-hidden
                    role="presentation"
                >
                    <div
                        className={cn('h-full transition-[width] duration-150', toneCls.track)}
                        style={{ width: `${Math.round(fill * 100)}%` }}
                    />
                </div>
            </div>
            <p
                className={cn(
                    'shrink-0 text-right text-xs tabular-nums',
                    toneCls.counter
                )}
                aria-live="polite"
            >
                <span className="font-medium text-foreground">{len}</span>
                <span className="text-muted-foreground"> / {nudge.maxLength}</span>
            </p>
        </div>
    );
}

export function ReflectionStepField({
    entry,
    stepKey,
    onChange,
    skillsAsParagraph = false,
    labelOverride,
    useFunnelNudges = false
}: ReflectionStepFieldProps) {
    const step = reflectionStepByKey(stepKey);
    const idPrefix = `ach-${stepKey}-${entry.id}`;
    const label = labelOverride ?? step?.editorLabel ?? '';

    if (stepKey === 'topSkills' && skillsAsParagraph) {
        const value = entry.topSkills[0] ?? '';
        return (
            <FunnelSkillsInput
                id={idPrefix}
                label={label}
                value={value}
                onChange={(v) => onChange({ topSkills: v.trim() ? [v.trim()] : [] })}
            />
        );
    }

    if (!step) return null;

    if (step.kind === 'tags') {
        return (
            <TopSkillsTagField
                id={idPrefix}
                label={label}
                subtitle={step.editorSubtitle ?? 'Choose up to 5.'}
                value={entry.topSkills}
                onChange={(topSkills) => onChange({ topSkills })}
            />
        );
    }

    if (step.kind === 'confidence') {
        return (
            <section className="space-y-3" aria-labelledby={idPrefix}>
                <div id={idPrefix} className="text-sm font-medium leading-snug text-foreground">
                    {label}
                </div>
                {useFunnelNudges ? (
                    <p className="text-xs leading-relaxed text-muted-foreground">
                        {FUNNEL_FIELD_DESCRIPTIONS.confidence}
                    </p>
                ) : null}
                <ConfidenceSegmentedControl
                    value={entry.confidence}
                    onChange={(v) => onChange({ confidence: v })}
                    labelledBy={idPrefix}
                />
            </section>
        );
    }

    const fieldKey = textFieldKey(stepKey);
    if (!fieldKey) return null;

    const value = entry[fieldKey];
    const funnelNudge = useFunnelNudges ? FUNNEL_REFLECTION_TEXT_NUDGES[fieldKey] : undefined;

    return (
        <ReflectionTextField
            id={idPrefix}
            label={label}
            value={value}
            onChange={(v) => onChange({ [fieldKey]: v })}
            fieldKey={fieldKey}
            nudge={funnelNudge}
            descriptionAboveInput={useFunnelNudges}
        />
    );
}
