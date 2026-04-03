interface ResidentMetricsProps {
    overallAttendancePercent: number;
    sessionsAttended: number;
    totalSessions: number;
    activeEnrollments: number;
    completedPrograms: number;
}

function MetricCard({
    label,
    value,
    subtitle,
    valueColor,
    valueMargin
}: {
    label: string;
    value: string | number;
    subtitle: string;
    valueColor: string;
    valueMargin?: boolean;
}) {
    return (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-sm text-gray-600 mb-1">{label}</div>
            <div
                className={`text-2xl font-medium ${valueMargin ? 'mb-1' : ''} ${valueColor}`}
            >
                {value}
            </div>
            <div className="text-xs text-gray-500">{subtitle}</div>
        </div>
    );
}

export function ResidentMetrics({
    overallAttendancePercent,
    sessionsAttended,
    totalSessions,
    activeEnrollments,
    completedPrograms
}: ResidentMetricsProps) {
    return (
        <div className="grid grid-cols-3 gap-4 mb-6">
            <MetricCard
                label="Overall Attendance"
                value={`${overallAttendancePercent}%`}
                subtitle={`${sessionsAttended} of ${totalSessions} sessions`}
                valueColor="text-[#556830]"
                valueMargin
            />
            <MetricCard
                label="Active Enrollments"
                value={activeEnrollments}
                subtitle="Currently enrolled"
                valueColor="text-[#203622]"
            />
            <MetricCard
                label="Completed Programs"
                value={completedPrograms}
                subtitle="Successfully finished"
                valueColor="text-[#556830]"
            />
        </div>
    );
}
