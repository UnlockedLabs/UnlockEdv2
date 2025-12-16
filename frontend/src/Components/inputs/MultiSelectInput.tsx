import { Controller, Control, FieldErrors } from 'react-hook-form';
import Select from 'react-select';
import { getDefaultSelectStyles } from '@/Components/helperFunctions/selectStyles';

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

    const defaultStyles = getDefaultSelectStyles<GenericOption<T>, boolean>();

    return (
        <div>
            <label className="form-control">
                <div className="label">
                    <span className="label-text">{label}</span>
                </div>
            </label>
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
