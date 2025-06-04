import { ActivityHistoryResponse } from '@/common';
import { useAuth } from '@/useAuth';
import { RRule } from 'rrule';

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

    function parseRRule(rRule: string, startDtOnly?: boolean): string {
        let rule;
        try {
            rule = RRule.fromString(rRule);
            const eventDate = startDtOnly
                ? rule.options.dtstart
                : rule.all()[0];
            return eventDate.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'numeric',
                day: 'numeric',
                timeZone: user?.timezone
            });
        } catch (error) {
            console.error('error parsing rrule, error is: ', error);
        }
        return rRule; //return rRule back if errors
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
                text = `Event on ${parseRRule(activity.new_value)} cancelled by ${activity.admin_username}`;
                break;
            case 'event_rescheduled':
                text = `Event on ${parseRRule(activity.old_value)} moved to ${activity.new_value} by ${activity.admin_username}`;
                break;
            case 'event_rescheduled_series':
                text = `All future sessions rescheduled starting ${parseRRule(activity.new_value, true)} by ${activity.admin_username}`;
                break;
        }
        return text;
    };

    let introText;
    switch (activity.action) {
        case 'account_creation':
            introText = `Account created by ${activity.admin_username}`;
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
