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
