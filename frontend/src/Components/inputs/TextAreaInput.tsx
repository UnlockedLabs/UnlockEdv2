import { FieldErrors } from 'react-hook-form';

interface TextAreaProps {
    label: string;
    interfaceRef: string;
    required: boolean;
    length: number | null;
    errors: FieldErrors<any>;
    register: Function;
}

export function TextAreaInput({
    label,
    interfaceRef,
    required,
    length,
    errors,
    register
}: TextAreaProps) {
    const options = {
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
    return (
        <label className="form-control">
            <div className="label">
                <span className="label-text">{label}</span>
            </div>
            <textarea
                className="textarea textarea-bordered w-full"
                {...register(interfaceRef, options)}
            />
            <div className="text-error text-sm">
                {errors[interfaceRef]?.message?.toString()}
            </div>
        </label>
    );
}
