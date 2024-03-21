import { FieldErrors } from "react-hook-form";

interface TextProps {
    label: string;
    interfaceRef: string;
    required: boolean;
    length: number | null;
    errors: FieldErrors<any>;
    register: Function;
}

export default function TextInput({
    label,
    interfaceRef,
    required,
    length,
    errors,
    register,
}: TextProps) {
    const options = {
        required: {
            value: required,
            message: `${label} is required`,
        },
        ...(length !== null && {
            maxLength: {
                value: length,
                message: `${label} should be ${length} characters or less`,
            },
        }),
    };
    return (
        <label className="form-control">
            <div className="label">
                <span className="label-text">{label}</span>
            </div>
            <input
                type="text"
                className="input input-bordered w-full"
                {...register(interfaceRef, options)}
            />
            <div className="text-error text-sm">
                {errors[interfaceRef]?.message?.toString()}
            </div>
        </label>
    );
}
