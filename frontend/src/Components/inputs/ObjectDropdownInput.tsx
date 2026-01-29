import { FieldErrors, UseFormRegister } from 'react-hook-form';

export interface ObjectDropdownInputProps<T> {
    label: string;
    interfaceRef: string;
    required: boolean;
    errors: FieldErrors<any>; // eslint-disable-line
    register: UseFormRegister<any>; // eslint-disable-line
    options: T[];
    valueKey: keyof T;
    labelKey?: keyof T;
    labelFn?: (option: T) => string;
    disabled?: boolean;
    isLoading?: boolean;
    placeholder?: string;
    validation?: {
        required?: string;
        validate?: (value: unknown) => string | boolean | undefined;
    };
    filterFn?: (option: T) => boolean;
    className?: string;
}

export function ObjectDropdownInput<T>({
    label,
    interfaceRef,
    required,
    errors,
    register,
    options,
    valueKey,
    labelKey,
    labelFn,
    disabled = false,
    isLoading = false,
    placeholder,
    validation,
    filterFn,
    className = ''
}: ObjectDropdownInputProps<T>) {
    const filteredOptions = filterFn ? options.filter(filterFn) : options;

    const getDisplayLabel = (option: T): string => {
        if (labelFn) {
            const result = labelFn(option);
            // Handle null/undefined/empty string results
            return result?.trim() || 'No label';
        }
        if (labelKey) {
            const value = option[labelKey];
            return String(value ?? '').trim() || 'No label';
        }
        const value = option[valueKey];
        return String(value ?? '').trim() || 'No label';
    };

    return (
        <label className={`form-control w-full ${className}`}>
            <div className="label">
                <span className="label-text font-medium">{label}</span>
                {required && (
                    <span className="label-text-alt text-error">*</span>
                )}
            </div>
            <select
                className={`select select-bordered w-full ${
                    errors[interfaceRef] ? 'select-error' : ''
                }`}
                disabled={disabled || isLoading}
                {...register(interfaceRef, {
                    required:
                        validation?.required ??
                        (required ? `${label} is required` : false),
                    valueAsNumber: typeof valueKey === 'number',
                    validate: validation?.validate
                })}
            >
                <option value="">
                    {placeholder ?? `Select ${label.toLowerCase()}`}
                </option>
                {filteredOptions.map((option) => {
                    const optionValue = option[valueKey];
                    return (
                        <option
                            key={String(optionValue ?? '')}
                            value={String(optionValue ?? '')}
                        >
                            {getDisplayLabel(option)}
                        </option>
                    );
                })}
            </select>
            {isLoading && (
                <span className="loading loading-spinner loading-sm mt-2"></span>
            )}
            {errors[interfaceRef] && (
                <div className="label">
                    <span className="label-text-alt text-error">
                        {errors[interfaceRef]?.message as string}
                    </span>
                </div>
            )}
        </label>
    );
}
