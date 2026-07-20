import { useMemo } from 'react';
import {
    Popover,
    PopoverContent,
    PopoverTrigger
} from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { ChevronDown } from 'lucide-react';

export interface MultiSelectOption<T extends string = string> {
    value: T;
    label: string;
}

interface MultiSelectFilterProps<T extends string = string> {
    /** Stable id prefix used for checkbox/label association. */
    label: string;
    /** Text shown when everything (or nothing) is selected, e.g. "All facilities (5)". */
    allLabel: string;
    options: MultiSelectOption<T>[];
    /**
     * Explicitly selected values. An empty array OR a full selection both mean
     * "all" — the same no-narrowing convention the ProgramsPage filters use.
     */
    selected: T[];
    onChange: (values: T[]) => void;
    disabled?: boolean;
    className?: string;
}

/**
 * Reusable multi-select dropdown with a "Select all / Deselect all" toggle,
 * styled as a full-width form control. Built on the same Popover + Checkbox
 * primitives the ProgramsPage filters use, so select-all / select-multiple
 * behaves consistently across the tool.
 */
export function MultiSelectFilter<T extends string = string>({
    label,
    allLabel,
    options,
    selected,
    onChange,
    disabled = false,
    className
}: MultiSelectFilterProps<T>) {
    const displayLabel = useMemo(() => {
        if (selected.length === 0 || selected.length === options.length) {
            return allLabel;
        }
        if (selected.length === 1) {
            return options.find((o) => o.value === selected[0])?.label ?? '';
        }
        return `${selected.length} selected`;
    }, [selected, options, allLabel]);

    const allSelected = selected.length === options.length;

    const toggle = (value: T) => {
        onChange(
            selected.includes(value)
                ? selected.filter((v) => v !== value)
                : [...selected, value]
        );
    };

    return (
        <Popover>
            <PopoverTrigger asChild disabled={disabled}>
                <button
                    type="button"
                    disabled={disabled}
                    className={cn(
                        'flex h-10 w-full items-center justify-between rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 transition-colors hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#262626] dark:bg-[#171717] dark:text-gray-300',
                        className
                    )}
                >
                    <span className="truncate text-left">{displayLabel}</span>
                    <ChevronDown className="size-4 shrink-0 text-gray-400" />
                </button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-3" align="start">
                <div className="space-y-2">
                    <button
                        type="button"
                        onClick={() =>
                            onChange(
                                allSelected ? [] : options.map((o) => o.value)
                            )
                        }
                        className="text-xs text-brand hover:underline dark:text-[#8fb55e]"
                    >
                        {allSelected ? 'Deselect all' : 'Select all'}
                    </button>
                    <div className="max-h-64 space-y-2 overflow-y-auto">
                        {options.map((o) => (
                            <div
                                key={o.value}
                                className="flex items-center gap-2"
                            >
                                <Checkbox
                                    id={`${label}-${o.value}`}
                                    checked={selected.includes(o.value)}
                                    onCheckedChange={() => toggle(o.value)}
                                />
                                <label
                                    htmlFor={`${label}-${o.value}`}
                                    className="cursor-pointer text-sm text-gray-700 dark:text-gray-300"
                                >
                                    {o.label}
                                </label>
                            </div>
                        ))}
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
}
