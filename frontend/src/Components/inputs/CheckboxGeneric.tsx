interface CheckboxProps {
    name: string;
    label: string;
    checked: boolean | undefined;
    onChange: (checked: boolean, which: string) => void;
}

export default function CheckboxGeneric({
    name,
    label,
    checked,
    onChange
}: CheckboxProps) {
    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        onChange(event.target.checked, name);
    };

    return (
        <div>
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
