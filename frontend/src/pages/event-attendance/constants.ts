import {
    AlertCircle,
    CheckCircle,
    Clock,
    LucideIcon,
    XCircle
} from 'lucide-react';
import { Attendance } from '@/types';

export interface AttendanceStatusConfig {
    status: Attendance;
    label: string;
    shortLabel: string;
    icon: LucideIcon;
    cardActiveClass: string;
    cardHoverBorder: string;
    tableActiveClass: string;
}

export const ATTENDANCE_STATUSES: AttendanceStatusConfig[] = [
    {
        status: Attendance.Present,
        label: 'Present',
        shortLabel: 'Present',
        icon: CheckCircle,
        cardActiveClass: 'bg-[#556830] text-white border-[#556830]',
        cardHoverBorder: 'hover:border-[#556830]',
        tableActiveClass: 'bg-green-600 hover:bg-green-700 text-white'
    },
    {
        status: Attendance.Partial,
        label: 'Partial',
        shortLabel: 'Partial',
        icon: Clock,
        cardActiveClass: 'bg-blue-600 text-white border-blue-600',
        cardHoverBorder: 'hover:border-blue-600',
        tableActiveClass: ''
    },
    {
        status: Attendance.Absent_Excused,
        label: 'Absent (Excused)',
        shortLabel: 'Excused',
        icon: AlertCircle,
        cardActiveClass: 'bg-purple-600 text-white border-purple-600',
        cardHoverBorder: 'hover:border-purple-600',
        tableActiveClass: 'bg-amber-500 hover:bg-amber-600 text-white'
    },
    {
        status: Attendance.Absent_Unexcused,
        label: 'Absent (Unexcused)',
        shortLabel: 'Unexcused',
        icon: XCircle,
        cardActiveClass: 'bg-amber-600 text-white border-amber-600',
        cardHoverBorder: 'hover:border-amber-600',
        tableActiveClass: 'bg-red-500 hover:bg-red-600 text-white'
    }
];

// Compact table view excludes Partial.
export const TABLE_ATTENDANCE_STATUSES = ATTENDANCE_STATUSES.filter(
    (s) => s.status !== Attendance.Partial
);
