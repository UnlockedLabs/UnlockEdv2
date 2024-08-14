import { FieldErrors } from 'react-hook-form';

interface TextProps {
    label: string;
    interfaceRef: string;
    required: boolean;
    length: number | null;
    errors: FieldErrors<any>;
    register: Function;
    password?: boolean;
    isFocused?: boolean;
    autoComplete?: string;
    validationRules?: Record<string, any>;
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
    autoComplete = 'on',
    validationRules,
}: TextProps) {
    let options = {
        required: {
            value: required,
            message: `${label} is required`
        },
        ...(length !== null && {
            maxLength: {
                value: length,
                message: `${label} should be ${length} characters or less`
            }
        })
    };
    if(validationRules) {
        options = { ...options, ...validationRules };
    }
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
