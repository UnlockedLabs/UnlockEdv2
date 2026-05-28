import { Button } from '@/components/ui/button';
import type { TranscriptEntry } from '@/types/digital-transcript';
import { AchievementFormMetadata } from './AchievementFormMetadata';
import { ReflectionStepField } from './ReflectionStepField';
import {
    FUNNEL_FORM_STEP_COUNT,
    FUNNEL_FORM_STEPS,
    funnelStepFieldLabel,
    type FunnelStepField,
    type ReflectionAnswerKey
} from './transcriptReflectionConfig';

function isReflectionField(field: FunnelStepField): field is ReflectionAnswerKey {
    return field !== 'programName' && field !== 'completionDate';
}

interface AchievementFormProps {
    entry: TranscriptEntry;
    onChange: (patch: Partial<TranscriptEntry>) => void;
    showSaveErrors: boolean;
    /** Controlled step index (lifted for Save validation jump to step 0). */
    activeStep: number;
    onActiveStepChange: (step: number) => void;
    /** Funnel: same handler as toolbar Save changes. */
    onSave?: () => void;
}

export function AchievementForm({
    entry,
    onChange,
    showSaveErrors,
    activeStep,
    onActiveStepChange,
    onSave
}: AchievementFormProps) {
    const stepConfig = FUNNEL_FORM_STEPS[activeStep];
    const isFirstStep = activeStep === 0;
    const isLastStep = activeStep === FUNNEL_FORM_STEP_COUNT - 1;

    return (
        <div data-slot="achievement-form" className="space-y-5 px-1 pt-2">
            {stepConfig ? (
                <h2 className="text-base font-semibold tracking-tight text-foreground">
                    {stepConfig.title}
                </h2>
            ) : null}

            {stepConfig ? (
                <div className="space-y-5">
                    {isFirstStep ? (
                        <AchievementFormMetadata
                            entry={entry}
                            onChange={onChange}
                            showSaveErrors={showSaveErrors}
                        />
                    ) : null}

                    {stepConfig.fields.filter(isReflectionField).map((field) => {
                            if (!isReflectionField(field)) return null;
                            return (
                                <ReflectionStepField
                                    key={field}
                                    entry={entry}
                                    stepKey={field}
                                    onChange={onChange}
                                    skillsAsParagraph={field === 'topSkills'}
                                    labelOverride={funnelStepFieldLabel(field)}
                                    useFunnelNudges
                                />
                            );
                        })}
                </div>
            ) : null}

            <div className="flex gap-2 border-t border-border/60 pt-4">
                {!isFirstStep ? (
                    <Button
                        type="button"
                        variant="outline"
                        className="bg-background"
                        onClick={() => onActiveStepChange(activeStep - 1)}
                    >
                        Previous
                    </Button>
                ) : null}
                {!isLastStep ? (
                    <Button
                        type="button"
                        variant="outline"
                        className="ml-auto bg-background"
                        onClick={() => onActiveStepChange(activeStep + 1)}
                    >
                        Next
                    </Button>
                ) : onSave ? (
                    <Button
                        type="button"
                        className="ml-auto bg-[#556830] text-white hover:bg-[#203622]"
                        onClick={onSave}
                    >
                        Finish
                    </Button>
                ) : null}
            </div>
        </div>
    );
}
