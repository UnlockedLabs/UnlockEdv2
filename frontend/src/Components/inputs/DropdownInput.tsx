import { FieldErrors, UseFormRegister } from 'react-hook-form';

interface DropdownProps {
    label: string;
    interfaceRef: string;
    required: boolean;
    errors: FieldErrors<any>; // eslint-disable-line
    register: UseFormRegister<any>; // eslint-disable-line
    enumType: Record<string, string>;
    disabled?: boolean;
    onChange?: (event: React.ChangeEvent<HTMLSelectElement>) => void;
}

export function DropdownInput({
    label,
    interfaceRef,
    required,
    errors,
    register,
    enumType,
    disabled = false,
    onChange
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
                onChange={(e) => {
                    if (onChange) {
                        void register(interfaceRef).onChange(e);
                        if (typeof onChange === 'function') {
                            onChange(e);
                        }
                    }
                }}
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
