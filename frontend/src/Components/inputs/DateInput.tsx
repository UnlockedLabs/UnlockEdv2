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
    monthOnly = false
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

    const inputType = monthOnly ? 'month' : 'date';

    return (
        <label className="form-control">
            <div className="label">
                <span className="label-text">{label}</span>
            </div>
            <input
                type={inputType}
                className={`input input-bordered w-full`}
                {...register(interfaceRef, options)}
                autoFocus={isFocused}
                disabled={disabled}
            />
            <div className="text-error text-sm">
                {errors[interfaceRef]?.message as string}
            </div>
        </label>
    );
}
