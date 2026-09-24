import { useId, useMemo, useState } from 'react';
import {
    Popover,
    PopoverContent,
    PopoverTrigger
} from '@/components/ui/popover';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { ChevronDown, Filter } from 'lucide-react';

export type NumericFilterOperator = '>' | '<' | '>=' | '<=' | '=';

export interface NumericFilterField<T extends string = string> {
    key: T;
    label: string;
    /** Appended to the displayed value, e.g. '%'. */
    suffix?: string;
}

export interface NumericFilterValue {
    operator: NumericFilterOperator;
    value: number;
}

const OPERATORS: { value: NumericFilterOperator; label: string }[] = [
    { value: '>', label: 'more than' },
    { value: '<', label: 'less than' },
    { value: '>=', label: 'at least' },
    { value: '<=', label: 'at most' },
    { value: '=', label: 'exactly' }
];

function NumericFilterRow<T extends string>({
    field,
    current,
    onChange
}: {
    field: NumericFilterField<T>;
    current: NumericFilterValue | undefined;
    onChange: (value: NumericFilterValue | undefined) => void;
}) {
    const [operator, setOperator] = useState<NumericFilterOperator>(
        current?.operator ?? '>'
    );
    const [valueStr, setValueStr] = useState(current?.value?.toString() ?? '');
    const inputId = useId();

    function commit(nextOperator: NumericFilterOperator, nextValueStr: string) {
        if (nextValueStr === '') {
            onChange(undefined);
            return;
        }
        const num = Number(nextValueStr);
        if (Number.isNaN(num)) return;
        onChange({ operator: nextOperator, value: num });
    }

    return (
        <div className="space-y-1.5">
            <label
                htmlFor={inputId}
                className="text-sm font-medium text-gray-700"
            >
                {field.label}
            </label>
            <div className="flex items-center gap-2">
                <Select
                    value={operator}
                    onValueChange={(op) => {
                        const nextOp = op as NumericFilterOperator;
                        setOperator(nextOp);
                        commit(nextOp, valueStr);
                    }}
                >
                    <SelectTrigger
                        className="w-36"
                        aria-label={`${field.label} comparison`}
                    >
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {OPERATORS.map((op) => (
                            <SelectItem key={op.value} value={op.value}>
                                {op.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Input
                    id={inputId}
                    type="number"
                    placeholder={field.suffix === '%' ? '0-100' : '0'}
                    className="w-24"
                    value={valueStr}
                    onChange={(e) => {
                        setValueStr(e.target.value);
                        commit(operator, e.target.value);
                    }}
                />
                {field.suffix && (
                    <span className="text-sm text-gray-500">
                        {field.suffix}
                    </span>
                )}
            </div>
        </div>
    );
}

/**
 * Popover panel of operator+value threshold filters for numeric/percentage
 * table columns. Built on the same Popover primitive as MultiSelectFilter so
 * it matches the ProgramsPage filter row's look and behavior.
 */
export function NumericFilterPanel<T extends string>({
    label,
    fields,
    values,
    onChange,
    className
}: {
    label: string;
    fields: NumericFilterField<T>[];
    values: Partial<Record<T, NumericFilterValue>>;
    onChange: (key: T, value: NumericFilterValue | undefined) => void;
    className?: string;
}) {
    const activeCount = useMemo(
        () => Object.values(values).filter(Boolean).length,
        [values]
    );

    return (
        <Popover>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    className={cn('filter-button', className)}
                >
                    <div className="flex items-center gap-2">
                        <Filter className="size-4" />
                        <span>
                            {label}
                            {activeCount > 0 && ` (${activeCount})`}
                        </span>
                    </div>
                    <ChevronDown className="size-4" />
                </button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-4" align="end">
                <div className="space-y-4">
                    {fields.map((field) => (
                        <NumericFilterRow
                            key={field.key}
                            field={field}
                            current={values[field.key]}
                            onChange={(value) => onChange(field.key, value)}
                        />
                    ))}
                </div>
            </PopoverContent>
        </Popover>
    );
}
