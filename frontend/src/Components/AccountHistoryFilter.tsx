import { useEffect, useState } from 'react';
import { MultiSelectDropdown } from './inputs';
import { Option } from '@/common';

interface AccountHistoryFilterProps {
    onFilterChange: (categoryQueryString: string) => void;
}

export default function AccountHistoryFilter({
    onFilterChange
}: AccountHistoryFilterProps) {
    const [selectedCategories, setSelectedCategories] = useState<number[]>([]);

    const filterOptions: Option[] = [
        { key: 0, value: 'Account' },
        { key: 1, value: 'Facility' },
        { key: 2, value: 'Enrollment' }
        // { key: 3, value: 'Attendance' } // TODO: Enable when attendance tracking PR is merged
    ];

    useEffect(() => {
        const categoryMapping = {
            0: 'account',
            1: 'facility',
            2: 'enrollment'
            // 3: 'attendance' // TODO: Enable when attendance tracking PR is merged
        };

        const queryString = selectedCategories
            .map(
                (categoryKey) =>
                    `categories=${categoryMapping[categoryKey as keyof typeof categoryMapping]}`
            )
            .join('&');

        onFilterChange(queryString);
    }, [selectedCategories, onFilterChange]);

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
