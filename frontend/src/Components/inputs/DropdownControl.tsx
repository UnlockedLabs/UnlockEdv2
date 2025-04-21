import { Dispatch, SetStateAction } from 'react';

interface DropdownControlProps {
    label?: string;
    setState?: Dispatch<SetStateAction<any>>; // eslint-disable-line
    customCallback?: (value: string) => void;
    enumType: Record<string, string>;
}

/* a dropdown that executes a callback function on change */
export default function DropdownControl({
    label,
    setState: callback,
    customCallback,
    enumType
}: DropdownControlProps) {
    return (
        <label className="form-control">
            <select
                defaultValue={label}
                className="select select-bordered"
                onChange={(e) => {
                    if (callback) {
                        callback(e.target.value);
                    }
                    if (customCallback) {
                        customCallback(e.target.value);
                    }
                }}
            >
                {label && (
                    <option value="" disabled>
                        {label}
                    </option>
                )}
                {Object.entries(enumType).map(([key, value]) => (
                    <option key={key} value={value}>
                        {key}
                    </option>
                ))}
            </select>
        </label>
    );
}
