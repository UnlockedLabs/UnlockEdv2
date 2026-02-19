import { Video } from '@/types/content';
import { Class } from '@/types/program';
import { RRule, Weekday } from 'rrule';

export function formatDate(dateStr?: string): string {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

export function formatDateTime(dateStr: string): string {
    const dt = new Date(dateStr);
    const date = dt.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });
    const time = dt.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });
    return `${date} - ${time}`;
}

export function getVideoErrorMessage(video: Video): string | undefined {
    return video.video_download_attempts.find(
        (attempt) => attempt.error_message !== ''
    )?.error_message;
}

export function videoIsAvailable(vid: Video): boolean {
    return vid.availability === 'available';
}

export const parseDuration = (duration: number): string => {
    const hours = Math.floor(duration / 3.612);
    const minutes = Math.floor((duration % 3.612) / 6e10);
    return `${hours}h ${minutes}m`;
};

export function parseDurationToMs(duration: string): number {
    const regex = /(\d+)h(\d+)m(\d+)s/;
    const groups = regex.exec(duration);
    if (!groups) return 0;
    const hours = parseInt(groups[1] ?? '0', 10);
    const minutes = parseInt(groups[2] ?? '0', 10);
    const seconds = parseInt(groups[3] ?? '0', 10);
    return hours * 3600000 + minutes * 60000 + seconds * 1000;
}

export function timeToMinutes(timeStr: string): number {
    const [hour, minute] = timeStr.split(':').map(Number);
    return (hour ?? 0) * 60 + (minute ?? 0);
}

export function formatDurationStr(startTime: string, endTime: string): string {
    const totalMin = timeToMinutes(endTime) - timeToMinutes(startTime);
    const hours = Math.floor(totalMin / 60);
    const minutes = totalMin % 60;
    return `${hours}h${minutes}m0s`;
}

const WEEKDAY_NAMES: Record<number, string> = {
    0: 'Monday',
    1: 'Tuesday',
    2: 'Wednesday',
    3: 'Thursday',
    4: 'Friday',
    5: 'Saturday',
    6: 'Sunday'
};

export interface ClassScheduleInfo {
    days: string[];
    startTime: string;
    endTime: string;
    room: string;
}

export function getClassSchedule(cls: Class): ClassScheduleInfo {
    const event = cls.events?.find((e) => !e.is_cancelled);
    if (!event) return { days: [], startTime: '', endTime: '', room: '' };

    let days: string[] = [];
    let startTime = '';

    try {
        const cleaned = event.recurrence_rule.replace(
            /DTSTART;TZID=[^:]+:/,
            'DTSTART:'
        );
        const rule = RRule.fromString(cleaned);
        days =
            rule.options.byweekday?.map(
                (d: number | Weekday) =>
                    WEEKDAY_NAMES[typeof d === 'number' ? d : d.weekday] ?? ''
            ) ?? [];

        if (rule.options.dtstart) {
            const dt = rule.options.dtstart;
            const h = String(dt.getUTCHours()).padStart(2, '0');
            const m = String(dt.getUTCMinutes()).padStart(2, '0');
            startTime = `${h}:${m}`;
        }
    } catch {
        /* rrule parse failure - leave defaults */
    }

    const durationMs = parseDurationToMs(event.duration);
    let endTime = '';
    if (startTime && durationMs > 0) {
        const startMinutes = timeToMinutes(startTime);
        const totalMinutes = startMinutes + durationMs / 60000;
        const endH = String(Math.floor(totalMinutes / 60) % 24).padStart(
            2,
            '0'
        );
        const endM = String(Math.floor(totalMinutes % 60)).padStart(2, '0');
        endTime = `${endH}:${endM}`;
    }

    const room = event.room_ref?.name ?? '';

    return { days, startTime, endTime, room };
}

export function isClassToday(cls: Class): boolean {
    const schedule = getClassSchedule(cls);
    const now = new Date();
    const todayName = now.toLocaleDateString('en-US', { weekday: 'long' });
    if (!schedule.days.includes(todayName)) {
        return false;
    }

    const startOfToday = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate()
    );
    const endOfToday = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        23,
        59,
        59,
        999
    );
    const start = cls.start_dt ? new Date(cls.start_dt) : null;
    const end = cls.end_dt ? new Date(cls.end_dt) : null;
    const startOk =
        !start || Number.isNaN(start.getTime()) || start <= endOfToday;
    const endOk =
        !end || Number.isNaN(end.getTime()) || end >= startOfToday;

    return startOk && endOk;
}

export function getStatusColor(status: string): string {
    switch (status) {
        case 'Active':
            return 'bg-green-50 text-[#556830] border-green-200';
        case 'Scheduled':
            return 'bg-blue-50 text-blue-700 border-blue-200';
        case 'Completed':
            return 'bg-gray-50 text-gray-700 border-gray-200';
        case 'Paused':
            return 'bg-amber-50 text-amber-700 border-amber-200';
        case 'Cancelled':
            return 'bg-red-50 text-red-700 border-red-200';
        default:
            return 'bg-gray-50 text-gray-700 border-gray-200';
    }
}

export function formatTime12h(time: string): string {
    if (!time) return '';
    const [h, m] = time.split(':').map(Number);
    const hour = h ?? 0;
    const minute = m ?? 0;
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}:${String(minute).padStart(2, '0')} ${period}`;
}

export function getEnrollmentStatusColor(status: string): string {
    if (status === 'Enrolled')
        return 'bg-green-50 text-[#556830] border-green-200';
    if (status === 'Completed')
        return 'bg-blue-50 text-blue-700 border-blue-200';
    if (status.includes('Withdrawn'))
        return 'bg-gray-50 text-gray-600 border-gray-200';
    if (status.includes('Dropped'))
        return 'bg-amber-50 text-amber-700 border-amber-200';
    if (status.includes('Segregated'))
        return 'bg-red-50 text-red-700 border-red-200';
    if (status.includes('Failed'))
        return 'bg-orange-50 text-orange-700 border-orange-200';
    return 'bg-gray-50 text-gray-600 border-gray-200';
}
