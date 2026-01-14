import { StylesConfig, GroupBase, CSSObjectWithLabel } from 'react-select';

export function getDefaultSelectStyles<
    T,
    IsMulti extends boolean = false
>(): StylesConfig<T, IsMulti, GroupBase<T>> {
    return {
        control: (provided, state) => ({
            ...provided,
            backgroundColor: 'var(--base-100)',
            color: 'var(--body-text)',
            border: '1px solid var(--grey-1)',
            borderRadius: '0.375rem',
            minHeight: '42px',
            boxShadow: state.isFocused ? '0 0 0 2px var(--grey-1)' : 'none',
            outline: 'none',
            cursor: 'pointer',
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
}
