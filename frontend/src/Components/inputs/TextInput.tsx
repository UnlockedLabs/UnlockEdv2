import { FieldErrors, UseFormRegister } from 'react-hook-form';

interface TextProps {
    label: string;
    interfaceRef: string;
    required?: boolean;
    length: number | undefined;
    errors: FieldErrors<any>; // eslint-disable-line
    register: UseFormRegister<any>; // eslint-disable-line
    password?: boolean;
    isFocused?: boolean;
    autoComplete?: string;
    pattern?: {
        value: RegExp;
        message: string;
    };
}
export function TextInput({
    label,
    interfaceRef,
    required = false,
    length,
    errors,
    register,
    password = false,
    isFocused = false,
    autoComplete = 'on',
    pattern
}: TextProps) {
    const options = {
        required: {
            value: required,
            message: `${label} is required`
        },
        ...(length && {
            maxLength: {
                value: length,
                message: `${label} should be ${length} characters or less`
            }
        }),
        ...(pattern && { pattern })
    };
    return (
        <label className="form-control">
            <div className="label">
                <span className="label-text">{label}</span>
            </div>
            <input
                type={`${password ? 'password' : 'text'}`}
                className="input input-bordered w-full"
                {...register(interfaceRef, options)}
                autoComplete={autoComplete}
                autoFocus={isFocused}
            />
            <div className="text-error text-sm">
                {errors[interfaceRef]?.message as string}
            </div>
        </label>
    );
}
