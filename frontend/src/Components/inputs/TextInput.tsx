import { FieldErrors, UseFormRegister } from 'react-hook-form';

interface TextProps {
    label: string;
    interfaceRef: string;
    required: boolean;
    length: number | undefined;
    errors: FieldErrors<any>; // eslint-disable-line
    register: UseFormRegister<any>; // eslint-disable-line
    password?: boolean;
    isFocused?: boolean;
    autoComplete?: string;
}

export function TextInput({
    label,
    interfaceRef,
    required,
    length,
    errors,
    register,
    password = false,
    isFocused = false,
    autoComplete = 'on'
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
        // Adding pattern validation only for fields that should allow spaces (username, name_first, name_last)
        ...(interfaceRef === 'username' ||
        interfaceRef === 'name_first' ||
        interfaceRef === 'name_last'
            ? {
                  pattern: {
                      value: /^[\w\s]+$/,
                      message: `${label} must contain only letters, numbers, or spaces`
                  }
              }
            : {})
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
                {errors[interfaceRef]?.message?.toString()}
            </div>
        </label>
    );
}
