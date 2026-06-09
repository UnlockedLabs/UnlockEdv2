import { InsightsRangeKey } from '@/types';

export interface InsightsDateParams {
    start_date: string;
    end_date: string;
}

export const RANGE_OPTIONS: InsightsRangeKey[] = [
    '7D',
    '30D',
    '90D',
    'YTD',
    'Custom'
];

export const RANGE_LABELS: Record<InsightsRangeKey, string> = {
    '7D': 'last 7 days',
    '30D': 'last 30 days',
    '90D': 'last 90 days',
    YTD: 'year to date',
    Custom: 'custom range'
};

function formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function daysAgo(end: Date, count: number): Date {
    const start = new Date(end);
    start.setDate(end.getDate() - count);
    return start;
}

export function priorParams(params: InsightsDateParams): InsightsDateParams {
    const start = new Date(`${params.start_date}T00:00:00`);
    const end = new Date(`${params.end_date}T00:00:00`);
    const durationDays =
        Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
    const priorEnd = new Date(start);
    priorEnd.setDate(start.getDate() - 1);
    const priorStart = new Date(start);
    priorStart.setDate(start.getDate() - durationDays);
    return {
        start_date: formatDate(priorStart),
        end_date: formatDate(priorEnd)
    };
}

export function rangeToParams(
    range: InsightsRangeKey,
    customFrom: string,
    customTo: string
): InsightsDateParams {
    if (range === 'Custom') {
        return { start_date: customFrom, end_date: customTo };
    }
    const end = new Date();
    let start: Date;
    switch (range) {
        case '7D':
            start = daysAgo(end, 6);
            break;
        case 'YTD':
            start = new Date(end.getFullYear(), 0, 1);
            break;
        case '90D':
            start = daysAgo(end, 89);
            break;
        case '30D':
        default:
            start = daysAgo(end, 29);
            break;
    }
    return { start_date: formatDate(start), end_date: formatDate(end) };
}
