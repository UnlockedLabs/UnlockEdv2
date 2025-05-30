import {
    FieldErrors,
    UseFormGetValues,
    UseFormRegister,
    Validate
} from 'react-hook-form';

interface TimeProps {
    label: string;
    interfaceRef: string;
    required?: boolean;
    errors: FieldErrors<any>; // eslint-disable-line
    register: UseFormRegister<any>; // eslint-disable-line
    getValues?: UseFormGetValues<any>; // eslint-disable-line
    validate?: Validate<any, any> | Record<string, Validate<any, any>>; // eslint-disable-line @typescript-eslint/no-explicit-any
    disabled?: boolean;
}

export function TimeInput({
    label,
    interfaceRef,
    required = false,
    errors,
    register,
    getValues,
    validate,
    disabled = false
}: TimeProps) {
    const validateRules: Record<string, Validate<any, any>> = {}; // eslint-disable-line @typescript-eslint/no-explicit-any

    if (interfaceRef === 'end_time' && getValues) {
        validateRules.afterStart = (endVal: string) => {
            const startVal = getValues('start_time'); // eslint-disable-line
            if (!startVal || !endVal) return true;

            const [startHour, startMin] = startVal.split(':').map(Number); // eslint-disable-line
            const [endHour, endMin] = endVal.split(':').map(Number);

            const start = startHour * 60 + startMin; // eslint-disable-line
            const end = endHour * 60 + endMin;

            return end > start || `${label} must be after start time`;
        };
    }

    if (validate) {
        Object.assign(
            validateRules,
            typeof validate === 'function' ? { custom: validate } : validate
        );
    }

    const options = {
        required: {
            value: required,
            message: `${label} is required`
        },
        validate:
            Object.keys(validateRules).length > 0 ? validateRules : undefined
    };

    return (
        <label className="form-control">
            <div className="label">
                <span className="label-text">{label}</span>
            </div>
            <input
                type="time"
                className="input input-bordered w-full"
                {...register(interfaceRef, options)}
                disabled={disabled}
            />
            <div className="text-error text-sm">
                {errors[interfaceRef]?.message as string}
            </div>
        </label>
    );
}
