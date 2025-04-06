import { Dispatch, SetStateAction } from 'react';

interface DropdownControlProps {
    label?: string;
    /**
     * Optional attribute is used for enabling the lable for being the first item displayed in the list
     */
    useLabel?: boolean;
    setState?: Dispatch<SetStateAction<string>>;
    customCallback?: (value: string) => void;
    enumType: Record<string, string>;
}

/* a dropdown that executes a callback function on change */
export default function DropdownControl({
    label,
    setState: callback,
    customCallback,
    enumType,
    useLabel = false
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
                {label && !useLabel ? (
                    <option value="" disabled>
                        {label}
                    </option>
                ) : label && useLabel ? (
                    <option value={label}>{label}</option>
                ) : (
                    ''
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
