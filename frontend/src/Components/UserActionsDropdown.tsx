import { useState, useRef, useEffect } from 'react';
import { ChevronDownIcon } from '@heroicons/react/24/solid';
import { User, ResidentAccountAction } from '@/common';
import {
    canSwitchFacility,
    isAdministrator,
    isUserDeactivated
} from '@/useAuth';

interface UserActionsDropdownProps {
    user: User;
    currentUser: User;
    onActionSelect: (action: ResidentAccountAction) => void;
    disabled?: boolean;
}

export default function UserActionsDropdown({
    user,
    currentUser,
    onActionSelect,
    disabled = false
}: UserActionsDropdownProps) {
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const isDeactivated = isUserDeactivated(user);

    const actions = [
        {
            action: ResidentAccountAction['Download Usage Report (PDF)'],
            label: 'Download Usage Report (PDF)',
            show: isAdministrator(currentUser) && !isDeactivated,
            className: 'text-teal-5'
        },
        {
            action: ResidentAccountAction['Export Attendance'],
            label: 'Export Attendance',
            show: isAdministrator(currentUser),
            className: 'text-teal-5'
        },
        {
            action: ResidentAccountAction['Transfer Resident'],
            label: 'Transfer Resident',
            show: canSwitchFacility(currentUser) && !isDeactivated,
            className: 'text-teal-5'
        },
        {
            action: ResidentAccountAction['Deactivate Resident'],
            label: 'Deactivate Resident',
            show: !isDeactivated,
            className: 'text-dark-yellow'
        },
        {
            action: ResidentAccountAction['Delete Resident'],
            label: 'Delete Resident',
            show: !isDeactivated,
            className: 'text-error'
        }
    ];

    const visibleActions = actions.filter((a) => a.show);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(event.target as Node)
            ) {
                setDropdownOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () =>
            document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    if (visibleActions.length === 0 || disabled) {
        return null;
    }

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                className="button-grey bg-grey-1 hover:bg-grey-2 flex items-center gap-2"
                onClick={() => setDropdownOpen(!dropdownOpen)}
            >
                User Actions
                <ChevronDownIcon className="h-4 w-4" />
            </button>

            {dropdownOpen && (
                <ul className="absolute left-0 bg-inner-background rounded-box shadow-lg p-2 mt-1 z-10 min-w-max">
                    {visibleActions.map((actionItem) => (
                        <li key={actionItem.action} className="w-full">
                            <div
                                className={`flex items-center px-3 py-2 hover:bg-grey-2 rounded cursor-pointer ${actionItem.className}`}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onActionSelect(actionItem.action);
                                    setDropdownOpen(false);
                                }}
                            >
                                <span className="text-sm whitespace-nowrap">
                                    {actionItem.label}
                                </span>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
