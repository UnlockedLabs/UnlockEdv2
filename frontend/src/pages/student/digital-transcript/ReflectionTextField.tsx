import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import {
    getReflectionNudgeTone,
    NUDGE_TONE_CLASSES,
    nudgeTrackFillRatio,
    type ReflectionTextFieldKey,
    type ReflectionTextNudge,
    REFLECTION_TEXT_NUDGES
} from './transcriptReflectionConfig';

interface ReflectionTextFieldProps {
    id: string;
    label: string;
    value: string;
    onChange: (v: string) => void;
    fieldKey: ReflectionTextFieldKey;
    nudge?: ReflectionTextNudge;
    /** Funnel: show nudge hint between label and input instead of below. */
    descriptionAboveInput?: boolean;
}

export function ReflectionTextField({
    id,
    label,
    value,
    onChange,
    fieldKey,
    nudge: nudgeOverride,
    descriptionAboveInput = false
}: ReflectionTextFieldProps) {
    const nudge = nudgeOverride ?? REFLECTION_TEXT_NUDGES[fieldKey];
    const len = value.length;
    const tone = getReflectionNudgeTone(len, nudge);
    const toneCls = NUDGE_TONE_CLASSES[tone];
    const fill = nudgeTrackFillRatio(len, nudge);
    const slot = id.replace('wysiwyg-', 'transcript-');

    function handleChange(next: string) {
        if (next.length <= nudge.maxLength) onChange(next);
        else onChange(next.slice(0, nudge.maxLength));
    }

    const showDescriptionAbove = descriptionAboveInput && Boolean(nudge.hint);
    const showDescriptionBelow = !descriptionAboveInput && Boolean(nudge.hint);

    return (
        <div className="space-y-2">
            <Label htmlFor={id}>{label}</Label>
            {showDescriptionAbove ? (
                <p className="text-xs leading-relaxed text-muted-foreground">{nudge.hint}</p>
            ) : null}
            <div
                className={cn(
                    'overflow-hidden rounded-lg border border-border/80 bg-muted/30 shadow-none',
                    'flex flex-col'
                )}
            >
                <Textarea
                    id={id}
                    data-slot={slot}
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
            <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                {showDescriptionBelow ? (
                    <p className="max-w-prose text-xs leading-relaxed text-muted-foreground">
                        {nudge.hint}
                    </p>
                ) : (
                    <span className="hidden sm:block sm:flex-1" aria-hidden />
                )}
                <p
                    className={cn(
                        'shrink-0 text-right text-xs tabular-nums sm:min-w-[5.5rem]',
                        toneCls.counter
                    )}
                    aria-live="polite"
                >
                    <span className="font-medium text-foreground">{len}</span>
                    <span className="text-muted-foreground"> / {nudge.maxLength}</span>
                </p>
            </div>
        </div>
    );
}
