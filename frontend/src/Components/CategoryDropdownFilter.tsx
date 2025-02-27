import { useEffect, useState } from 'react';
import { MultiSelectDropdown } from './inputs';
import { Option } from '@/common';

interface CategoryDropdownFilterProps {
    mutate: () => void;
    setCategoryQueryString: React.Dispatch<React.SetStateAction<string>>;
    options: Option[];
}

export default function CategoryDropdownFilter({
    mutate,
    setCategoryQueryString,
    options
}: CategoryDropdownFilterProps) {
    const [selectedCategories, setSelectedCategories] = useState<number[]>([]);

    useEffect(() => {
        const queryString = selectedCategories
            .map((category) => `tags=${category}`)
            .join('&');
        setCategoryQueryString(queryString);
    }, [selectedCategories]);

    return (
        <MultiSelectDropdown
            label="Categories"
            options={options}
            selectedOptions={selectedCategories}
            onSelectionChange={setSelectedCategories}
            onBlurSearch={mutate}
        />
    );
}
