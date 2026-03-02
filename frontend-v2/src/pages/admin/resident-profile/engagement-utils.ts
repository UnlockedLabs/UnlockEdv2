export type EngagementLevel = 'strong' | 'check-in' | 'support';

interface EngagementIndicator {
    level: EngagementLevel;
    label: string;
    className: string;
}

export function getEngagementIndicator(
    sessionsAttended: number,
    totalSessions: number
): EngagementIndicator {
    const rate =
        totalSessions > 0 ? (sessionsAttended / totalSessions) * 100 : 0;
    if (rate >= 80)
        return {
            level: 'strong',
            label: 'Strong Engagement',
            className: 'bg-green-50 text-green-700 border-green-200'
        };
    if (rate >= 60)
        return {
            level: 'check-in',
            label: 'Check-in Opportunity',
            className: 'bg-yellow-50 text-yellow-700 border-yellow-200'
        };
    return {
        level: 'support',
        label: 'Support Recommended',
        className: 'bg-orange-50 text-orange-700 border-orange-200'
    };
}
