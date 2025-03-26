import { FieldErrors, UseFormRegister, Validate } from 'react-hook-form';

interface NumberProps {
    label: string;
    interfaceRef: string;
    required?: boolean;
    length: number | undefined;
    errors: FieldErrors<any>; // eslint-disable-line
    register: UseFormRegister<any>; // eslint-disable-line
    isFocused?: boolean;
    validate?:
        | Validate<any, any> // eslint-disable-line @typescript-eslint/no-explicit-any
        | Record<string, Validate<any, any>>; // eslint-disable-line @typescript-eslint/no-explicit-any
    disabled?: boolean;
}
export function NumberInput({
    label,
    interfaceRef,
    required = false,
    length,
    errors,
    register,
    isFocused = false,
    validate,
    disabled = false
}: NumberProps) {
    const min = required ? 1 : 0;
    const options = {
        required: {
            value: required,
            message: `${label} is required`
        },
        ...(length && {
            maxLength: {
                value: length,
                message: `${label} should be ${length} digits or less`
            }
        }),
        ...(validate && { validate })
    };
    return (
        <label className="form-control">
            <div className="label">
                <span className="label-text">{label}</span>
            </div>
            <input
                type="number"
                min={min}
                step={1}
                className={`input input-bordered w-full`}
                {...register(interfaceRef, {
                    ...options,
                    min: {
                        value: min,
                        message: `${label} must be at least 1`
                    }
                })}
                autoFocus={isFocused}
                disabled={disabled}
            />
            <div className="text-error text-sm">
                {errors[interfaceRef]?.message as string}
            </div>
        </label>
    );
}
