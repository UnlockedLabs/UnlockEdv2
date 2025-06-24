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
        return eventDate.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'numeric',
            day: 'numeric',
            timeZone: timezone
        });
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
