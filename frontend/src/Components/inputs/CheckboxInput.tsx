import { FieldErrors, UseFormRegister } from 'react-hook-form';

interface CheckboxInputProps {
    label: string;
    interfaceRef: string;
    required: boolean;
    errors: FieldErrors<any>; // eslint-disable-line
    register: UseFormRegister<any>; // eslint-disable-line
}

export function CheckboxInput({
    label,
    interfaceRef,
    required,
    errors,
    register
}: CheckboxInputProps) {
    return (
        <label className="form-control w-full">
            <div className="flex flex-row gap-2 items-center py-1">
                <input
                    {...register(interfaceRef, { required })}
                    type="checkbox"
                    className="checkbox checkbox-sm"
                />
                <div className="label">
                    <span className="label-text">{label}</span>
                </div>
            </div>
            <div className="text-error text-sm">
                {errors[interfaceRef]?.message as string}
            </div>
        </label>
    );
}
