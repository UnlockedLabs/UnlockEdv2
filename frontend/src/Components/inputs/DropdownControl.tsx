import { Dispatch, SetStateAction } from 'react';

interface DropdownControlProps {
    value?: any; // eslint-disable-line
    setState?: Dispatch<SetStateAction<any>>; // eslint-disable-line
    customCallback?: (value: string) => void;
    enumType: Record<string, string>;
    small?: boolean;
}

/* a dropdown that executes a callback function on change */
export default function DropdownControl({
    value,
    setState: callback,
    customCallback,
    enumType,
    small
}: DropdownControlProps) {
    return (
        <label className="form-control">
            <select
                value={value} // eslint-disable-line
                className={`select select-bordered ${small ? 'select-sm text-xs' : ''}`}
                onChange={(e) => {
                    if (callback) {
                        callback(e.target.value);
                    }
                    if (customCallback) {
                        customCallback(e.target.value);
                    }
                }}
            >
                {Object.entries(enumType).map(([key, value]) => (
                    <option key={key} value={value}>
                        {key}
                    </option>
                ))}
            </select>
        </label>
    );
}
