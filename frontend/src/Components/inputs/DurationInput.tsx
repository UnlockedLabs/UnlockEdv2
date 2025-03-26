import { FieldErrors, UseFormRegister, Validate } from 'react-hook-form';

interface DurationProps {
    isMonthsWeeks?: boolean;
    label: string;
    interfaceRef: string;
    interfaceRefUnit: string;
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
export function DurationInput({
    isMonthsWeeks = false,
    label,
    interfaceRef,
    interfaceRefUnit,
    required = false,
    length,
    errors,
    register,
    isFocused = false,
    validate,
    disabled = false
}: DurationProps) {
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
            <div className="flex items-center gap-2">
                <input
                    type="number"
                    min={1}
                    step={1}
                    className={`input input-bordered w-full`}
                    {...register(interfaceRef, {
                        ...options,
                        min: {
                            value: 1,
                            message: `${label} must be at least 1`
                        }
                    })}
                    autoFocus={isFocused}
                    disabled={disabled}
                />
                <select
                    className="select select-bordered w-28"
                    {...register(interfaceRefUnit)}
                >
                    {isMonthsWeeks ? (
                        <>
                            <option value="mo">Months</option>
                            <option value="w">Weeks</option>
                            <option value="h">Hours</option>
                        </>
                    ) : (
                        <>
                            <option value="h">Hours</option>
                            <option value="m">Minutes</option>
                        </>
                    )}
                </select>
            </div>
            <div className="text-error text-sm">
                {errors[interfaceRef]?.message as string}
            </div>
        </label>
    );
}
