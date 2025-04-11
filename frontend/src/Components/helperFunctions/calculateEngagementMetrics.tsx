import { ResidentEngagementProfile } from '@/common';

const calculateEngagementMetrics = (
    metrics: ResidentEngagementProfile | undefined
) => {
    const isLessAvgThanOneHour =
        (metrics?.activity_engagement.total_hours_active_weekly ?? 0) < 1;
    const isLessThanOneHour =
        (metrics?.activity_engagement.total_hours_engaged ?? 0) < 1;

    const avgNumber = isLessAvgThanOneHour
        ? (
              metrics?.activity_engagement.total_minutes_active_weekly ?? 0
          ).toFixed(2)
        : (metrics?.activity_engagement.total_hours_active_weekly ?? 0).toFixed(
              2
          );

    const weekNumber = isLessThanOneHour
        ? (metrics?.activity_engagement.total_minutes_engaged ?? 0).toFixed(2)
        : (metrics?.activity_engagement.total_hours_engaged ?? 0).toFixed(2);

    const avgLabel = isLessAvgThanOneHour ? 'Min' : 'Hrs';
    const weekLabel = isLessThanOneHour ? 'Minutes' : 'Hours';

    return { avgNumber, weekNumber, avgLabel, weekLabel };
};

export default calculateEngagementMetrics;
