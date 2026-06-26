import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';
import type { TranscriptEntry } from '@/types/digital-transcript';
import { AchievementFormMetadata } from './AchievementFormMetadata';
import { ConfidenceSegmentedControl } from './ConfidenceSegmentedControl';
import {
    learningRecordOutlineButtonClassName,
    learningRecordPrimaryButtonClassName,
    learningRecordQuestionHeaderClassName,
    learningRecordSelectedChoiceClassName,
    learningRecordCheckedCheckboxClassName,
    learningRecordSelectedToggleClassName,
    LEARNING_RECORD_BUTTON_SIZE
} from './learningRecordButtons';
import { ReflectionTextField } from './ReflectionTextField';
import {
    FUNNEL_FIELD_DESCRIPTIONS,
    FUNNEL_FORM_STEP_COUNT,
    FUNNEL_FORM_STEPS,
    FUNNEL_Q5_AFTER_TAGS,
    FUNNEL_Q5_BEFORE_TAGS,
    FUNNEL_Q5_TAGS_MAX,
    FUNNEL_Q8_OPTIONS,
    FUNNEL_Q9_OPTIONS,
    FUNNEL_PARAGRAPH_TEXT_NUDGE,
    FUNNEL_REFLECTION_TEXT_NUDGES,
    funnelStepFieldLabel
} from './transcriptReflectionConfig';

const questionLabelClassName =
    'text-base font-medium leading-snug text-foreground';

function QuestionLabel({
    htmlFor,
    children
}: {
    htmlFor?: string;
    children: React.ReactNode;
}) {
    if (htmlFor) {
        return (
            <Label htmlFor={htmlFor} className={questionLabelClassName}>
                {children}
            </Label>
        );
    }
    return <div className={questionLabelClassName}>{children}</div>;
}

function FieldDescription({ children }: { children: React.ReactNode }) {
    return (
        <p className="text-xs leading-relaxed text-muted-foreground">
            {children}
        </p>
    );
}

function QuestionFieldHeader({
    htmlFor,
    label,
    description
}: {
    htmlFor?: string;
    label: React.ReactNode;
    description?: React.ReactNode;
}) {
    return (
        <div className={learningRecordQuestionHeaderClassName}>
            <QuestionLabel htmlFor={htmlFor}>{label}</QuestionLabel>
            {description ? (
                <FieldDescription>{description}</FieldDescription>
            ) : null}
        </div>
    );
}

