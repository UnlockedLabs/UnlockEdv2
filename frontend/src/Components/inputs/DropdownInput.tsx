import { FieldErrors, UseFormRegister } from 'react-hook-form';

interface DropdownProps {
    label: string;
    interfaceRef: string;
    required?: boolean; // Made required optional with boolean type
    errors: FieldErrors<any>; // eslint-disable-line
    register: UseFormRegister<any>; // eslint-disable-line
    enumType: Record<string, string>;
}

export function DropdownInput({
    label,
    interfaceRef,
    required = false, // Added default value
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
                    required: required && {
                        value: true,
                        message: `${label} is required`
                    }
                })}
            >
                <option value="">Select {label}</option>{' '}
                {/* Added default option */}
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
