import { ActivityHistoryResponse } from '@/common';
import { useAuth } from '@/useAuth';
import { parseRRule } from '../helperFunctions';

function ActivityHistoryRowCard({
    activity
}: {
    activity: ActivityHistoryResponse;
}) {
    const { user } = useAuth();
    if (!user) {
        return null;
    }
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

    const getProgramClassesHistoryEventText = () => {
        let text;
        switch (activity.field_name) {
            case 'capacity':
                text = `Capacity set to ${activity.new_value} by ${activity.admin_username}`;
                break;
            case 'class':
                text = `Class created by ${activity.admin_username}`;
                break;
            case 'program':
                text = `Program created by ${activity.admin_username}`;
                break;
            case 'name':
                text = `Name set to ${activity.new_value} by ${activity.admin_username}`;
                break;
            case 'instructor_name':
                text = `Instructor name set to ${activity.new_value} by ${activity.admin_username}`;
                break;
            case 'description':
                text = `Description set by ${activity.admin_username}`;
                break;
            case 'status':
                text = `Status set to ${activity.new_value} by ${activity.admin_username}`;
                break;
            case 'archived_at':
                text = `Archived by ${activity.admin_username}`;
                break;
            case 'credit_hours':
                text = `Credit hours set to ${activity.new_value} by ${activity.admin_username}`;
                break;
            case 'funding_type':
                text = `Funding type set to ${formatValue(activity.new_value)} by ${activity.admin_username}`;
                break;
            case 'is_active':
                text = `Program set to ${activity.new_value == 'true' ? 'available' : 'inactive'} by ${activity.admin_username}`;
                break;
            case 'credit_type':
                text = `Credit type ${!activity.new_value ? formatValue(activity.old_value) + ' removed ' : 'set to ' + formatValue(activity.new_value)} by ${activity.admin_username}`;
                break;
            case 'program_type':
                text = `Program type ${!activity.new_value ? formatValue(activity.old_value) + ' removed ' : 'set to ' + formatValue(activity.new_value)} by ${activity.admin_username}`;
                break;
            case 'event_cancelled':
                text = `Event on ${parseRRule(activity.new_value, user.timezone)} cancelled by ${activity.admin_username}`;
                break;
            case 'event_rescheduled':
                text = `Event on ${parseRRule(activity.old_value, user.timezone)} moved to ${activity.new_value} by ${activity.admin_username}`;
                break;
            case 'event_rescheduled_series':
                text = `All future sessions rescheduled starting ${parseRRule(activity.new_value, user.timezone, true)} by ${activity.admin_username}`;
                break;
            case 'event_restored':
                text = `${activity.admin_username} restored event on ${parseRRule(activity.old_value, user.timezone)}`;
        }
        return text;
    };

    let introText;
    switch (activity.action) {
        case 'account_creation':
            introText = `Account created by ${activity.admin_username}`;
            break;
        case 'user_deactivated':
            introText = `Account deactivated by ${activity.admin_username}`;
            break;
        case 'facility_transfer':
            introText = `Account assigned to ${activity.facility_name} by ${activity.admin_username}`;
            break;
        case 'set_password':
            introText = `New password set by ${activity.user_username}`;
            break;
        case 'reset_password':
            introText = `Password reset initiated by ${activity.admin_username}`;
            break;
        case 'progclass_history':
            introText = getProgramClassesHistoryEventText();
            break;
        case 'attendance_recorded': {
            const sessionDate = activity.session_date
                ? new Date(
                      new Date(activity.session_date).getTime() +
                          12 * 60 * 60 * 1000
                  ).toLocaleDateString('en-US')
                : '';
            const formattedStatus = activity.attendance_status
                ? formatAttendanceStatus(activity.attendance_status)
                : '';
            introText = `Resident marked ${formattedStatus} - ${activity.class_name}, ${sessionDate} by ${activity.admin_username}`;
            break;
        }
    }
    if (!introText) return;
    return (
        <p className="body">
            {introText} (
            {new Date(activity.created_at).toLocaleDateString('en-US')})
        </p>
    );
}

export default ActivityHistoryRowCard;
