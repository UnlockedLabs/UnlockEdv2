interface AchievementFormSectionHeaderProps {
    sectionIndex: number;
    sectionTotal: number;
    title: string;
    description: string;
}

export function AchievementFormSectionHeader({
    sectionIndex,
    sectionTotal,
    title,
    description
}: AchievementFormSectionHeaderProps) {
    return (
        <header
            data-slot="achievement-form-section-header"
            className="flex items-start justify-between gap-4"
        >
            <div className="min-w-0 space-y-1">
                <h3 className="text-sm font-semibold tracking-tight text-foreground">{title}</h3>
                <p className="max-w-prose text-xs leading-relaxed text-muted-foreground">
                    {description}
                </p>
            </div>
            <p
                className="shrink-0 text-[11px] font-medium uppercase tracking-wide text-muted-foreground tabular-nums"
                aria-label={`Section ${sectionIndex} of ${sectionTotal}`}
            >
                Section {sectionIndex} of {sectionTotal}
            </p>
        </header>
    );
}
