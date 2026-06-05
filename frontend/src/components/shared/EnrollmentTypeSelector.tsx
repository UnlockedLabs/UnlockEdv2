export const CANVAS_ENROLLMENT_TYPES = [
    { value: 'student', label: 'Student' },
    { value: 'teacher', label: 'Teacher' },
    { value: 'ta', label: 'TA' },
    { value: 'observer', label: 'Observer' },
    { value: 'designer', label: 'Designer' }
] as const;

export function EnrollmentTypeSelector({
    selected,
    onChange
}: {
    selected: string[];
    onChange: (types: string[]) => void;
}) {
    const toggle = (value: string) => {
        onChange(
            selected.includes(value)
                ? selected.filter((t) => t !== value)
                : [...selected, value]
        );
    };
    return (
        <div>
            <label className="text-sm font-medium text-foreground">
                User Roles to Import
            </label>
            <p className="text-xs text-muted-foreground mt-0.5">
                Only users with these Canvas roles will be pulled. Leave all
                unchecked to import everyone.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
                {CANVAS_ENROLLMENT_TYPES.map(({ value, label }) => {
                    const checked = selected.includes(value);
                    return (
                        <button
                            key={value}
                            type="button"
                            onClick={() => toggle(value)}
                            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                                checked
                                    ? 'bg-[#203622] text-white border-[#203622]'
                                    : 'bg-transparent text-foreground border-border hover:border-[#203622]'
                            }`}
                        >
                            {label}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
