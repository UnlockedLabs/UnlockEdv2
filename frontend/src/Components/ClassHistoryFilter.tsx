import { useEffect, useState } from 'react';
import { MultiSelectDropdown } from './inputs';
import { Option } from '@/common';

interface ClassHistoryFilterProps {
    onFilterChange: (categoryQueryString: string) => void;
}

export default function ClassHistoryFilter({
    onFilterChange
}: ClassHistoryFilterProps) {
    const [selectedCategories, setSelectedCategories] = useState<number[]>([]);

    const filterOptions: Option[] = [
        { key: 0, value: 'Class Info' },
        { key: 1, value: 'Status' },
        { key: 2, value: 'Schedule' },
        { key: 3, value: 'Settings' }
    ];

    useEffect(() => {
        const categoryMapping = {
            0: 'info',
            1: 'status',
            2: 'schedule',
            3: 'settings'
        };

        const queryString = selectedCategories
            .map(
                (categoryKey) =>
                    `categories=${categoryMapping[categoryKey as keyof typeof categoryMapping]}`
            )
            .join('&');

        onFilterChange(queryString);
    }, [selectedCategories]);

    return (
        <div className="inline-block">
            <MultiSelectDropdown
                label="Filter by"
                options={filterOptions}
                selectedOptions={selectedCategories}
                onSelectionChange={setSelectedCategories}
                onBlurSearch={() => {}} // eslint-disable-line @typescript-eslint/no-empty-function
                small={true}
            />
        </div>
    );
}
