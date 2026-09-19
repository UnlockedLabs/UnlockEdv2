export function pct(part: number, whole: number): number {
    return whole > 0 ? Math.round((part / whole) * 100) : 0;
}
