import { Attendance } from '@/types/attendance';
import { ClassEventInstance } from '@/types/events';

export interface AttendanceStats {
    attended: number;
    total: number;
    rate: number;
}

export function computeAttendanceByUser(
    instances: ClassEventInstance[]
): Map<number, AttendanceStats> {
    const byUser = new Map<number, { attended: number; total: number }>();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const inst of instances) {
        if (inst.is_cancelled) continue;
        const [y, m, d] = inst.date.split('-').map(Number);
        const instDate = new Date(y, m - 1, d);
        if (instDate > today) continue;

        for (const record of inst.attendance_records ?? []) {
            const existing = byUser.get(record.user_id) ?? {
                attended: 0,
                total: 0
            };
            existing.total++;
            if (
                record.attendance_status === Attendance.Present ||
                record.attendance_status === Attendance.Partial
            ) {
                existing.attended++;
            }
            byUser.set(record.user_id, existing);
        }
    }

    const result = new Map<number, AttendanceStats>();
    byUser.forEach((stats, userId) => {
        result.set(userId, {
            ...stats,
            rate:
                stats.total > 0
                    ? Math.round((stats.attended / stats.total) * 100)
                    : 0
        });
    });
    return result;
}
