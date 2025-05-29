import { FieldErrors, UseFormRegister, Validate } from 'react-hook-form';

interface TextAreaProps {
    label: string;
    interfaceRef: string;
    required: boolean;
    length: number | undefined;
    errors: FieldErrors<any>; // eslint-disable-line
    register: UseFormRegister<any>; //eslint-disable-line
    validate?:
        | Validate<any, any> // eslint-disable-line @typescript-eslint/no-explicit-any
        | Record<string, Validate<any, any>>; // eslint-disable-line @typescript-eslint/no-explicit-any
    disabled?: boolean;
    placeholder?: string;
}

export function TextAreaInput({
    label,
    interfaceRef,
    required,
    length,
    errors,
    register,
    validate,
    disabled = false,
    placeholder
}: TextAreaProps) {
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
        ...(validate && { validate })
    };
    return (
        <label className="form-control">
            <div className="label">
                <span className="label-text">{label}</span>
            </div>
            <textarea
                className="textarea textarea-bordered w-full"
                {...register(interfaceRef, options)}
                disabled={disabled}
                placeholder={placeholder}
            />
            <div className="text-error text-sm">
                {errors[interfaceRef]?.message as string}
            </div>
        </label>
    );
}
