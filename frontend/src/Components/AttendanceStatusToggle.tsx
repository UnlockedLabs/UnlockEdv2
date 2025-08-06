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

export default function AttendanceStatusToggle({
    value,
    onChange,
    disabled = false
}: AttendanceStatusToggleProps) {
    const buttonClass = `flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-2 text-base`;

    return (
        <div className="inline-flex w-fit gap-3">
            <button
                className={
                    buttonClass +
                    ` ${
                        value === Attendance.Present
                            ? 'bg-teal-3 opacity-70 hover:shadow-md text-white'
                            : 'bg-grey-1 hover:bg-grey-2'
                    }` +
                    (disabled ? 'cursor-not-allowed opacity-50' : '')
                }
                onClick={() => onChange(Attendance.Present)}
                type="button"
                disabled={disabled}
            >
                <ULIComponent icon={CheckIcon} />
                <label className="body-small cursor-pointer">Present</label>
            </button>
            <button
                className={
                    buttonClass +
                    ` ${
                        value === Attendance.Absent_Excused
                            ? 'bg-pale-yellow hover:shadow-md text-base'
                            : 'bg-grey-1 hover:bg-grey-2'
                    }`
                }
                onClick={() => onChange(Attendance.Absent_Excused)}
                type="button"
                disabled={disabled}
            >
                <ULIComponent icon={ShieldCheckIcon} />
                <label className="body-small cursor-pointer">Excused</label>
            </button>
            <button
                className={
                    buttonClass +
                    ` ${
                        value === Attendance.Absent_Unexcused
                            ? 'bg-red-2 opacity-80 hover:shadow-md text-white'
                            : 'bg-grey-1 hover:bg-grey-2'
                    }`
                }
                onClick={() => onChange(Attendance.Absent_Unexcused)}
                type="button"
                disabled={disabled}
            >
                <ULIComponent icon={XMarkIcon} />
                <label className="body-small cursor-pointer">Unexcused</label>
            </button>
        </div>
    );
}
