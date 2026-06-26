import { useCallback, type KeyboardEvent } from 'react';
import { cn } from '@/lib/utils';
import { CONFIDENCE_LEVEL_SOLID } from './confidenceLevelVisual';
import { CONFIDENCE_RADIO_OPTIONS } from './transcriptReflectionConfig';

const LEVEL_VISUAL = CONFIDENCE_LEVEL_SOLID.map((solid) => ({ solid }));

const NUMBER_DEFAULT = 'text-black dark:text-gray-100';
const NUMBER_SELECTED = 'text-black dark:text-gray-50';
const NUMBER_DIMMED = 'text-muted-foreground/40 dark:text-muted-foreground/50';

interface ConfidenceSegmentedControlProps {
    value: string;
    onChange?: (next: string) => void;
    /** Matches section `aria-labelledby` for the question text. */
    labelledBy: string;
    /** Preview/PDF: display-only, no interaction. */
    readOnly?: boolean;
}

export function ConfidenceSegmentedControl({
    value,
    onChange,
    labelledBy,
    readOnly = false
}: ConfidenceSegmentedControlProps) {
    const selectedNum = /^[1-5]$/.test(value) ? Number(value) : 0;
    const palette = selectedNum > 0 ? LEVEL_VISUAL[selectedNum - 1] : null;

    const move = useCallback(
        (delta: number) => {
            if (readOnly || !onChange) return;
            let next: number;
            if (!selectedNum) {
                next = delta > 0 ? 1 : 5;
            } else {
                next = Math.min(5, Math.max(1, selectedNum + delta));
            }
            onChange(String(next));
        },
        [onChange, readOnly, selectedNum]
    );

    function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
        if (readOnly) return;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
            e.preventDefault();
            move(1);
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
            e.preventDefault();
            move(-1);
        } else if (e.key >= '1' && e.key <= '5') {
            e.preventDefault();
            onChange?.(e.key);
        }
    }

    return (
        <div
            data-slot="transcript-confidence-segments"
            role="radiogroup"
            aria-labelledby={labelledBy}
            aria-readonly={readOnly || undefined}
            className={cn(readOnly && 'pointer-events-none')}
            onKeyDown={onKeyDown}
        >
            <div
                className={cn(
                    'flex h-11 w-full overflow-hidden rounded-lg border border-gray-200/90 bg-muted/60',
                    'ring-1 ring-black/[0.04] dark:border-slate-600 dark:bg-muted/40 dark:ring-white/[0.06]'
                )}
            >
                {CONFIDENCE_RADIO_OPTIONS.map(([val], index) => {
                    const n = index + 1;
                    const isSelected = value === val;
                    const bgClass =
                        isSelected && palette !== null
                            ? palette.solid
                            : 'bg-transparent';
                    const numberClass =
                        palette === null
                            ? NUMBER_DEFAULT
                            : isSelected
                              ? NUMBER_SELECTED
                              : NUMBER_DIMMED;

                    const segmentProps = readOnly
                        ? { role: 'presentation' as const }
                        : {
                              role: 'radio' as const,
                              'aria-checked': isSelected,
                              tabIndex: isSelected
                                  ? 0
                                  : !value && n === 1
                                    ? 0
                                    : -1,
                              onClick: () => onChange?.(val)
                          };

                    const SegmentTag = readOnly ? 'div' : 'button';

                    return (
                        <SegmentTag
                            key={val}
                            type={readOnly ? undefined : 'button'}
                            data-slot={`transcript-confidence-seg-${val}`}
                            className={cn(
                                'relative flex min-h-11 min-w-0 flex-1 items-center justify-center transition-colors',
                                !readOnly &&
                                    'cursor-pointer focus-visible:z-[2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                                'border-r border-black/10 last:border-r-0 dark:border-white/10',
                                bgClass
                            )}
                            {...segmentProps}
                        >
                            <span
                                className={cn(
                                    'text-sm font-semibold tabular-nums',
                                    numberClass
                                )}
                                aria-hidden={readOnly ? undefined : true}
                            >
                                {val}
                            </span>
                            <span className="sr-only">
                                {CONFIDENCE_RADIO_OPTIONS[index][1]}
                                {isSelected ? ', selected' : ''}
                            </span>
                        </SegmentTag>
                    );
                })}
            </div>
        </div>
    );
}
