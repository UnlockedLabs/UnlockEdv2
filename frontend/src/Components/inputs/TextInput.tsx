import React from 'react';
import {
    UseFormRegister,
    Validate,
    FieldValues,
    Path,
    FieldErrors
} from 'react-hook-form';

interface TextProps<T extends FieldValues> {
    label?: string;
    interfaceRef: Path<T>; // Must be Path<T>
    required?: boolean;
    length?: number;
    register: UseFormRegister<T>;
    password?: boolean;
    isFocused?: boolean;
    autoComplete?: string;
    pattern?: RegExp;
    validate?: Validate<T, unknown> | Record<string, Validate<T, unknown>>;
    disabled?: boolean;
    defaultValue?: string;
    onChange?: React.ChangeEventHandler<HTMLInputElement>;
    placeholder?: string;
    inputClassName?: string;
    errors?: FieldErrors<T>;
}

export const TextInput = <T extends FieldValues>({
    label,
    interfaceRef,
    required = false,
    length,
    register,
    password = false,
    isFocused = false,
    autoComplete = 'on',
    pattern,
    validate,
    disabled = false,
    defaultValue,
    onChange,
    placeholder,
    inputClassName = '',
    errors
}: TextProps<T>) => {
    const options = {
        required: required
            ? {
                  value: true,
                  message: `${label ?? 'Field'} is required`
              }
            : false,
        ...(length !== undefined
            ? {
                  maxLength: {
                      value: length,
                      message: `${label ?? 'Field'} should be ${length} characters or less`
                  }
              }
            : {}),
        ...(pattern !== undefined ? { pattern } : {}),
        ...(validate !== undefined ? { validate } : {})
    };

    const registerProps = register(interfaceRef, options);
    const {
        onChange: rhfOnChange,
        ref: registerRef,
        ...restRegisterProps
    } = registerProps;

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
        void rhfOnChange(event);

        if (onChange) {
            onChange(event);
        }
    };

    return (
        <label className="form-control">
            {label && (
                <div className="label">
                    <span className="label-text">{label}</span>
                </div>
            )}
            <input
                {...restRegisterProps}
                ref={registerRef}
                type={password ? 'password' : 'text'}
                className={`input input-bordered w-full ${inputClassName}`}
                autoComplete={autoComplete}
                defaultValue={defaultValue}
                autoFocus={isFocused}
                disabled={disabled}
                placeholder={placeholder}
                onChange={handleChange}
            />
            {/* Display error message if present */}
            {errors && errors[interfaceRef] && (
                <div className="text-error text-sm mt-1">
                    {errors[interfaceRef]?.message?.toString()}
                </div>
            )}
        </label>
    );
};
