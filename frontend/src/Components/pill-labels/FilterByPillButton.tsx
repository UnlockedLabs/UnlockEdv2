import { Dispatch, SetStateAction, useEffect, useRef, useState } from 'react';
import DropdownControl from '../inputs/DropdownControl';
import ULIComponent from '../ULIComponent';
import { PlusIcon, XMarkIcon } from '@heroicons/react/24/outline';
import TealPill from './TealPill';
import { useDebounceValue } from 'usehooks-ts';
import { MultiSelectDropdown } from '../inputs';
import { Option } from '@/common';
import { buttonClassName } from './SortByPillButton';

// BUG: the appearance of the number options in the pills appears as the value, when it should be the key

function NumberDropdown({
    setSelectedValue
}: {
    setSelectedValue: Dispatch<SetStateAction<any>>; // eslint-disable-line
}) {
    const numberOptions = {
        '>': '>',
        '<': '<',
        '≥': '>=',
        '≤': '<=',
        '=': '=',
        '≠': '!='
    };
    const [selectedNumberOption, setSelectedNumberOption] = useState<string>(
        numberOptions['>']
    );
    const [number, setNumber] = useState<string>('');

    useEffect(() => {
        if (selectedNumberOption != '' && number != '') {
            setSelectedValue(selectedNumberOption + ' ' + number);
        }
    }, [selectedNumberOption, number]);
    return (
        <>
            <DropdownControl
                enumType={numberOptions}
                small={true}
                setState={setSelectedNumberOption}
            ></DropdownControl>
            <input
                className={`input input-bordered w-40 input-sm`}
                type="number"
                onChange={(e) => setNumber(e.target.value)}
            ></input>
        </>
    );
}

function StringDropdown({
    setSelectedValue
}: {
    setSelectedValue: Dispatch<SetStateAction<any>>; // eslint-disable-line
}) {
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [stringValue] = useDebounceValue(searchTerm, 500);
    useEffect(() => {
        setSelectedValue(stringValue);
    }, [stringValue]);
    return (
        <>
            <p className="body-small">includes</p>
            <input
                className={`input input-bordered w-40 input-sm`}
                type="text"
                onChange={(e) => setSearchTerm(e.target.value)}
            ></input>
        </>
    );
}
function SingleSelectCategoryDropdown({
    setSelectedValue,
    option
}: {
    setSelectedValue: Dispatch<SetStateAction<string>>;
    option: FilterOptions;
}) {
    const [selectedOption, setSelectedOption] = useState<string>('');

    if (!option.categories) return null;

    const categoriesOptions = transformCategoriesToOptions(option.categories);

    useEffect(() => {
        setSelectedValue(selectedOption);
    }, [selectedOption, setSelectedValue]);

    return (
        <div className="w-52">
            <DropdownControl
                value={selectedOption}
                enumType={categoriesOptions}
                small={true}
                customCallback={setSelectedOption}
                blockedDefault={true}
            />
        </div>
    );
}

function MultiSelectCategoryDropdown({
    setSelectedValue,
    option
}: {
    setSelectedValue: Dispatch<SetStateAction<string>>;
    option: FilterOptions;
}) {
    const [selectedCategories, setSelectedCategories] = useState<number[]>([]);

    if (!option.categories) return null;

    const categoriesOptions = transformCategoriesToOptions(option.categories);
    const originalValues = getOriginalValues(option.categories);

    useEffect(() => {
        if (selectedCategories.length === 0) {
            setSelectedValue('');
            return;
        }
        const query = selectedCategories
            .map((index) => originalValues[index])
            .join('|');
        setSelectedValue(query);
    }, [selectedCategories, originalValues, setSelectedValue]);

    return (
        <div className="w-48">
            <MultiSelectDropdown
                options={categoriesOptions}
                selectedOptions={selectedCategories}
                onSelectionChange={setSelectedCategories}
                onBlurSearch={() => {}} // eslint-disable-line @typescript-eslint/no-empty-function
                small={true}
                label={`Select ${option.key}`}
            />
        </div>
    );
}

function transformCategoriesToOptions(
    categories: string[] | Option[]
): Option[] {
    const isOptionArray =
        Array.isArray(categories) && typeof categories[0] === 'object';

    return isOptionArray
        ? (categories as Option[])
        : (categories as string[]).map((category, index) => ({
              key: index,
              value: category.replace(/_/g, ' ')
          }));
}

function getOriginalValues(categories: string[] | Option[]): string[] {
    const isOptionArray =
        Array.isArray(categories) && typeof categories[0] === 'object';

    return isOptionArray
        ? (categories as Option[]).map((opt) => opt.value)
        : (categories as string[]);
}

