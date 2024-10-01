import { FieldErrors } from 'react-hook-form';

interface DropdownProps {
    label: string;
    interfaceRef: string;
    required: boolean;
    errors: FieldErrors<any>; // eslint-disable-line
    register: Function; // eslint-disable-line
    enumType: { [key: string]: string };
}

export function DropdownInput({
    label,
    interfaceRef,
    required,
    errors,
    register,
    enumType
}: DropdownProps) {
    return (
        <label className="form-control w-full">
            <div className="label">
                <span className="label-text">{label}</span>
            </div>
            <select
                className="select select-bordered"
                {...register(interfaceRef, {
                    required: {
                        value: required,
                        message: `${label} is required`
                    }
                })}
            >
                {Object.entries(enumType).map(([key, value]) => (
                    <option key={key} value={value}>
                        {value}
                    </option>
                ))}
            </select>
            <div className="text-error text-sm">
                {errors[interfaceRef]?.message?.toString()}
            </div>
        </label>
    );
}
