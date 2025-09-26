import { Timezones } from '@/common';
import { toZonedTime } from 'date-fns-tz';
import { RRule } from 'rrule';

export function formatPercent(value?: number | string): string {
    if (typeof value === 'string') return value;
    if (typeof value === 'number') return `${Math.round(value * 100) / 100}`;
    return '--';
}

export function transformStringToArray(input: string): string | string[] {
    const transformed = input.replace(/_/g, ' ');
    if (!transformed.includes(',')) {
        return transformed.trim();
    }
    return transformed.split(',').map((s) => s.trim());
}

export function parseLocalDay(isoDate: string): Date {
    const [year, month, day] = isoDate.split('-').map(Number);
    return new Date(year, month - 1, day);
}

export function toTimezoneString(timezoneValue: string): string {
    return (
        Object.keys(Timezones).find(
            (key) => Timezones[key as keyof typeof Timezones] === timezoneValue // eslint-disable-line
        ) ?? timezoneValue
    );
}

export function parseDurationToMs(duration: string): number {
    const regex = /(\d+)h(\d+)m(\d)+s/;
    const groups = regex.exec(duration);

    if (!groups) return 0;

    const hours = parseInt(groups[1] || '0', 10);
    const minutes = parseInt(groups[2] || '0', 10);
    const seconds = parseInt(groups[3] || '0', 10);
    return hours * 3600000 + minutes * 60000 + seconds * 1000;
}

export function formatDuration(startTime: string, endTime: string): string {
    const totalMin = timeToMinutes(endTime) - timeToMinutes(startTime);
    const hours = Math.floor(totalMin / 60);
    const minutes = totalMin % 60;
    return `${hours}h${minutes}m0s`;
}

export function timeToMinutes(timeStr: string): number {
    const [hour, minute] = timeStr.split(':').map(Number);
    return hour * 60 + minute;
}

export function isEndDtBeforeStartDt(
    endDate: string,
    startDate: string
): boolean {
    const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
    const [endYear, endMonth, endDay] = endDate.split('-').map(Number);
    const start = new Date(startYear, startMonth - 1, startDay);
    const end = new Date(endYear, endMonth - 1, endDay);
    return end < start;
}

export function parseRRule(
    rRule: string,
    timezone: string,
    startDtOnly?: boolean
): string {
    let rule;
    try {
        rule = RRule.fromString(rRule);
        const eventDate = startDtOnly ? rule.options.dtstart : rule.all()[0];
        return fromLocalDateToNumericDateFormat(eventDate, timezone);
    } catch (error) {
        console.error(
            'error parsing rrule, rRule is: ',
            rRule,
            '; error is: ',
            error
        );
    }
    return '';
}

export function parseRRuleUntilDate(rRule: string, timezone: string): string {
    try {
        const rule = RRule.fromString(rRule);
        if (rule.options.until) {
            return toZonedTime(rule.options.until, timezone)
                .toISOString()
                .split('T')[0];
        }
    } catch (error) {
        console.error('error parsing the rrule, error is: ', error);
    }
    return '';
}

export function textMonthLocalDate(date: string | Date, includeTime?: boolean) {
    if (typeof date === 'string') {
        return new Date(date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            timeZone: 'UTC',
            ...(includeTime && {
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
            })
        });
    } else {
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            timeZone: 'UTC',
            ...(includeTime && {
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
            })
        });
    }
}

export function fromLocalDateToTime(date: Date) {
    return date.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
    });
}

export function fromLocalDateToNumericDateFormat(date: Date, timezone: string) {
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        timeZone: timezone
    });
}

export function getPreviousMonth(currentMonth: string): string {
    const [year, month] = currentMonth.split('-').map(Number);
    const prevDate = new Date(year, month - 2);
    return `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
}

export function getNextMonth(currentMonth: string): string {
    const [year, month] = currentMonth.split('-').map(Number);
    const nextDate = new Date(year, month);
    return `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`;
}

export function formatMonthYear(monthString: string): string {
    const [year, month] = monthString.split('-').map(Number);
    const date = new Date(year, month - 1);
    return date.toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric'
    });
}

export function getCurrentMonth(): string {
    return new Date().toISOString().substring(0, 7);
}

export function getTimestamp(): string {
    const currentDate = new Date();
    const padIt = (theNumber: number) => theNumber.toString().padStart(2, '0');
    return (
        currentDate.getFullYear().toString() +
        padIt(currentDate.getMonth() + 1) +
        padIt(currentDate.getDate()) +
        padIt(currentDate.getHours()) +
        padIt(currentDate.getMinutes())
    );
}
