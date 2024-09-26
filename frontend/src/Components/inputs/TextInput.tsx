import { FieldErrors } from 'react-hook-form';

interface TextProps {
    label: string;
    interfaceRef: string;
    required: boolean;
    length: number | null;
    errors: FieldErrors<any>; // eslint-disable-line
    register: Function; // eslint-disable-line
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
        })
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
