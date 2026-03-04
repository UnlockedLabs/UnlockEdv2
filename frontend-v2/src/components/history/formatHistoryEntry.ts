import React from 'react';
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
): React.ReactNode | null {
    const adminName = entry.admin_username ?? entry.username ?? '';
    const userName = entry.user_username ?? entry.username ?? '';
    const newValue = entry.new_value ?? '';
    const oldValue = entry.old_value ?? '';
    const safeTimezone = timezone ?? 'UTC';
    const emphasize = (value: string) =>
        React.createElement('span', { className: 'font-medium' }, value);

    const getProgramClassesHistoryEventText = () => {
        let text: React.ReactNode;
        switch (entry.field_name) {
            case 'capacity':
                text = [
                    'Capacity set to ',
                    emphasize(newValue),
                    ' by ',
                    emphasize(adminName)
                ];
                break;
            case 'class':
                text = ['Class created by ', emphasize(adminName)];
                break;
            case 'program':
                text = ['Program created by ', emphasize(adminName)];
                break;
            case 'name':
                text = [
                    'Name set to ',
                    emphasize(newValue),
                    ' by ',
                    emphasize(adminName)
                ];
                break;
            case 'instructor_name':
                text = [
                    'Instructor name set to ',
                    emphasize(newValue),
                    ' by ',
                    emphasize(adminName)
                ];
                break;
            case 'description':
                text = ['Description set by ', emphasize(adminName)];
                break;
            case 'status':
                text = [
                    'Status set to ',
                    emphasize(newValue),
                    ' by ',
                    emphasize(adminName)
                ];
                break;
            case 'archived_at':
                text = ['Archived by ', emphasize(adminName)];
                break;
            case 'credit_hours':
                text = [
                    'Credit hours set to ',
                    emphasize(newValue),
                    ' by ',
                    emphasize(adminName)
                ];
                break;
            case 'funding_type':
                text = [
                    'Funding type set to ',
                    emphasize(formatValue(newValue)),
                    ' by ',
                    emphasize(adminName)
                ];
                break;
            case 'is_active':
                text = [
                    'Program set to ',
                    emphasize(newValue == 'true' ? 'available' : 'inactive'),
                    ' by ',
                    emphasize(adminName)
                ];
                break;
            case 'credit_type':
                text = !newValue
                    ? [
                          'Credit type ',
                          emphasize(formatValue(oldValue)),
                          ' removed by ',
                          emphasize(adminName)
                      ]
                    : [
                          'Credit type set to ',
                          emphasize(formatValue(newValue)),
                          ' by ',
                          emphasize(adminName)
                      ];
                break;
            case 'program_type':
                text = !newValue
                    ? [
                          'Program type ',
                          emphasize(formatValue(oldValue)),
                          ' removed by ',
                          emphasize(adminName)
                      ]
                    : [
                          'Program type set to ',
                          emphasize(formatValue(newValue)),
                          ' by ',
                          emphasize(adminName)
                      ];
                break;
            case 'event_cancelled':
                text = [
                    'Event on ',
                    emphasize(parseRRule(newValue, safeTimezone)),
                    ' cancelled by ',
                    emphasize(adminName)
                ];
                break;
            case 'event_rescheduled':
                text = [
                    'Event on ',
                    emphasize(parseRRule(oldValue, safeTimezone)),
                    ' moved to ',
                    emphasize(newValue),
                    ' by ',
                    emphasize(adminName)
                ];
                break;
            case 'event_rescheduled_series':
                text = [
                    'All future sessions rescheduled starting ',
                    emphasize(parseRRule(newValue, safeTimezone, true)),
                    ' by ',
                    emphasize(adminName)
                ];
                break;
            case 'event_restored':
                text = [
                    emphasize(adminName),
                    ' restored event on ',
                    emphasize(parseRRule(oldValue, safeTimezone))
                ];
        }
        return text;
    };

    let introText;
    switch (entry.action) {
        case 'account_creation':
            introText = ['Account created by ', emphasize(adminName)];
            break;
        case 'user_deactivated':
            introText = ['Account deactivated by ', emphasize(adminName)];
            break;
        case 'facility_transfer':
            introText = [
                'Account assigned to ',
                emphasize(entry.facility_name ?? ''),
                ' by ',
                emphasize(adminName)
            ];
            break;
        case 'set_password':
            introText = ['New password set by ', emphasize(userName)];
            break;
        case 'reset_password':
            introText = [
                'Password reset initiated by ',
                emphasize(adminName)
            ];
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
            introText = [
                'Resident marked ',
                emphasize(formattedStatus),
                ' - ',
                emphasize(entry.class_name ?? ''),
                ', ',
                emphasize(sessionDate),
                ' by ',
                emphasize(adminName)
            ];
            break;
        }
    }

    return introText ?? null;
}