function TagCloud({
    tags,
    selected,
    max,
    groupLabel,
    onChange
}: {
    tags: readonly string[];
    selected: string[];
    max: number;
    groupLabel: string;
    onChange: (next: string[]) => void;
}) {
    const atMax = selected.length >= max;

    function toggle(tag: string) {
        if (selected.includes(tag)) {
            onChange(selected.filter((t) => t !== tag));
            return;
        }
        if (atMax) return;
        onChange([...selected, tag]);
    }

    return (
        <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">{groupLabel}</p>
            <div className="flex flex-wrap gap-2">
                {tags.map((tag) => {
                    const isSelected = selected.includes(tag);
                    const disabled = atMax && !isSelected;
                    return (
                        <button
                            key={tag}
                            type="button"
                            onClick={() => toggle(tag)}
                            className={cn(
                                'rounded-full px-3 py-1 text-sm',
                                isSelected
                                    ? learningRecordSelectedChoiceClassName
                                    : 'cursor-pointer border border-border bg-transparent hover:bg-muted',
                                disabled &&
                                    'pointer-events-none cursor-not-allowed opacity-50'
                            )}
                        >
                            {tag}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

function ChecklistField({
    options,
    selected,
    onChange,
    idPrefix,
    columns = 1
}: {
    options: readonly string[];
    selected: string[];
    onChange: (next: string[]) => void;
    idPrefix: string;
    columns?: 1 | 2;
}) {
    function toggle(option: string) {
        if (selected.includes(option)) {
            onChange(selected.filter((o) => o !== option));
        } else {
            onChange([...selected, option]);
        }
    }

    return (
        <div
            className={cn(
                columns === 2 ? 'grid grid-cols-2 gap-x-3 gap-y-1' : 'space-y-1'
            )}
        >
            {options.map((option, index) => {
                const checked = selected.includes(option);
                const optionId = `${idPrefix}-${index}`;
                return (
                    <div
                        key={option}
                        className={cn(
                            'flex items-center gap-3 rounded-md border px-3 py-2',
                            checked
                                ? learningRecordSelectedChoiceClassName
                                : 'border-transparent'
                        )}
                    >
                        <Checkbox
                            id={optionId}
                            checked={checked}
                            onCheckedChange={() => toggle(option)}
                            className={learningRecordCheckedCheckboxClassName}
                        />
                        <Label
                            htmlFor={optionId}
                            className="cursor-pointer text-sm font-normal leading-snug"
                        >
                            {option}
                        </Label>
                    </div>
                );
            })}
        </div>
    );
}

interface AchievementFormProps {
    entry: TranscriptEntry;
    onChange: (patch: Partial<TranscriptEntry>) => void;
    showSaveErrors: boolean;
    activeStep: number;
    onActiveStepChange: (step: number) => void;
    onFinish?: () => void;
}

function renderStepFields(
    stepIndex: number,
    entry: TranscriptEntry,
    onChange: (patch: Partial<TranscriptEntry>) => void,
    showSaveErrors: boolean
) {
    const id = entry.id;

    switch (stepIndex) {
        case 0:
            return (
                <>
                    <AchievementFormMetadata
                        entry={entry}
                        onChange={onChange}
                        showSaveErrors={showSaveErrors}
                        variant="funnel"
                    />
                    <ReflectionTextField
                        id={`ach-whatMadeYouFinish-${id}`}
                        label={funnelStepFieldLabel('whatMadeYouFinish')}
                        value={entry.whatMadeYouFinish}
                        onChange={(v) => onChange({ whatMadeYouFinish: v })}
                        fieldKey="whatMadeYouFinish"
                        nudge={FUNNEL_REFLECTION_TEXT_NUDGES.whatMadeYouFinish}
                        descriptionAboveInput
                    />
                </>
            );
        case 1:
            return (
                <>
                    <section
                        className="space-y-3"
                        aria-labelledby={`ach-q4-${id}`}
                    >
                        <div>
                            <QuestionFieldHeader
                                htmlFor={`ach-q4-toggle-${id}`}
                                label={funnelStepFieldLabel('q4')}
                            />
                            <ToggleGroup
                                id={`ach-q4-toggle-${id}`}
                                type="single"
                                value={entry.q4Toggle ?? ''}
                                onValueChange={(v) => {
                                    if (v === 'yes') {
                                        onChange({ q4Toggle: 'yes' });
                                    } else if (v === 'notReally') {
                                        onChange({
                                            q4Toggle: 'notReally',
                                            q4Text: ''
                                        });
                                    }
                                }}
                                className="flex w-full gap-2"
                            >
                                <ToggleGroupItem
                                    value="yes"
                                    className={cn(
                                        'flex-1 border border-border',
                                        learningRecordSelectedToggleClassName
                                    )}
                                >
                                    Yes
                                </ToggleGroupItem>
                                <ToggleGroupItem
                                    value="notReally"
                                    className={cn(
                                        'flex-1 border border-border',
                                        learningRecordSelectedToggleClassName
                                    )}
                                >
                                    Not really
                                </ToggleGroupItem>
                            </ToggleGroup>
                        </div>
                        {entry.q4Toggle === 'yes' ? (
                            <ReflectionTextField
                                id={`ach-q4-text-${id}`}
                                label="What happened, or who made a difference?"
                                value={entry.q4Text}
                                onChange={(v) => onChange({ q4Text: v })}
                                nudge={FUNNEL_PARAGRAPH_TEXT_NUDGE}
                            />
                        ) : null}
                    </section>

                    <section
                        className="space-y-4"
                        aria-labelledby={`ach-q5-${id}`}
                    >
                        <div>
                            <QuestionFieldHeader
                                htmlFor={`ach-q5-before-${id}`}
                                label={funnelStepFieldLabel('q5')}
                                description={FUNNEL_FIELD_DESCRIPTIONS.q5}
                            />
                            <TagCloud
                                tags={FUNNEL_Q5_BEFORE_TAGS}
                                selected={entry.q5BeforeTags}
                                max={FUNNEL_Q5_TAGS_MAX}
                                groupLabel="Before this program, I felt..."
                                onChange={(q5BeforeTags) =>
                                    onChange({ q5BeforeTags })
                                }
                            />
                        </div>
                        <TagCloud
                            tags={FUNNEL_Q5_AFTER_TAGS}
                            selected={entry.q5AfterTags}
                            max={FUNNEL_Q5_TAGS_MAX}
                            groupLabel="After completing it, I feel..."
                            onChange={(q5AfterTags) =>
                                onChange({ q5AfterTags })
                            }
                        />
                        <ReflectionTextField
                            id={`ach-q5-free-${id}`}
                            label="Don't see the right words? Describe it in your own words."
                            value={entry.q5FreeText}
                            onChange={(v) => onChange({ q5FreeText: v })}
                            nudge={FUNNEL_PARAGRAPH_TEXT_NUDGE}
                        />
                    </section>

                    <ReflectionTextField
                        id={`ach-adviceToPeer-${id}`}
                        label={funnelStepFieldLabel('adviceToPeer')}
                        value={entry.adviceToPeer}
                        onChange={(v) => onChange({ adviceToPeer: v })}
                        fieldKey="adviceToPeer"
                        nudge={FUNNEL_REFLECTION_TEXT_NUDGES.adviceToPeer}
                        descriptionAboveInput
                    />
                </>
            );
        case 2:
            return (
                <>
                    <section
                        className="space-y-3"
                        aria-labelledby={`ach-confidence-${id}`}
                    >
                        <div>
                            <QuestionFieldHeader
                                htmlFor={`ach-confidence-${id}`}
                                label={funnelStepFieldLabel('confidence')}
                                description={
                                    FUNNEL_FIELD_DESCRIPTIONS.confidence
                                }
                            />
                            <div className="flex items-center gap-3">
                                <span className="flex w-[60px] shrink-0 flex-col items-center text-center text-xs leading-snug text-foreground">
                                    <span>Not very</span>
                                    <span>confident</span>
                                </span>
                                <div className="min-w-0 flex-1">
                                    <ConfidenceSegmentedControl
                                        value={entry.confidence}
                                        onChange={(v) =>
                                            onChange({ confidence: v })
                                        }
                                        labelledBy={`ach-confidence-${id}`}
                                    />
                                </div>
                                <span className="flex w-[60px] shrink-0 flex-col items-center text-center text-xs leading-snug text-foreground">
                                    <span>Very</span>
                                    <span>confident</span>
                                </span>
                            </div>
                        </div>
                        <ReflectionTextField
                            id={`ach-q7-text-${id}`}
                            label="Want to say more? Describe it in your own words."
                            value={entry.q7Text}
                            onChange={(v) => onChange({ q7Text: v })}
                            nudge={FUNNEL_PARAGRAPH_TEXT_NUDGE}
                        />
                    </section>

                    <section aria-labelledby={`ach-q8-${id}`}>
                        <QuestionFieldHeader
                            htmlFor={`ach-q8-0-${id}`}
                            label={funnelStepFieldLabel('q8Selections')}
                            description={FUNNEL_FIELD_DESCRIPTIONS.q8Selections}
                        />
                        <ChecklistField
                            idPrefix={`ach-q8-${id}`}
                            options={FUNNEL_Q8_OPTIONS}
                            selected={entry.q8Selections}
                            onChange={(q8Selections) =>
                                onChange({ q8Selections })
                            }
                            columns={2}
                        />
                    </section>

                    <section aria-labelledby={`ach-q9-${id}`}>
                        <QuestionFieldHeader
                            htmlFor={`ach-q9-0-${id}`}
                            label={funnelStepFieldLabel('q9Selections')}
                            description={FUNNEL_FIELD_DESCRIPTIONS.q9Selections}
                        />
                        <ChecklistField
                            idPrefix={`ach-q9-${id}`}
                            options={FUNNEL_Q9_OPTIONS}
                            selected={entry.q9Selections}
                            onChange={(q9Selections) =>
                                onChange({ q9Selections })
                            }
                        />
                    </section>

                    <ReflectionTextField
                        id={`ach-oneSentence-${id}`}
                        label={funnelStepFieldLabel('oneSentence')}
                        value={entry.oneSentence}
                        onChange={(v) => onChange({ oneSentence: v })}
                        fieldKey="oneSentence"
                        nudge={FUNNEL_REFLECTION_TEXT_NUDGES.oneSentence}
                        descriptionAboveInput
                    />
                </>
            );
        default:
            return null;
    }
}

export function AchievementForm({
    entry,
    onChange,
    showSaveErrors,
    activeStep,
    onActiveStepChange,
    onFinish
}: AchievementFormProps) {
    const stepConfig = FUNNEL_FORM_STEPS[activeStep];
    const isFirstStep = activeStep === 0;
    const isLastStep = activeStep === FUNNEL_FORM_STEP_COUNT - 1;
    const previousStep = FUNNEL_FORM_STEPS[activeStep - 1];
    const nextStep = FUNNEL_FORM_STEPS[activeStep + 1];

    return (
        <div data-slot="achievement-form" className="space-y-5 px-1 pt-2">
            {stepConfig ? (
                <div className="border-b border-border/60 pb-4">
                    <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                        {stepConfig.title}
                    </h1>
                </div>
            ) : null}

            {stepConfig ? (
                <div className="space-y-8">
                    {renderStepFields(
                        activeStep,
                        entry,
                        onChange,
                        showSaveErrors
                    )}
                </div>
            ) : null}

            <div className="flex gap-2 overflow-x-auto border-t border-border/60 pt-4">
                {!isFirstStep && previousStep ? (
                    <Button
                        type="button"
                        variant="outline"
                        size={LEARNING_RECORD_BUTTON_SIZE}
                        className={cn(
                            'whitespace-nowrap',
                            learningRecordOutlineButtonClassName
                        )}
                        onClick={() => onActiveStepChange(activeStep - 1)}
                    >
                        Previous: {previousStep.title}
                    </Button>
                ) : null}
                {!isLastStep && nextStep ? (
                    <Button
                        type="button"
                        variant="outline"
                        size={LEARNING_RECORD_BUTTON_SIZE}
                        className={cn(
                            'ml-auto whitespace-nowrap',
                            learningRecordOutlineButtonClassName
                        )}
                        onClick={() => onActiveStepChange(activeStep + 1)}
                    >
                        Next: {nextStep.title}
                    </Button>
                ) : onFinish ? (
                    <Button
                        type="button"
                        size={LEARNING_RECORD_BUTTON_SIZE}
                        className={cn(
                            'ml-auto',
                            learningRecordPrimaryButtonClassName
                        )}
                        onClick={onFinish}
                    >
                        Finish
                    </Button>
                ) : null}
            </div>
        </div>
    );
}
