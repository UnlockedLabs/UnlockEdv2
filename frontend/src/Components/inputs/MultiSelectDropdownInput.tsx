import { FieldErrors, UseFormRegister } from 'react-hook-form';

interface MultiSelectDropdownProps<T> {
    label: string;
    options: T[];
    interfaceRef: string;
    required: boolean;
    errors: FieldErrors<any>; // eslint-disable-line
    register: UseFormRegister<any>; // eslint-disable-line
    disabled?: boolean;
}

export function MultiSelectDropdownInput<T>({
    label,
    options,
    interfaceRef,
    required,
    errors,
    register,
    disabled = false
}: MultiSelectDropdownProps<T>) {
    return (
        <label className="form-control w-full">
            <div className="label">
                <span className="label-text">{label}</span>
            </div>
            {options.map((option: T, index) =>
                typeof option === 'object' &&
                option !== null &&
                option !== undefined &&
                'id' in option &&
                'name' in option ? (
                    <div
                        key={index}
                        className="flex flex-row gap-2 items-center py-1"
                    >
                        <input
                            {...register(interfaceRef, { required })}
                            type="checkbox"
                            className="checkbox checkbox-sm"
                            value={option.id as number}
                            disabled={disabled}
                        />
                        <p className="body">{option.name as string}</p>
                    </div>
                ) : null
            )}
            <div className="text-error text-sm">
                {errors[interfaceRef]?.message as string}
            </div>
        </label>
    );
}