export enum FilterOptionType {
    string,
    number,
    category,
    option
}
export interface FilterOptions {
    key: string;
    value: string;
    type: FilterOptionType;
    categories: string[] | Option[] | null;
}

export interface Filter {
    column: string;
    value: string;
}

export function FilterPillButton({
    filters,
    columns,
    filterOptions,
    onApplyFilter,
    onRemoveFilter
}: {
    filters: Filter[];
    columns: Record<string, string>;
    filterOptions: FilterOptions[];
    onApplyFilter: (filter: Filter) => void;
    onRemoveFilter: (column?: string) => void;
}) {
    const dropdownRef = useRef<HTMLDivElement>(null);
    const [openDropdown, setOpenDropdown] = useState(false);
    const [selectedColumn, setSelectedColumn] = useState<string>('');
    const [selectedValue, setSelectedValue] = useState<string>('');

    useEffect(() => {
        onRemoveFilter(selectedColumn);
        onApplyFilter({ column: selectedColumn, value: selectedValue });
    }, [selectedValue]);

    function renderSecondDropdown() {
        const option = filterOptions.find(
            (opt) => selectedColumn === opt.value
        );
        if (!option) return null;
        switch (option.type) {
            case FilterOptionType.number:
                return <NumberDropdown setSelectedValue={setSelectedValue} />;
            case FilterOptionType.string:
                return <StringDropdown setSelectedValue={setSelectedValue} />;
            case FilterOptionType.category: {
                return (
                    <MultiSelectCategoryDropdown
                        setSelectedValue={setSelectedValue}
                        option={option}
                    />
                );
            }
            case FilterOptionType.option: {
                return (
                    <SingleSelectCategoryDropdown
                        setSelectedValue={setSelectedValue}
                        option={option}
                    />
                );
            }
            default:
                return null;
        }
    }

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(event.target as Node)
            ) {
                setOpenDropdown(false);
                onRemoveFilter();
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [openDropdown]);

    function resetSort(column?: string) {
        onRemoveFilter(column ?? selectedColumn);
        setOpenDropdown(false);
        setSelectedColumn('');
        setSelectedValue('');
    }

    function renderExistingFilters() {
        return filters.map((filter, index) => {
            const filterOption = filterOptions.find(
                (opt) => opt.value === filter.column
            );
            if (!filterOption) return;
            let pillString;
            switch (filterOption.type) {
                case FilterOptionType.number:
                    pillString = filterOption.key + ' ' + filter.value;
                    break;
                case FilterOptionType.category:
                    pillString = filterOption.key + ': ' + filter.value;
                    break;
                case FilterOptionType.option: {
                    const selectedOption = (
                        filterOption.categories as Option[]
                    ).find((opt) => opt.key.toString() === filter.value);
                    const displayValue = selectedOption
                        ? selectedOption.value
                        : filter.value;
                    pillString = filterOption.key + ': ' + displayValue;
                    break;
                }
                default:
                    pillString = filter.value;
            }
            return (
                <TealPill key={index}>
                    <div className="flex gap-1 items-center text-nowrap">
                        {pillString}
                        <ULIComponent
                            icon={XMarkIcon}
                            iconClassName="!w-3 !h-3 cursor-pointer"
                            dataTip="Remove Filter"
                            onClick={(e) => (
                                resetSort(filter.column), e?.stopPropagation()
                            )}
                        />
                    </div>
                </TealPill>
            );
        });
    }

    return (
        <div
            ref={dropdownRef}
            id="filter-dropdown"
            className="relative flex items-center"
            tabIndex={-1}
        >
            <button
                className={`${buttonClassName} ${openDropdown ? 'bg-grey-1' : ''}`}
                onClick={() => {
                    setOpenDropdown(true);
                    setSelectedColumn('');
                    setSelectedValue('');
                }}
            >
                <ULIComponent icon={PlusIcon} />
                <label className="body cursor-pointer">Filter</label>
            </button>
            <div className="flex flex-wrap gap-y-1">
                {renderExistingFilters()}
            </div>
            {openDropdown && (
                <ul className="card bg-grey-1 absolute top-full mt-2 z-10 p-4">
                    <li className="flex flex-row gap-2 items-center">
                        <DropdownControl
                            value={selectedColumn}
                            enumType={columns}
                            setState={setSelectedColumn}
                            small={true}
                            blockedDefault={true}
                        />
                        {selectedColumn && (
                            <div
                                key={selectedColumn}
                                className="flex flex-row gap-1 items-center"
                            >
                                {renderSecondDropdown()}
                            </div>
                        )}
                    </li>
                </ul>
            )}
        </div>
    );
}
