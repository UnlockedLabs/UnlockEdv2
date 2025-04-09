import { UserAccountHistoryResponse } from '@/common';

function AccountHistoryRowCard({
    activity
}: {
    activity: UserAccountHistoryResponse;
}) {
    let introText;
    switch (activity.action) {
        case 'account_creation':
            introText = 'Account created by ' + activity.admin_username;
            break;
        case 'facility_transfer':
            introText =
                'Account assigned to ' +
                activity.facility_name +
                ' by ' +
                activity.admin_username;
            break;
        case 'set_password':
            introText = 'New password set by ' + activity.user_username;
            break;
        case 'reset_password':
            introText =
                'Password reset initiated by ' + activity.admin_username;
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

export default AccountHistoryRowCard;
