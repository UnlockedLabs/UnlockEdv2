import type { useAuth } from '@/auth/useAuth';

export function learningRecordResidentDisplayName(
    user: ReturnType<typeof useAuth>['user']
): string {
    if (!user) return 'Resident';
    const first = typeof user.name_first === 'string' ? user.name_first.trim() : '';
    const last = typeof user.name_last === 'string' ? user.name_last.trim() : '';
    const full = [first, last].filter(Boolean).join(' ');
    return full.length > 0 ? full : 'Resident';
}

export function programsCompletedLabel(count: number): string {
    if (count === 0) return 'No programs completed yet';
    return `${count} ${count === 1 ? 'program' : 'programs'} completed`;
}
