import { Dispatch, SetStateAction } from 'react';
import { Option } from '@/common';

interface DropdownControlProps {
    value?: any; // eslint-disable-line
    setState?: Dispatch<SetStateAction<any>>; // eslint-disable-line
    customCallback?: (value: string) => void;
    enumType: Record<string, string> | Option[];
    small?: boolean;
    blockedDefault?: boolean;
}

/* a dropdown that executes a callback function on change */
export default function DropdownControl({
    value,
    setState: callback,
    customCallback,
    enumType,
    small,
    blockedDefault = false
}: DropdownControlProps) {
    const isOptionArray = Array.isArray(enumType);
    return (
        <label className="form-control">
            <select
                value={value} // eslint-disable-line
                className={`select select-bordered ${small ? 'select-sm text-xs' : ''}`}
                onChange={(e) => {
                    callback?.(e.target.value);
                    customCallback?.(e.target.value);
                }}
            >
                {blockedDefault && (
                    <option value="" disabled>
                        Select option
                    </option>
                )}
                {isOptionArray
                    ? enumType.map((option) => (
                          <option key={option.key} value={option.key}>
                              {option.value}
                          </option>
                      ))
                    : Object.entries(enumType).map(([key, value]) => (
                          <option key={key} value={value}>
                              {key}
                          </option>
                      ))}
            </select>
        </label>
    );
}
