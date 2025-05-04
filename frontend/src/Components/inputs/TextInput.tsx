import { FieldErrors, UseFormRegister, Validate } from 'react-hook-form';
import { Pattern } from '../modals';

interface TextProps {
    label?: string;
    interfaceRef: string;
    required?: boolean;
    length: number | undefined;
    errors: FieldErrors<any>; // eslint-disable-line
    register: UseFormRegister<any>; // eslint-disable-line
    password?: boolean;
    isFocused?: boolean;
    autoComplete?: string;
    pattern?: Pattern;
    validate?:
        | Validate<any, any> // eslint-disable-line @typescript-eslint/no-explicit-any
        | Record<string, Validate<any, any>>; // eslint-disable-line @typescript-eslint/no-explicit-any
    disabled?: boolean;
    defaultValue?: string;
    onChange?: React.ChangeEventHandler<HTMLInputElement>;
    isValidDoc?: boolean;
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
    pattern,
    validate,
    disabled = false,
    defaultValue,
    onChange
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
        ...(pattern && { pattern }),
        ...(validate && { validate })
    };
    const registerProps = register(interfaceRef, options);
    const { onChange: rhfOnChange, ...restRegisterProps } = registerProps;
    return (
        <label className="form-control">
            {label && (
                <div className="label">
                    <span className="label-text">{label}</span>
                </div>
            )}

            <input
                type={`${password ? 'password' : 'text'}`}
                className={`input input-bordered w-full`}
                {...restRegisterProps}
                autoComplete={autoComplete}
                defaultValue={defaultValue}
                autoFocus={isFocused}
                disabled={disabled}
                onChange={(e) => {
                    if (rhfOnChange) void rhfOnChange(e);
                    if (onChange) void onChange(e);
                }}
            />
            <div className="text-error text-sm">
                {errors[interfaceRef]?.message as string}
            </div>
        </label>
    );
}
