import {
    Control,
    Controller,
    FieldErrors,
    FieldValues,
    Path
} from 'react-hook-form';

interface CheckboxGroupInputProps<
    T,
    TFieldValues extends FieldValues = FieldValues
> {
    label: string;
    options: T[];
    interfaceRef: Path<TFieldValues>;
    required: boolean;
    errors: FieldErrors;
    control: Control<TFieldValues>;
    disabled?: boolean;
    validate?: (value: (string | number)[] | undefined) => string | true;
    columns?: number;
    showSelectAll?: boolean;
}

export function CheckboxGroupInput<
    T,
    TFieldValues extends FieldValues = FieldValues
>({
    label,
    options,
    interfaceRef,
    required,
    errors,
    control,
    disabled = false,
    validate,
    columns,
    showSelectAll = false
}: CheckboxGroupInputProps<T, TFieldValues>) {
    return (
        <div className="form-control w-full">
            <div className="label">
                <span className="label-text">{label}</span>
            </div>
            <Controller
                name={interfaceRef}
                control={control}
                rules={{
                    required: required ? `${label} is required` : false,
                    validate: validate
                }}
                render={({ field }) => {
                    const allIds = options
                        .filter(
                            (opt): opt is T & { id: string | number } =>
                                typeof opt === 'object' &&
                                opt !== null &&
                                'id' in opt
                        )
                        .map((opt) => opt.id);
                    const currentValues = Array.isArray(field.value)
                        ? (field.value as (string | number)[])
                        : [];
                    const allSelected =
                        allIds.length > 0 &&
                        allIds.every((id) => currentValues.includes(id));

                    return (
                        <div>
                            {showSelectAll && allIds.length > 0 && (
                                <label className="flex flex-row gap-2 items-center py-1 cursor-pointer border-b border-base-300 mb-2 pb-2">
                                    <input
                                        type="checkbox"
                                        className="checkbox checkbox-sm"
                                        checked={allSelected}
                                        onChange={() =>
                                            field.onChange(
                                                allSelected ? [] : allIds
                                            )
                                        }
                                        disabled={disabled}
                                    />
                                    <span className="body font-medium">
                                        Select All
                                    </span>
                                </label>
                            )}
                            <div
                                className={
                                    columns
                                        ? `grid grid-cols-1 md:grid-cols-${columns} gap-x-4 gap-y-2`
                                        : ''
                                }
                            >
                                {options.map((option: T) =>
                                    typeof option === 'object' &&
                                    option !== null &&
                                    option !== undefined &&
                                    'id' in option &&
                                    'name' in option ? (
                                        <label
                                            key={option.id as string | number}
                                            className="flex flex-row gap-2 items-center py-1 cursor-pointer"
                                        >
                                            <input
                                                type="checkbox"
                                                className="checkbox checkbox-sm"
                                                checked={currentValues.includes(
                                                    option.id as string | number
                                                )}
                                                onChange={(e) => {
                                                    if (e.target.checked) {
                                                        field.onChange([
                                                            ...currentValues,
                                                            option.id
                                                        ]);
                                                    } else {
                                                        field.onChange(
                                                            currentValues.filter(
                                                                (
                                                                    v:
                                                                        | string
                                                                        | number
                                                                ) =>
                                                                    v !==
                                                                    option.id
                                                            )
                                                        );
                                                    }
                                                }}
                                                disabled={disabled}
                                            />
                                            <span className="body">
                                                {option.name as string}
                                            </span>
                                        </label>
                                    ) : null
                                )}
                            </div>
                        </div>
                    );
                }}
            />
            <div className="text-error text-sm">
                {errors[interfaceRef]?.message as string}
            </div>
        </div>
    );
}
