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

export function parseDurationToMs(duration: string): number {
    const regex = /(\d+)h(\d+)m(\d)+s/;
    const groups = regex.exec(duration);

    if (!groups) return 0;

    const hours = parseInt(groups[1] || '0', 10);
    const minutes = parseInt(groups[2] || '0', 10);
    const seconds = parseInt(groups[3] || '0', 10);
    return hours * 3600000 + minutes * 60000 + seconds * 1000;
}
