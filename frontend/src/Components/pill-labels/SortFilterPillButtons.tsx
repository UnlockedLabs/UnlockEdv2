import {
    ArrowDownIcon,
    ArrowUpIcon,
    PlusIcon,
    XMarkIcon
} from '@heroicons/react/24/outline';
import ULIComponent from '../ULIComponent';
import { Dispatch, SetStateAction, useEffect, useState } from 'react';
import DropdownControl from '../inputs/DropdownControl';
import TealPill from './TealPill';

const buttonClassName = `flex gap-1 items-center catalog-pill !m-0 text-grey-3 hover:bg-grey-1`;
export function SortPillButton({
    columns,
    appliedSort,
    orderCallback
}: {
    columns: Record<string, string>;
    appliedSort: {
        appliedSortBool: boolean;
        setAppliedSort: Dispatch<SetStateAction<any>>; // eslint-disable-line
    };
    orderCallback: (column: string, order: string) => void;
}) {
    const [openDropdown, setOpenDropdown] = useState(false);
    const [selectedColumn, setSelectedColumn] = useState<string>(
        columns[Object.keys(columns)[0]]
    );
    const order = { Ascending: 'asc', Descending: 'desc' };
    const [selectedOrder, setSelectedOrder] = useState<string>('asc');
    const { appliedSortBool, setAppliedSort } = appliedSort;

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const dropdownElement = document.getElementById('dropdown');
            if (
                dropdownElement &&
                !dropdownElement.contains(event.target as Node)
            ) {
                setOpenDropdown(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [openDropdown]);

    function updateSortPill() {
        if (!appliedSortBool) {
            return (
                <button
                    className={`${buttonClassName} ${openDropdown ? 'bg-grey-1' : ''}`}
                    onClick={() => (
                        setOpenDropdown(true), setAppliedSort(true)
                    )}
                >
                    <ULIComponent icon={PlusIcon} />
                    <label className="body cursor-pointer">Sort</label>
                </button>
            );
        }
        return (
            <div onClick={() => (setOpenDropdown(true), setAppliedSort(true))}>
                <TealPill>
                    <div className="flex gap-1 items-center">
                        {selectedOrder === order.Ascending ? (
                            <ULIComponent
                                icon={ArrowUpIcon}
                                iconClassName="!w-3 !h-3"
                            />
                        ) : (
                            <ULIComponent
                                icon={ArrowDownIcon}
                                iconClassName="!w-3 !h-3"
                            />
                        )}
                        <p className="body-small">
                            {Object.keys(columns).find(
                                (key) => columns[key] === selectedColumn
                            )}
                        </p>
                        <ULIComponent
                            icon={XMarkIcon}
                            iconClassName="!w-3 !h-3"
                            dataTip="Remove Sort"
                            onClick={(e) => (resetSort(), e?.stopPropagation())}
                        />
                    </div>
                </TealPill>
            </div>
        );
    }

    function resetSort() {
        setAppliedSort(false);
        setOpenDropdown(false);
        setSelectedColumn(columns[Object.keys(columns)[0]]);
        setSelectedOrder('asc');
    }

    useEffect(() => {
        updateSortPill();
        if (appliedSort) orderCallback(selectedColumn, selectedOrder);
    }, [selectedColumn, selectedOrder]);

    return (
        <div id="dropdown" className="relative flex items-center" tabIndex={-1}>
            {updateSortPill()}
            {openDropdown && (
                <ul className="card bg-grey-1 absolute top-full mt-2 z-10 p-4">
                    <li className="flex flex-row gap-2 items-center">
                        <DropdownControl
                            value={selectedColumn}
                            enumType={columns}
                            small={true}
                            setState={setSelectedColumn}
                        />
                        <DropdownControl
                            value={selectedOrder}
                            enumType={order}
                            small={true}
                            setState={setSelectedOrder}
                        />
                    </li>
                </ul>
            )}
        </div>
    );
}
