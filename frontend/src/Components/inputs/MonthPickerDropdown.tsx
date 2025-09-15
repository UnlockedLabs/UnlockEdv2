import { useState, useEffect, useRef } from 'react';
import Calendar from 'react-calendar';
import type { Value } from 'react-calendar/dist/cjs/shared/types';
import 'react-calendar/dist/Calendar.css';

interface MonthPickerDropdownProps {
    label: string;
    value?: string; // YYYY-MM format
    onChange: (month: string) => void; // Returns YYYY-MM format
    disabled?: boolean;
    className?: string;
}

export function MonthPickerDropdown({
    label,
    value,
    onChange,
    disabled = false,
    className = ''
}: MonthPickerDropdownProps) {
    const initializeDate = (): Date => {
        if (value) {
            const [year, month] = value.split('-').map(Number);
            return new Date(year, month - 1, 1);
        }
        return new Date();
    };

    const [selectedDate, setSelectedDate] = useState<Date>(initializeDate());
    const [activeStartDate, setActiveStartDate] =
        useState<Date>(initializeDate());
    const [isCalendarOpen, setIsCalendarOpen] = useState<boolean>(false);
    const calendarRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (value) {
            const [year, month] = value.split('-').map(Number);
            const newDate = new Date(year, month - 1, 1);
            setSelectedDate(newDate);
            setActiveStartDate(newDate);
        }
    }, [value]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                calendarRef.current &&
                !calendarRef.current.contains(event.target as Node)
            ) {
                setIsCalendarOpen(false);
            }
        };

        if (isCalendarOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isCalendarOpen]);

    const onActiveStartDateChange = (date: Date | undefined) => {
        if (date) {
            setActiveStartDate(date);
        }
    };

    const handleCalendarChange = (value: Value) => {
        if (value && value instanceof Date) {
            setSelectedDate(value);
            const monthValue = value.toISOString().substring(0, 7);
            onChange(monthValue);
            setIsCalendarOpen(false);
        }
    };

    const toggleCalendar = () => {
        if (!disabled) {
            setIsCalendarOpen(!isCalendarOpen);
        }
    };

    const formatSelectedMonth = (date: Date): string => {
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long'
        });
    };

    return (
        <div
            className={`form-control w-full max-w-xs relative ${className}`}
            ref={calendarRef}
        >
            <label className="label">
                <span className="label-text">{label}</span>
            </label>
            <div className="relative">
                <input
                    type="text"
                    value={formatSelectedMonth(selectedDate)}
                    readOnly
                    onClick={toggleCalendar}
                    disabled={disabled}
                    className={`input input-bordered w-full max-w-xs pr-10 ${
                        disabled
                            ? 'cursor-not-allowed opacity-50'
                            : 'cursor-pointer'
                    }`}
                />
                <div
                    className={`absolute inset-y-0 right-0 flex items-center pr-3 ${
                        disabled ? 'cursor-not-allowed' : 'cursor-pointer'
                    }`}
                    onClick={toggleCalendar}
                >
                    <svg
                        className={`w-5 h-5 ${
                            disabled ? 'text-gray-300' : 'text-gray-400'
                        }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                    </svg>
                </div>
                {isCalendarOpen && !disabled && (
                    <div className="absolute top-full left-0 z-50 mt-1 bg-white border border-gray-300 rounded-md shadow-lg">
                        <Calendar
                            onChange={handleCalendarChange}
                            value={selectedDate}
                            view="year"
                            maxDetail="year"
                            activeStartDate={activeStartDate}
                            onActiveStartDateChange={({ activeStartDate }) =>
                                onActiveStartDateChange(
                                    activeStartDate ?? undefined
                                )
                            }
                        />
                    </div>
                )}
            </div>
        </div>
    );
}
