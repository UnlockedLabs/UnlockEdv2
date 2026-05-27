import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';

export interface DateRangeValue {
    startDate: string;
    endDate: string;
    allTime: boolean;
}

interface DateRangePickerProps {
    value: DateRangeValue;
    onChange: (next: DateRangeValue) => void;
}

const ISO = 'yyyy-MM-dd';

const allTimeRange: DateRangeValue = {
    startDate: '',
    endDate: '',
    allTime: true
};

function validateRange(
    start: string,
    end: string,
    today: string
): string | null {
    if (!start || !end) return null;
    if (end < start) return 'End date must be on or after the start date';
    if (end > today) return 'End date cannot be in the future';
    return null;
}

export default function DateRangePicker({
    value,
    onChange
}: DateRangePickerProps) {
    const today = useMemo(() => format(new Date(), ISO), []);
    const [editStart, setEditStart] = useState(value.startDate);
    const [editEnd, setEditEnd] = useState(value.endDate);

    useEffect(() => {
        setEditStart(value.startDate);
        setEditEnd(value.endDate);
    }, [value.startDate, value.endDate]);

    const validationError = validateRange(editStart, editEnd, today);
    const bothEntered = editStart !== '' && editEnd !== '';
    const isDifferentFromCurrent =
        value.allTime ||
        editStart !== value.startDate ||
        editEnd !== value.endDate;
    const canApply = bothEntered && !validationError && isDifferentFromCurrent;

    const applyAllTime = () => {
        onChange(allTimeRange);
    };

    const applyCustom = () => {
        if (!canApply) return;
        onChange({
            startDate: editStart,
            endDate: editEnd,
            allTime: false
        });
    };

    const pillClass = (active: boolean) =>
        active ? 'button-sm' : 'button-outline-sm';

    return (
        <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-end gap-3">
                <div className="flex gap-2 pb-1">
                    <button
                        type="button"
                        className={pillClass(value.allTime)}
                        onClick={applyAllTime}
                    >
                        All time
                    </button>
                </div>

                <div className="flex flex-wrap items-end gap-2">
                    <div>
                        <label
                            htmlFor="range-start"
                            className="label leading-tight"
                        >
                            <span className="label-text">Start date</span>
                        </label>
                        <input
                            id="range-start"
                            type="date"
                            value={editStart}
                            max={editEnd || today}
                            onChange={(e) => setEditStart(e.target.value)}
                            className="input input-bordered"
                        />
                    </div>
                    <div>
                        <label
                            htmlFor="range-end"
                            className="label leading-tight"
                        >
                            <span className="label-text">End date</span>
                        </label>
                        <input
                            id="range-end"
                            type="date"
                            value={editEnd}
                            min={editStart || undefined}
                            max={today}
                            onChange={(e) => setEditEnd(e.target.value)}
                            className="input input-bordered"
                        />
                    </div>
                    <button
                        type="button"
                        className="button"
                        disabled={!canApply}
                        onClick={applyCustom}
                    >
                        Apply
                    </button>
                </div>
            </div>
            {validationError && (
                <p className="text-error text-sm" role="alert">
                    {validationError}
                </p>
            )}
        </div>
    );
}
