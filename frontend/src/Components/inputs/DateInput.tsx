import { FieldErrors, UseFormRegister, Validate } from 'react-hook-form';

interface DateProps {
    allowPastDate?: boolean;
    label: string;
    interfaceRef: string;
    required?: boolean;
    errors: FieldErrors<any>; // eslint-disable-line
    register: UseFormRegister<any>; // eslint-disable-line
    password?: boolean;
    isFocused?: boolean;
    validate?:
        | Validate<any, any> // eslint-disable-line @typescript-eslint/no-explicit-any
        | Record<string, Validate<any, any>>; // eslint-disable-line @typescript-eslint/no-explicit-any
    disabled?: boolean;
}
export function DateInput({
    allowPastDate = false,
    label,
    interfaceRef,
    required = false,
    errors,
    register,
    isFocused = false,
    validate,
    disabled = false
}: DateProps) {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const validateRules: Record<string, Validate<any, any>> = {}; // eslint-disable-line @typescript-eslint/no-explicit-any
    if (!allowPastDate) {
        validateRules.noPast = (userVal: string) => {
            const [year, month, day] = userVal.split('-').map(Number);
            const selected = new Date(year, month - 1, day);
            return selected >= now || `${label} cannot be in the past`;
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
    return (
        <label className="form-control">
            <div className="label">
                <span className="label-text">{label}</span>
            </div>
            <input
                type="date"
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
