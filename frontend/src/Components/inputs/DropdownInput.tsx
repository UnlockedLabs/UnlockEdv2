import { FieldErrors, UseFormRegister } from 'react-hook-form';

interface DropdownProps {
    label: string;
    interfaceRef: string;
    required: boolean;
    errors: FieldErrors<any>; // eslint-disable-line
    register: UseFormRegister<any>; // eslint-disable-line
    enumType: Record<string, string>;
    disabled?: boolean;
}

export function DropdownInput({
    label,
    interfaceRef,
    required,
    errors,
    register,
    enumType,
    disabled = false
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
                disabled={disabled}
            >
                {Object.entries(enumType).map(([key, value]) => (
                    <option key={key} value={value}>
                        {key}
                    </option>
                ))}
            </select>
            <div className="text-error text-sm">
                {errors[interfaceRef]?.message as string}
            </div>
        </label>
    );
}
