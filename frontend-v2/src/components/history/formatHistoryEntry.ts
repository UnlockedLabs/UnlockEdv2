import type { ChangeLogEntry } from '@/types';
import { parseRRule } from '../helperFunctions';

function formatValue(value: string): string {
    return value.replace(/_/g, ' ');
}

function formatAttendanceStatus(status: string): string {
    switch (status) {
        case 'present':
            return 'present';
        case 'partial':
            return 'partial';
        case 'absent_excused':
            return 'absent (excused)';
        case 'absent_unexcused':
            return 'absent (unexcused)';
        case 'deleted':
            return 'deleted';
        default:
            return status;
    }
}

export function formatHistoryEntry(
    entry: ChangeLogEntry,
    timezone?: string
): string | null {
    const adminName = entry.admin_username ?? entry.username ?? '';
    const userName = entry.user_username ?? entry.username ?? '';
    const newValue = entry.new_value ?? '';
    const oldValue = entry.old_value ?? '';
    const safeTimezone = timezone ?? 'UTC';

    const getProgramClassesHistoryEventText = () => {
        let text;
        switch (entry.field_name) {
            case 'capacity':
                text = `Capacity set to ${newValue} by ${adminName}`;
                break;
            case 'class':
                text = `Class created by ${adminName}`;
                break;
            case 'program':
                text = `Program created by ${adminName}`;
                break;
            case 'name':
                text = `Name set to ${newValue} by ${adminName}`;
                break;
            case 'instructor_name':
                text = `Instructor name set to ${newValue} by ${adminName}`;
                break;
            case 'description':
                text = `Description set by ${adminName}`;
                break;
            case 'status':
                text = `Status set to ${newValue} by ${adminName}`;
                break;
            case 'archived_at':
                text = `Archived by ${adminName}`;
                break;
            case 'credit_hours':
                text = `Credit hours set to ${newValue} by ${adminName}`;
                break;
            case 'funding_type':
                text = `Funding type set to ${formatValue(newValue)} by ${adminName}`;
                break;
            case 'is_active':
                text = `Program set to ${
                    newValue == 'true' ? 'available' : 'inactive'
                } by ${adminName}`;
                break;
            case 'credit_type':
                text = `Credit type ${
                    !newValue
                        ? `${formatValue(oldValue)} removed `
                        : `set to ${formatValue(newValue)}`
                } by ${adminName}`;
                break;
            case 'program_type':
                text = `Program type ${
                    !newValue
                        ? `${formatValue(oldValue)} removed `
                        : `set to ${formatValue(newValue)}`
                } by ${adminName}`;
                break;
            case 'event_cancelled':
                text = `Event on ${parseRRule(newValue, safeTimezone)} cancelled by ${adminName}`;
                break;
            case 'event_rescheduled':
                text = `Event on ${parseRRule(oldValue, safeTimezone)} moved to ${newValue} by ${adminName}`;
                break;
            case 'event_rescheduled_series':
                text = `All future sessions rescheduled starting ${parseRRule(newValue, safeTimezone, true)} by ${adminName}`;
                break;
            case 'event_restored':
                text = `${adminName} restored event on ${parseRRule(oldValue, safeTimezone)}`;
        }
        return text;
    };

    let introText;
    switch (entry.action) {
        case 'account_creation':
            introText = `Account created by ${adminName}`;
            break;
        case 'user_deactivated':
            introText = `Account deactivated by ${adminName}`;
            break;
        case 'facility_transfer':
            introText = `Account assigned to ${entry.facility_name} by ${adminName}`;
            break;
        case 'set_password':
            introText = `New password set by ${userName}`;
            break;
        case 'reset_password':
            introText = `Password reset initiated by ${adminName}`;
            break;
        case 'progclass_history':
            introText = getProgramClassesHistoryEventText();
            break;
        case 'attendance_recorded': {
            const sessionDate = entry.session_date
                ? new Date(
                      new Date(entry.session_date).getTime() +
                          12 * 60 * 60 * 1000
                  ).toLocaleDateString('en-US')
                : '';
            const formattedStatus = entry.attendance_status
                ? formatAttendanceStatus(entry.attendance_status)
                : '';
            introText = `Resident marked ${formattedStatus} - ${entry.class_name}, ${sessionDate} by ${adminName}`;
            break;
        }
    }

    return introText ?? null;
}
