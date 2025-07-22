import React from 'react';
import { UseFormRegister, Validate } from 'react-hook-form';

import { FieldValues } from 'react-hook-form';

interface TextProps<T extends FieldValues> {
    label?: string;
    interfaceRef: string;
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
}

// Generic component to keep types safe
export const TextInput = React.forwardRef<
    HTMLInputElement,
    TextProps<FieldValues>
>(
    ({
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
        inputClassName
    }) => {
        const options = {
            required: {
                value: required,
                message: `${label} is required`
            },
            ...(length && {
                maxLength: {
                    value: length,
                    message: `${label} should be ${length} characters or less`
                }
            }),
            ...(pattern && { pattern }),
            ...(validate && { validate })
        };

        const registerProps = register(interfaceRef, options);
        const {
            onChange: rhfOnChange,
            ref: registerRef,
            ...restRegisterProps
        } = registerProps;

        return (
            <label className="form-control">
                {label && (
                    <div className="label">
                        <span className="label-text">{label}</span>
                    </div>
                )}
                <input
                    ref={registerRef}
                    type={password ? 'password' : 'text'}
                    className={`input input-bordered w-full ${inputClassName}`}
                    {...restRegisterProps}
                    autoComplete={autoComplete}
                    defaultValue={defaultValue}
                    autoFocus={isFocused}
                    disabled={disabled}
                    placeholder={placeholder}
                    onChange={(event) => {
                        void rhfOnChange(event);
                        if (onChange) onChange(event);
                    }}
                />
            </label>
        );
    }
);
