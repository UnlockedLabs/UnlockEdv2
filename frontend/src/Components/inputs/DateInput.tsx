import React from 'react';
import {
    FieldErrors,
    UseFormGetValues,
    UseFormRegister,
    Validate
} from 'react-hook-form';

interface DateProps {
    allowPastDate?: boolean;
    label: string;
    interfaceRef: string;
    required?: boolean;
    errors: FieldErrors<any>; // eslint-disable-line
    register: UseFormRegister<any>; // eslint-disable-line
    getValues?: UseFormGetValues<any>; // eslint-disable-line
    password?: boolean;
    isFocused?: boolean;
    validate?:
        | Validate<any, any> // eslint-disable-line @typescript-eslint/no-explicit-any
        | Record<string, Validate<any, any>>; // eslint-disable-line @typescript-eslint/no-explicit-any
    disabled?: boolean;
    monthOnly?: boolean;
    defaultValue?: string;
    onChange?: (value: string) => void;
}

export function DateInput({
    allowPastDate = false,
    label,
    interfaceRef,
    required = false,
    errors,
    register,
    getValues,
    isFocused = false,
    validate,
    disabled = false,
    monthOnly = false,
    defaultValue = '',
    onChange
}: DateProps) {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const validateRules: Record<string, Validate<any, any>> = {}; // eslint-disable-line @typescript-eslint/no-explicit-any

    if (!monthOnly && !allowPastDate && !disabled) {
        validateRules.noPast = (userVal: string) => {
            if (userVal === '') {
                return;
            }
            const [year, month, day] = userVal.split('-').map(Number);
            const selected = new Date(year, month - 1, day);
            return selected >= now || `${label} cannot be in the past`;
        };
    }

    if (interfaceRef === 'end_dt' && getValues) {
        validateRules.afterStart = (endVal: string) => {
            const startVal = getValues('start_dt'); // eslint-disable-line
            if (!startVal || !endVal) return true;

            if (monthOnly) {
                return (
                    endVal >= startVal || `${label} cannot be before start date`
                );
            } else {
                const [sYear, sMonth, sDay] = startVal.split('-').map(Number); // eslint-disable-line
                const [eYear, eMonth, eDay] = endVal.split('-').map(Number);
                const start = new Date(sYear, sMonth - 1, sDay); // eslint-disable-line
                const end = new Date(eYear, eMonth - 1, eDay);
                return end >= start || `${label} cannot be before start date`;
            }
        };
    }

    if (validate) {
        Object.assign(
            validateRules,
            typeof validate === 'function' ? { custom: validate } : validate
        );
    }
    const options = {
        required: {
            value: required,
            message: `${label} is required`
        },
        validate:
            Object.keys(validateRules).length > 0 ? validateRules : undefined
    };

    // Get register function and separate onChange handling
    const registerProps = register(interfaceRef, options);

    // Cross-browser date change handler (inspired by SimpleCalendar)
    const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;

        // Call react-hook-form's onChange first to update form state
        // Use void to ignore the promise return value
        void registerProps.onChange(e);

        // Then call custom onChange if provided
        if (onChange) {
            onChange(value);
        }
    };

    const inputType = monthOnly ? 'month' : 'date';

    return (
        <label className="form-control">
            <div className="label">
                <span className="label-text">{label}</span>
            </div>
            <input
                type={inputType}
                defaultValue={defaultValue}
                className={`input input-bordered w-full`}
                {...registerProps}
                autoFocus={isFocused}
                disabled={disabled}
                onChange={handleDateChange}
            />
            <div className="text-error text-sm">
                {errors[interfaceRef]?.message as string}
            </div>
        </label>
    );
}
