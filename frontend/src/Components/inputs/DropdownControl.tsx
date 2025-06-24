import { Dispatch, SetStateAction } from 'react';

interface DropdownControlProps {
    value?: any; // eslint-disable-line
    setState?: Dispatch<SetStateAction<string>>;
    customCallback?: (value: string) => void;
    enumType: Record<string, string>;
}

/* a dropdown that executes a callback function on change */
export default function DropdownControl({
    value,
    setState: callback,
    customCallback,
    enumType
}: DropdownControlProps) {
    return (
        <label className="form-control">
            <select
                value={value} // eslint-disable-line
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
                {Object.entries(enumType).map(([key, value]) => (
                    <option key={key} value={value}>
                        {key}
                    </option>
                ))}
            </select>
        </label>
    );
}
