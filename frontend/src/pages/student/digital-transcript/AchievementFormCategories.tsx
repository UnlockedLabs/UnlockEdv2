import type { TranscriptEntry } from '@/types/digital-transcript';
import { AchievementFormActions } from './AchievementFormActions';
import { AchievementFormCategoryCard } from './AchievementFormCategoryCard';
import { AchievementFormMetadata } from './AchievementFormMetadata';
import { ReflectionStepField } from './ReflectionStepField';
import { REFLECTION_CATEGORIES } from './transcriptReflectionConfig';

interface AchievementFormCategoriesProps {
    entry: TranscriptEntry;
    onChange: (patch: Partial<TranscriptEntry>) => void;
    onCancel: () => void;
    onDone: () => void;
    showDoneErrors: boolean;
    showDelete?: boolean;
    onDeleteRequest?: () => void;
}

export function AchievementFormCategories({
    entry,
    onChange,
    onCancel,
    onDone,
    showDoneErrors,
    showDelete,
    onDeleteRequest
}: AchievementFormCategoriesProps) {
    return (
        <div data-slot="achievement-form-categories" className="space-y-3">
            <AchievementFormCategoryCard
                title="Metadata"
                description="Program name and when you completed it."
            >
                <AchievementFormMetadata
                    entry={entry}
                    onChange={onChange}
                    showDoneErrors={showDoneErrors}
                />
            </AchievementFormCategoryCard>

            {REFLECTION_CATEGORIES.map((section) => (
                <AchievementFormCategoryCard
                    key={section.id}
                    title={section.title}
                    description={section.description}
                    labelledBy={`ach-section-${section.id}-${entry.id}`}
                >
                    <section
                        data-slot="achievement-form-section"
                        aria-labelledby={`ach-section-${section.id}-${entry.id}`}
                        className="space-y-5"
                    >
                        {section.stepKeys.map((stepKey) => (
                            <ReflectionStepField
                                key={stepKey}
                                entry={entry}
                                stepKey={stepKey}
                                onChange={onChange}
                            />
                        ))}
                    </section>
                </AchievementFormCategoryCard>
            ))}

            <AchievementFormActions
                onCancel={onCancel}
                onDone={onDone}
                showDelete={showDelete}
                onDeleteRequest={onDeleteRequest}
            />
        </div>
    );
}
