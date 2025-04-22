import { Controller, Control, FieldErrors } from 'react-hook-form';
import Select, {
    StylesConfig,
    GroupBase,
    CSSObjectWithLabel
} from 'react-select';

export interface GenericOption<T> {
    value: T;
    label: string;
}

export function createOptions<T>(
    items: T[],
    formatter: (item: T) => string = String
): GenericOption<T>[] {
    return items.map((item) => ({
        value: item,
        label: formatter(item)
    }));
}

interface MulitSelectInputProps<T> {
    name: string;
    label: string;
    control: Control<any>; // eslint-disable-line
    required?: boolean;
    optionList: T[];
    rules?: object;
    placeholder?: string;
    isMulti?: boolean;
    formatter?: (item: T) => string;
    errors?: FieldErrors<any>; // eslint-disable-line
    preformattedOptions?: boolean;
    onChangeOverride?: (selected: any, allOptions: GenericOption<T>[]) => any; // eslint-disable-line
}

export function MultiSelectInput<T>({
    name,
    label,
    control,
    required = false,
    optionList: optionList,
    rules,
    placeholder = 'Select...',
    isMulti = false,
    formatter,
    errors,
    preformattedOptions,
    onChangeOverride
}: MulitSelectInputProps<T>) {
    const allRules = {
        ...(rules ?? {}),
        ...(required && {
            required: `${label} is required`
        })
    };

    const labelFormatter = formatter
        ? formatter
        : (val: T) =>
              typeof val === 'string' ? val.replace(/_/g, ' ') : String(val);
    const options = preformattedOptions
        ? (optionList as GenericOption<T>[])
        : createOptions(optionList, labelFormatter);

    const defaultStyles: StylesConfig<
        GenericOption<T>,
        boolean,
        GroupBase<GenericOption<T>>
    > = {
        control: (provided, state) => ({
            ...provided,
            backgroundColor: 'var(--base-100)',
            color: 'var(--body-text)',
            border: '1px solid var(--grey-1)',
            borderRadius: '0.375rem',
            minHeight: '42px',
            boxShadow: state.isFocused ? '0 0 0 2px var(--grey-1)' : 'none',
            transition: 'all 0.2s ease-in-out',
            '&:hover': {
                borderColor: 'var(--grey-3)'
            }
        }),
        input: (provided: CSSObjectWithLabel) => ({
            ...provided,
            color: 'var(--body-text)',
            outline: 'none',
            backgroundColor: 'var(--base-100)',
            boxShadow: 'var(--base-100)'
        }),
        singleValue: (provided: CSSObjectWithLabel) => ({
            ...provided,
            color: 'var(--body-text)'
        }),
        multiValue: (provided: CSSObjectWithLabel) => ({
            ...provided,
            backgroundColor: 'var(--grey-1)'
        }),
        valueContainer: (provided) => ({
            ...provided,
            backgroundColor: 'var(--base-100)'
        }),
        multiValueLabel: (provided: CSSObjectWithLabel) => ({
            ...provided,
            color: 'var(--body-text)'
        }),
        multiValueRemove: (provided: CSSObjectWithLabel) => ({
            ...provided,
            color: 'var(--body-text)',
            ':hover': {
                backgroundColor: 'var(--grey-2)',
                color: 'black'
            }
        }),
        menu: (provided) => ({
            ...provided,
            backgroundColor: 'var(--base-100)',
            border: '1px solid var(--grey-1)',
            boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)'
        }),
        menuList: (provided) => ({
            ...provided,
            backgroundColor: 'var(--inner-background)'
        }),
        option: (provided, state) => ({
            ...provided,
            backgroundColor: state.isSelected
                ? 'var(--grey-3)'
                : state.isFocused
                  ? 'var(--grey-1)'
                  : 'var(--base-100) !important',
            color: 'var(--body-text)',
            cursor: 'pointer'
        }),
        placeholder: (provided: CSSObjectWithLabel) => ({
            ...provided,
            color: 'var(--grey-3)'
        })
    };

    return (
        <div>
            <label className="block font-medium mb-1">{label}</label>
            <Controller
                control={control}
                name={name}
                rules={allRules}
                render={({ field }) => (
                    <Select
                        {...field}
                        isMulti={isMulti}
                        options={options}
                        placeholder={placeholder}
                        styles={defaultStyles}
                        onChange={(selected) => {
                            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                            const resolved = onChangeOverride
                                ? onChangeOverride(selected, options)
                                : selected;
                            field.onChange(resolved);
                        }}
                    />
                )}
            />
            {errors && (
                <p className="text-error text-sm">
                    {errors[name]?.message as string}
                </p>
            )}
        </div>
    );
}
