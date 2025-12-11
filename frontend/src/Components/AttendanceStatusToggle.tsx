import {
    CheckIcon,
    ShieldCheckIcon,
    XMarkIcon
} from '@heroicons/react/24/outline';
import ULIComponent from './ULIComponent';
import { Attendance } from '@/common';

interface AttendanceStatusToggleProps {
    value?: Attendance;
    onChange: (value: Attendance) => void;
    disabled?: boolean;
}

interface ButtonConfig {
    value: Attendance;
    icon: typeof CheckIcon;
    label: string;
    selectedStyles: {
        enabled: string;
        disabled: string;
    };
}

export default function AttendanceStatusToggle({
    value,
    onChange,
    disabled = false
}: AttendanceStatusToggleProps) {
    const baseButtonClass = `flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-2 text-base`;
    const unselectedEnabledClass = `${baseButtonClass} bg-grey-1 hover:bg-grey-2`;
    const unselectedDisabledClass = `${baseButtonClass} bg-grey-1 opacity-40 cursor-not-allowed`;

    const buttonConfigs: ButtonConfig[] = [
        {
            value: Attendance.Present,
            icon: CheckIcon,
            label: 'Present',
            selectedStyles: {
                enabled: `${baseButtonClass} bg-teal-3 opacity-70 hover:shadow-md text-white`,
                disabled: `${baseButtonClass} bg-teal-3 text-white opacity-60 cursor-not-allowed`
            }
        },
        {
            value: Attendance.Absent_Excused,
            icon: ShieldCheckIcon,
            label: 'Excused',
            selectedStyles: {
                enabled: `${baseButtonClass} bg-pale-yellow hover:shadow-md text-base`,
                disabled: `${baseButtonClass} bg-pale-yellow text-base opacity-60 cursor-not-allowed`
            }
        },
        {
            value: Attendance.Absent_Unexcused,
            icon: XMarkIcon,
            label: 'Unexcused',
            selectedStyles: {
                enabled: `${baseButtonClass} bg-red-2 opacity-80 hover:shadow-md text-white`,
                disabled: `${baseButtonClass} bg-red-2 text-white opacity-60 cursor-not-allowed`
            }
        }
    ];

    const isPresentVariant =
        value === Attendance.Present || value === Attendance.Partial;

    const getButtonClassName = (config: ButtonConfig): string => {
        const isSelected =
            value === config.value ||
            (config.value === Attendance.Present && isPresentVariant);

        if (isSelected) {
            return disabled
                ? config.selectedStyles.disabled
                : config.selectedStyles.enabled;
        }

        return disabled ? unselectedDisabledClass : unselectedEnabledClass;
    };

    return (
        <div className="inline-flex w-fit gap-3">
            {buttonConfigs.map((config) => (
                <button
                    key={config.value}
                    className={getButtonClassName(config)}
                    onClick={() => onChange(config.value)}
                    type="button"
                    disabled={disabled}
                >
                    <ULIComponent icon={config.icon} />
                    <label
                        className={`body-small ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                    >
                        {config.label}
                    </label>
                </button>
            ))}
        </div>
    );
}
