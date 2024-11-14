import { ChangeEvent } from 'react';

interface CheckboxProps {
    name: string;
    label: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
}

export default function CheckboxGenric({
    name,
    label,
    checked,
    onChange
}: CheckboxProps) {
    const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
        onChange(event.target.checked);
    };

    return (
        <div className="form-control">
            <label className="label cursor-pointer gap-2">
                <input
                    name={name}
                    type="checkbox"
                    className="checkbox"
                    checked={checked}
                    onChange={handleChange}
                />
                {label}
            </label>
        </div>
    );
}
