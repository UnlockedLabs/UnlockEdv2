import { Option } from '@/common';
import { useRef, useState } from 'react';

interface MultiSelectDropdownProps {
    label?: string;
    options: Option[];
    selectedOptions: number[];
    addSelectAllOption?: boolean;
    onSelectionChange: (selected: number[]) => void;
    onBlurSearch: () => void;
}

export default function MultiSelectDropdown({
    label,
    options,
    selectedOptions,
    onSelectionChange,
    onBlurSearch
}: MultiSelectDropdownProps) {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const toggleDropdown = () => setIsOpen(!isOpen);
    const handleCheckboxChange = (key: number) => {
        const updatedSelection = selectedOptions.includes(key)
            ? selectedOptions.filter((item) => item !== key)
            : [...selectedOptions, key];
        onSelectionChange(updatedSelection);
    };
    const displayText = () => {
        if (selectedOptions.length === 1) {
            return (
                options.find((option) => option.key === selectedOptions[0])
                    ?.value ?? label
            );
        }
        if (selectedOptions.length === options.length) {
            return `All ${label}`;
        }
        if (selectedOptions.length > 1) {
            return `${selectedOptions.length} selected`;
        }
        return label;
    };
    const handleBlur = (event: React.FocusEvent<HTMLDivElement>) => {
        if (!dropdownRef.current?.contains(event.relatedTarget as Node)) {
            onBlurSearch();
            setIsOpen(false);
        }
    };
    return (
        <label className="form-control">
            <div className="relative" onBlur={handleBlur} ref={dropdownRef}>
                <button
                    type="button"
                    className="select select-bordered w-full text-left flex items-center hover:none"
                    onClick={toggleDropdown}
                >
                    {displayText()}
                </button>
                {isOpen && (
                    <ul
                        className="absolute left-0 bg-base-100 rounded-box shadow-lg p-2 mt-2 max-h-64 overflow-y-auto z-10"
                        tabIndex={0}
                        style={{ minWidth: 'max-content' }}
                    >
                        {options.map(({ key, value }) => (
                            <li key={key} className="w-full">
                                <label className="flex items-center space-x-2 px-2 py-1 hover:bg-grey-2 rounded cursor-pointer">
                                    <input
                                        type="checkbox"
                                        className="checkbox checkbox-sm"
                                        checked={selectedOptions.includes(key)}
                                        onChange={() =>
                                            handleCheckboxChange(key)
                                        }
                                    />
                                    <span className="text-sm">{value}</span>
                                </label>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </label>
    );
}
