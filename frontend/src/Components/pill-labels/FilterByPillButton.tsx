import { Dispatch, SetStateAction, useEffect, useRef, useState } from 'react';
import DropdownControl from '../inputs/DropdownControl';
import ULIComponent from '../ULIComponent';
import { PlusIcon, XMarkIcon } from '@heroicons/react/24/outline';
import TealPill from './TealPill';
import { useDebounceValue } from 'usehooks-ts';

const buttonClassName = `flex gap-1 items-center catalog-pill !m-0 text-grey-3 hover:bg-grey-1`;

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

function FilterCategoryDropdown({
    setSelectedValue,
    option
}: {
    setSelectedValue: Dispatch<SetStateAction<any>>; // eslint-disable-line
    option: FilterOptions;
}) {
    if (option.categories === null) return null;
    const categoriesEnum: Record<string, string> = option.categories.reduce(
        (obj, category) => {
            obj[category.replace(/_/g, ' ')] = category;
            return obj;
        },
        {} as Record<string, string>
    );
    useEffect(() => {
        setSelectedValue(Object.values(categoriesEnum)[0]);
    }, []);
    return (
        <DropdownControl
            enumType={categoriesEnum}
            small={true}
            setState={setSelectedValue}
        />
    );
}

export enum FilterOptionType {
    string,
    number,
    category
}
export interface FilterOptions {
    key: string;
    value: string;
    type: FilterOptionType;
    categories: string[] | null;
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
    onRemoveFilter: (column: string) => void;
}) {
    const dropdownRef = useRef<HTMLDivElement>(null);
    const [openDropdown, setOpenDropdown] = useState(false);
    const [selectedColumn, setSelectedColumn] = useState<string>(
        columns[Object.keys(columns)[0]]
    );
    const [selectedValue, setSelectedValue] = useState<string>('');

    useEffect(() => {
        if (selectedValue !== '') {
            onRemoveFilter(selectedColumn);
            onApplyFilter({ column: selectedColumn, value: selectedValue });
        }
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
                    <FilterCategoryDropdown
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
                resetSort();
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
        setSelectedColumn(columns[Object.keys(columns)[0]]);
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
                default:
                    pillString = filter.value;
            }
            return (
                <TealPill key={index}>
                    <div className="flex gap-1 items-center">
                        {pillString}
                        <ULIComponent
                            icon={XMarkIcon}
                            iconClassName="!w-3 !h-3"
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

    function changeSelectedColumn(column: string) {
        onRemoveFilter(selectedColumn);
        setSelectedColumn(column);
        setSelectedValue('');
    }

    return (
        <div
            ref={dropdownRef}
            id="filter-dropdown"
            className="relative flex items-center"
            tabIndex={-1}
        >
            {renderExistingFilters()}
            <button
                className={`${buttonClassName} ${openDropdown ? 'bg-grey-1' : ''}`}
                onClick={() => setOpenDropdown(true)}
            >
                <ULIComponent icon={PlusIcon} />
                <label className="body cursor-pointer">Filter</label>
            </button>
            {openDropdown && (
                <ul className="card bg-grey-1 absolute top-full mt-2 z-10 p-4">
                    <li className="flex flex-row gap-2 items-center">
                        <DropdownControl
                            value={selectedColumn}
                            enumType={columns}
                            customCallback={changeSelectedColumn}
                            small={true}
                        />
                        {selectedColumn && renderSecondDropdown()}
                    </li>
                </ul>
            )}
        </div>
    );
}
