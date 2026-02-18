import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import useSWR from 'swr';
import { useAuth, isDeptAdmin } from '@/auth/useAuth';
import {
    ClassMetrics,
    MissingAttendanceItem,
    Class,
    ProgramOverview,
    ServerResponseMany,
    SelectedClassStatus,
    ServerResponseOne
} from '@/types';
import {
    getClassSchedule,
    isClassToday,
    formatTime12h
} from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
    Tooltip,
    TooltipTrigger,
    TooltipContent
} from '@/components/ui/tooltip';
import {
    AcademicCapIcon,
    UsersIcon,
    ChartBarIcon,
    InformationCircleIcon,
    RectangleStackIcon,
    ListBulletIcon
} from '@heroicons/react/24/outline';
import {
    AlertCircle,
    Calendar,
    CheckCircle,
    ChevronDown,
    Clock,
    ExternalLink
} from 'lucide-react';

export default function Dashboard() {
    const { user } = useAuth();
    const { data: classesResp } = useSWR<ServerResponseMany<Class>>(
        '/api/program-classes?all=true'
    );
    const { data: programsResp } =
        useSWR<ServerResponseMany<ProgramOverview>>('/api/programs');
    const allClasses = useMemo(
        () => classesResp?.data ?? [],
        [classesResp?.data]
    );
    const programs = useMemo(
        () => programsResp?.data ?? [],
        [programsResp?.data]
    );
    const deptAdmin = user ? isDeptAdmin(user) : false;
    const classMetricsUrl = deptAdmin
        ? '/api/dashboard/class-metrics?facility=all'
        : '/api/dashboard/class-metrics';
    const { data: classMetricsResp } =
        useSWR<ServerResponseOne<ClassMetrics>>(classMetricsUrl);
    const missingAttendanceUrl = deptAdmin
        ? '/api/program-classes/missing-attendance?facility=all&days=3&all=true'
        : '/api/program-classes/missing-attendance?days=3&all=true';
    const { data: missingAttendanceResp, isLoading: missingAttendanceLoading } =
        useSWR<ServerResponseMany<MissingAttendanceItem>>(missingAttendanceUrl);
    const facilityClasses = useMemo(() => {
        if (deptAdmin || !user) return allClasses;
        return allClasses.filter((c) => c.facility_id === user.facility.id);
    }, [allClasses, deptAdmin, user]);

    return (
        <div className="bg-[#E7EAED] dark:bg-[#0a0a0a] -mx-6 -my-4 min-h-screen overflow-x-hidden">
            <div className="max-w-7xl mx-auto px-6 py-8">
                {deptAdmin ? (
                    <DeptAdminView
                        classes={allClasses}
                        programs={programs}
                        metrics={classMetricsResp?.data}
                        missingAttendance={missingAttendanceResp?.data ?? []}
                        missingAttendanceLoading={missingAttendanceLoading}
                    />
                ) : (
                    <FacilityAdminView
                        classes={facilityClasses}
                        facilityName={user?.facility.name ?? 'My Facility'}
                        metrics={classMetricsResp?.data}
                        missingAttendance={missingAttendanceResp?.data ?? []}
                        missingAttendanceLoading={missingAttendanceLoading}
                    />
                )}
            </div>
        </div>
    );
}

function FacilityAdminView({
    classes,
    facilityName,
    metrics,
    missingAttendance,
    missingAttendanceLoading
}: {
    classes: Class[];
    facilityName: string;
    metrics?: ClassMetrics;
    missingAttendance: MissingAttendanceItem[];
    missingAttendanceLoading: boolean;
}) {
    const navigate = useNavigate();
    const stats = useMemo(() => {
        const base = computeStats(classes);
        if (!metrics) return base;
        const scheduledClasses = base.scheduledClasses;
        const totalCapacity = metrics.total_seats;
        const totalEnrollment = metrics.total_enrollments;
        const capacityUtilization =
            totalCapacity > 0
                ? Math.round((totalEnrollment / totalCapacity) * 100)
                : 0;
        return {
            scheduledClasses,
            activeClasses: metrics.active_classes,
            totalEnrollment,
            totalCapacity,
            capacityUtilization,
            attendanceConcerns: metrics.attendance_concerns
        };
    }, [classes, metrics]);
    const handleAttendanceNavigate = (cls: Class) => {
        const eventId =
            cls.events?.find((event) => !event.is_cancelled)?.id ??
            cls.events?.[0]?.id;
        if (!eventId) {
            navigate('/program-classes/' + cls.id + '/attendance');
            return;
        }
        const today = new Date();
        const yyyy = String(today.getFullYear());
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        const date = `${yyyy}-${mm}-${dd}`;
        navigate(
            `/program-classes/${cls.id}/events/${eventId}/attendance/${date}`
        );
    };

    return (
        <div>
            <div className="mb-6">
                <h1 className="text-[1.5rem] leading-[1.5] font-medium font-sans text-[#203622] dark:text-white mb-2">
                    Facility Dashboard
                </h1>
                <p className="text-gray-600 dark:text-gray-400">
                    {facilityName}
                </p>
            </div>

            <MetricCards stats={stats} onNavigate={navigate} />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                    <TodaysSchedule
                        classes={classes}
                        onNavigate={handleAttendanceNavigate}
                    />
                </div>
                <div className="space-y-6">
                    <MissingAttendanceWidget
                        items={missingAttendance}
                        isLoading={missingAttendanceLoading}
                        variant="facility"
                    />
                    <QuickActions navigate={navigate} />
                </div>
            </div>
        </div>
    );
}

function DeptAdminView({
    classes,
    programs,
    metrics,
    missingAttendance,
    missingAttendanceLoading
}: {
    classes: Class[];
    programs: ProgramOverview[];
    metrics?: ClassMetrics;
    missingAttendance: MissingAttendanceItem[];
    missingAttendanceLoading: boolean;
}) {
    const navigate = useNavigate();
    const stats = useMemo(() => {
        const base = computeStats(classes);
        if (!metrics) return base;
        const totalCapacity = metrics.total_seats;
        const totalEnrollment = metrics.total_enrollments;
        const capacityUtilization =
            totalCapacity > 0
                ? Math.round((totalEnrollment / totalCapacity) * 100)
                : 0;
        return {
            ...base,
            activeClasses: metrics.active_classes,
            totalEnrollment,
            totalCapacity,
            capacityUtilization,
            attendanceConcerns: metrics.attendance_concerns
        };
    }, [classes, metrics]);

    const facilityRows = useMemo((): FacilityHealthRow[] => {
        const facilityMap = new Map<
            number,
            { name: string; classes: Class[]; programIds: Set<number> }
        >();

        for (const cls of classes) {
            const existing = facilityMap.get(cls.facility_id);
            if (existing) {
                existing.classes.push(cls);
                existing.programIds.add(cls.program_id);
            } else {
                facilityMap.set(cls.facility_id, {
                    name: cls.facility_name,
                    classes: [cls],
                    programIds: new Set([cls.program_id])
                });
            }
        }

        return Array.from(facilityMap.values()).map((facility) => {
            const active = facility.classes.filter(
                (c) => c.status === SelectedClassStatus.Active
            );
            const enrollment = active.reduce((sum, c) => sum + c.enrolled, 0);
            const missing = active.filter(
                (c) => c.enrolled > 0 && new Date(c.start_dt) <= new Date()
            ).length;
            const concerns = active.filter(
                (c) => c.enrolled > 0 && isClassToday(c)
            ).length;

            return {
                facilityName: facility.name,
                programs: facility.programIds.size,
                activeClasses: active.length,
                enrollment,
                missingAttendance: missing,
                attendanceConcerns: concerns
            };
        });
    }, [classes]);

    return (
        <div>
            <div className="mb-6">
                <h1 className="text-[1.5rem] leading-[1.5] font-medium font-sans text-[#203622] dark:text-white mb-2">
                    Department Overview
                </h1>
                <p className="text-gray-600 dark:text-gray-400">
                    {programs.length} programs across {facilityRows.length}{' '}
                    facilities
                </p>
            </div>

            <MetricCards stats={stats} onNavigate={navigate} />

            <div className="space-y-6">
                <FacilityHealthTable rows={facilityRows} />
                <div className="flex gap-6 flex-wrap lg:flex-nowrap">
                    <div className="flex-1 lg:flex-[2] min-w-[300px]">
                        <MissingAttendanceWidget
                            items={missingAttendance}
                            isLoading={missingAttendanceLoading}
                            variant="department"
                        />
                    </div>
                    <div className="flex-1 lg:flex-[1] min-w-[250px]">
                        <QuickActions navigate={navigate} />
                    </div>
                </div>
            </div>
        </div>
    );
}

interface MetricCardProps {
    icon: React.ReactNode;
    iconBg: string;
    label: string;
    value: string | number;
    tooltip: string;
    subtitle: string;
    tooltipAction?: React.ReactNode;
}

function MetricCard({
    icon,
    iconBg,
    label,
    value,
    tooltip,
    subtitle,
    tooltipAction
}: MetricCardProps) {
    return (
        <div className="bg-white dark:bg-[#171717] rounded-lg border border-gray-200 dark:border-[#262626] p-4">
            <div className="flex items-center gap-3 mb-3">
                <div className={cn('p-2 rounded', iconBg)}>{icon}</div>
                <div className="text-2xl text-[#203622] dark:text-white">
                    {value}
                </div>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <button className="ml-auto">
                            <InformationCircleIcon className="size-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" />
                        </button>
                    </TooltipTrigger>
                    <TooltipContent className="bg-gray-900 text-white max-w-xs">
                        <p className={tooltipAction ? 'mb-2' : undefined}>
                            {tooltip}
                        </p>
                        {tooltipAction}
                    </TooltipContent>
                </Tooltip>
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
                {label}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                {subtitle}
            </div>
        </div>
    );
}

interface DashboardStats {
    activeClasses: number;
    totalEnrollment: number;
    totalCapacity: number;
    capacityUtilization: number;
    attendanceConcerns: number;
    scheduledClasses: number;
}

function computeStats(classes: Class[]): DashboardStats {
    const active = classes.filter(
        (c) => c.status === SelectedClassStatus.Active
    );
    const scheduled = classes.filter(
        (c) => c.status === SelectedClassStatus.Scheduled
    );
    const totalEnrollment = active.reduce((sum, c) => sum + c.enrolled, 0);
    const totalCapacity = active.reduce((sum, c) => sum + c.capacity, 0);
    const capacityUtilization =
        totalCapacity > 0
            ? Math.round((totalEnrollment / totalCapacity) * 100)
            : 0;
    const attendanceConcerns = active.filter(
        (c) => c.enrolled > 0 && isClassToday(c)
    ).length;

    return {
        activeClasses: active.length,
        totalEnrollment,
        totalCapacity,
        capacityUtilization,
        attendanceConcerns,
        scheduledClasses: scheduled.length
    };
}

function TodaysSchedule({
    classes,
    onNavigate
}: {
    classes: Class[];
    onNavigate: (cls: Class) => void;
}) {
    const navigate = useNavigate();
    const today = new Date();
    const dateLabel = today.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric'
    });

    const todayClasses = useMemo(() => {
        return classes
            .filter(
                (c) =>
                    isClassToday(c) && c.status === SelectedClassStatus.Active
            )
            .sort((a, b) => {
                const schedA = getClassSchedule(a);
                const schedB = getClassSchedule(b);
                return schedA.startTime.localeCompare(schedB.startTime);
            });
    }, [classes]);

    return (
        <div className="bg-white dark:bg-[#171717] rounded-lg border border-gray-200 dark:border-[#262626]">
            <div className="border-b border-gray-200 dark:border-[#262626] px-6 py-4 flex items-center justify-between">
                <div>
                    <h2 className="text-[#203622] dark:text-white">
                        Today's Schedule
                    </h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {dateLabel}
                    </p>
                </div>
                <button
                    onClick={() => navigate('/classes')}
                    className="text-sm text-[#556830] hover:text-[#203622] dark:text-[#8fb55e] dark:hover:text-white transition-colors"
                >
                    View all classes &rarr;
                </button>
            </div>
            <div className="p-6">
                {todayClasses.length > 0 ? (
                    <div className="space-y-3">
                        {todayClasses.map((cls) => {
                            const schedule = getClassSchedule(cls);
                            return (
                                <div
                                    key={cls.id}
                                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 bg-[#E2E7EA] dark:bg-[#262626] rounded-lg hover:bg-gray-100 dark:hover:bg-[#262626]/80 transition-colors group"
                                >
                                    <div
                                        onClick={() =>
                                            navigate(
                                                '/program-classes/' + cls.id
                                            )
                                        }
                                        className="flex items-center gap-4 flex-1 cursor-pointer min-w-0"
                                    >
                                        <div className="flex items-center gap-2 min-w-[80px] shrink-0">
                                            <Clock className="size-4 text-gray-500 dark:text-gray-400" />
                                            <span className="text-sm text-[#203622] dark:text-white">
                                                {formatTime12h(
                                                    schedule.startTime
                                                )}
                                            </span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-[#203622] dark:text-white group-hover:text-[#556830] transition-colors truncate">
                                                {cls.name}
                                            </div>
                                            <div className="text-sm text-gray-600 dark:text-gray-400 truncate">
                                                {cls.instructor_name}
                                            </div>
                                        </div>
                                        <div className="text-sm text-gray-500 dark:text-gray-400 min-w-[160px] hidden md:block">
                                            {schedule.room || '-'}
                                        </div>
                                    </div>
                                    <Button
                                        size="sm"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onNavigate(cls);
                                        }}
                                        className="bg-[#556830] hover:bg-[#203622] text-white w-full sm:w-auto"
                                    >
                                        Take Attendance
                                    </Button>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                        <Calendar className="size-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
                        <p>No classes scheduled for today</p>
                    </div>
                )}
            </div>
        </div>
    );
}

function MissingAttendanceWidget({
    items,
    isLoading,
    variant
}: {
    items: MissingAttendanceItem[];
    isLoading: boolean;
    variant: 'department' | 'facility';
}) {
    const [showAll, setShowAll] = useState(false);
    const navigate = useNavigate();

    const missingAttendance = useMemo(() => items, [items]);

    const sliceCount = 3;
    const displayList = showAll
        ? missingAttendance
        : missingAttendance.slice(0, sliceCount);
    const remainingCount = missingAttendance.length - sliceCount;

    const isDepartment = variant === 'department';

    return (
        <div className="bg-white dark:bg-[#171717] rounded-lg border border-gray-200 dark:border-[#262626] p-6">
            <div className="flex items-center gap-2 mb-4">
                <AlertCircle className="size-5 text-[#F1B51C]" />
                <h3 className="text-[#203622] dark:text-white">
                    Missing Attendance
                </h3>
            </div>

            {missingAttendance.length > 0 ? (
                <>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                        {isDepartment
                            ? 'Past 3 days - across all facilities'
                            : 'Past 3 days'}
                    </p>
                    <div className="space-y-3">
                        {displayList.map((item) => {
                            const dayLabel = new Date(
                                `${item.date}T00:00:00`
                            ).toLocaleDateString('en-US', {
                                weekday: 'long'
                            });
                            return (
                                <div
                                    key={`${item.class_id}-${item.date}-${item.event_id}`}
                                    className={cn(
                                        'p-3 bg-amber-50 dark:bg-[#262626] border border-amber-200 dark:border-[#F1B51C]/30 rounded-lg',
                                        isDepartment
                                            ? 'hover:bg-amber-100 dark:hover:bg-[#262626]/80 transition-colors cursor-pointer'
                                            : undefined
                                    )}
                                    onClick={() => {
                                        if (isDepartment) {
                                            navigate(
                                                '/program-classes/' +
                                                    item.class_id
                                            );
                                        }
                                    }}
                                >
                                    {isDepartment && (
                                        <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                                            {item.facility_name}
                                        </div>
                                    )}
                                    <div className="text-sm text-[#203622] dark:text-[#F1B51C] mb-1">
                                        {item.class_name}
                                    </div>
                                    <div className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                                        {dayLabel} -{' '}
                                        {formatTime12h(item.start_time)}
                                    </div>
                                    {!isDepartment && (
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() =>
                                                navigate(
                                                    '/program-classes/' +
                                                        item.class_id +
                                                        '/events/' +
                                                        item.event_id +
                                                        '/attendance/' +
                                                        item.date
                                                )
                                            }
                                            className="w-full text-xs border-[#F1B51C] text-[#F1B51C] hover:bg-[#F1B51C] hover:text-white dark:border-[#F1B51C] dark:text-[#F1B51C]"
                                        >
                                            Take Attendance
                                        </Button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                    {!showAll && remainingCount > 0 && (
                        <button
                            onClick={() => setShowAll(true)}
                            className="w-full mt-3 py-2 text-sm text-[#556830] hover:text-[#203622] dark:text-[#8fb55e] dark:hover:text-white hover:bg-[#E2E7EA] dark:hover:bg-[#262626] rounded-lg transition-colors flex items-center justify-center gap-2"
                        >
                            Show {remainingCount} more{' '}
                            <ChevronDown className="size-4" />
                        </button>
                    )}
                </>
            ) : isLoading ? (
                <div className="text-sm text-gray-500 dark:text-gray-400 py-4 text-center">
                    Loading missing attendance...
                </div>
            ) : (
                <div className="text-sm text-gray-500 dark:text-gray-400 py-4">
                    <CheckCircle className="size-8 mx-auto mb-2 text-[#556830] dark:text-[#8fb55e]" />
                    <p className="text-center">All attendance up to date</p>
                </div>
            )}
        </div>
    );
}

function QuickActions({ navigate }: { navigate: (path: string) => void }) {
    return (
        <div className="bg-white dark:bg-[#171717] rounded-lg border border-gray-200 dark:border-[#262626] p-6">
            <h3 className="text-[#203622] dark:text-white mb-4">
                Quick Actions
            </h3>
            <div className="space-y-3">
                <Tooltip>
                    <TooltipTrigger asChild>
                        <button
                            onClick={() => navigate('/programs')}
                            className="w-full flex items-center gap-3 bg-white dark:bg-[#262626] hover:bg-[#E2E7EA] dark:hover:bg-[#262626]/80 text-[#203622] dark:text-white px-4 py-3 rounded-lg border border-gray-200 dark:border-[#262626] transition-colors"
                        >
                            <RectangleStackIcon className="size-5 text-[#556830] dark:text-[#8fb55e]" />
                            <span className="text-sm">View All Programs</span>
                        </button>
                    </TooltipTrigger>
                    <TooltipContent className="bg-gray-900 text-white">
                        <p>Browse all programs at your facility</p>
                    </TooltipContent>
                </Tooltip>

                <Tooltip>
                    <TooltipTrigger asChild>
                        <button
                            onClick={() => navigate('/classes')}
                            className="w-full flex items-center gap-3 bg-white dark:bg-[#262626] hover:bg-[#E2E7EA] dark:hover:bg-[#262626]/80 text-[#203622] dark:text-white px-4 py-3 rounded-lg border border-gray-200 dark:border-[#262626] transition-colors"
                        >
                            <ListBulletIcon className="size-5 text-[#556830] dark:text-[#8fb55e]" />
                            <span className="text-sm">Browse Classes</span>
                        </button>
                    </TooltipTrigger>
                    <TooltipContent className="bg-gray-900 text-white">
                        <p>View and manage all classes</p>
                    </TooltipContent>
                </Tooltip>
            </div>
        </div>
    );
}

interface FacilityHealthRow {
    facilityName: string;
    programs: number;
    activeClasses: number;
    enrollment: number;
    missingAttendance: number;
    attendanceConcerns: number;
}

function FacilityHealthTable({ rows }: { rows: FacilityHealthRow[] }) {
    if (rows.length === 0) {
        return (
            <div className="bg-white dark:bg-[#171717] rounded-lg border border-gray-200 dark:border-[#262626] p-6">
                <h3 className="text-[#203622] dark:text-white mb-4">
                    Facility Health Overview
                </h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm text-center py-4">
                    No facility data available.
                </p>
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-[#171717] rounded-lg border border-gray-200 dark:border-[#262626] overflow-hidden">
            <h3 className="text-[#203622] dark:text-white px-6 py-4">
                Facility Health Overview
            </h3>
            <table className="w-full">
                <thead className="bg-[#E2E7EA] dark:bg-[#262626] border-b border-gray-200 dark:border-[#262626]">
                    <tr>
                        <th className="text-left px-6 py-3 text-sm text-[#203622] dark:text-white">
                            Facility
                        </th>
                        <th className="text-left px-6 py-3 text-sm text-[#203622] dark:text-white">
                            Programs
                        </th>
                        <th className="text-left px-6 py-3 text-sm text-[#203622] dark:text-white">
                            Active Classes
                        </th>
                        <th className="text-left px-6 py-3 text-sm text-[#203622] dark:text-white">
                            Enrollment
                        </th>
                        <th className="text-left px-6 py-3 text-sm text-[#203622] dark:text-white">
                            <div className="flex items-center gap-1">
                                Missing Attendance
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <button>
                                            <InformationCircleIcon className="size-3.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" />
                                        </button>
                                    </TooltipTrigger>
                                    <TooltipContent className="bg-gray-900 text-white max-w-xs">
                                        <p>
                                            Classes where attendance hasn't been
                                            recorded yet (past 3 days)
                                        </p>
                                    </TooltipContent>
                                </Tooltip>
                            </div>
                        </th>
                        <th className="text-left px-6 py-3 text-sm text-[#203622] dark:text-white">
                            <div className="flex items-center gap-1">
                                Attendance Concerns
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <button>
                                            <InformationCircleIcon className="size-3.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" />
                                        </button>
                                    </TooltipTrigger>
                                    <TooltipContent className="bg-gray-900 text-white max-w-xs">
                                        <p>
                                            Classes with patterns of high
                                            resident absences (engagement issue)
                                        </p>
                                    </TooltipContent>
                                </Tooltip>
                            </div>
                        </th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-[#262626]">
                    {rows.map((row) => (
                        <tr
                            key={row.facilityName}
                            className="hover:bg-[#E2E7EA]/50 dark:hover:bg-[#262626]/50 cursor-pointer transition-colors"
                        >
                            <td className="px-6 py-4">
                                <div className="text-[#203622] dark:text-white hover:text-[#556830] dark:hover:text-[#8fb55e] transition-colors">
                                    {row.facilityName}
                                </div>
                            </td>
                            <td className="px-6 py-4">
                                <div className="text-sm text-gray-700 dark:text-gray-400">
                                    {row.programs}
                                </div>
                            </td>
                            <td className="px-6 py-4">
                                <div className="text-sm text-gray-700 dark:text-gray-400">
                                    {row.activeClasses}
                                </div>
                            </td>
                            <td className="px-6 py-4">
                                <div className="text-sm text-gray-700 dark:text-gray-400">
                                    {row.enrollment}
                                </div>
                            </td>
                            <td className="px-6 py-4">
                                {row.missingAttendance > 0 ? (
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm text-[#F1B51C]">
                                            {row.missingAttendance}
                                        </span>
                                        <span className="text-xs text-gray-500">
                                            classes
                                        </span>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-1">
                                        <CheckCircle className="size-4 text-[#556830] dark:text-[#8fb55e]" />
                                        <span className="text-xs text-gray-500">
                                            Up to date
                                        </span>
                                    </div>
                                )}
                            </td>
                            <td className="px-6 py-4">
                                {row.attendanceConcerns > 0 ? (
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm text-amber-600 dark:text-[#F1B51C]">
                                            {row.attendanceConcerns}
                                        </span>
                                        <span className="text-xs text-gray-500">
                                            classes
                                        </span>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-1">
                                        <CheckCircle className="size-4 text-[#556830] dark:text-[#8fb55e]" />
                                        <span className="text-xs text-gray-500">
                                            None
                                        </span>
                                    </div>
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function MetricCards({
    stats,
    onNavigate
}: {
    stats: DashboardStats;
    onNavigate: (path: string) => void;
}) {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <MetricCard
                icon={
                    <AcademicCapIcon className="size-5 text-[#556830] dark:text-[#8fb55e]" />
                }
                iconBg="bg-[#E2E7EA] dark:bg-[#262626]"
                label="Active Classes"
                value={stats.activeClasses}
                tooltip="Classes currently in Active status with enrolled residents"
                subtitle={`${stats.scheduledClasses} scheduled`}
            />
            <MetricCard
                icon={
                    <UsersIcon className="size-5 text-[#556830] dark:text-[#8fb55e]" />
                }
                iconBg="bg-[#E2E7EA] dark:bg-[#262626]"
                label="Total Enrollment"
                value={stats.totalEnrollment}
                tooltip="Number of residents enrolled across all active classes"
                subtitle="Across all programs"
            />
            <MetricCard
                icon={
                    <ChartBarIcon className="size-5 text-[#556830] dark:text-[#8fb55e]" />
                }
                iconBg="bg-[#E2E7EA] dark:bg-[#262626]"
                label="Capacity Utilization"
                value={`${stats.capacityUtilization}%`}
                tooltip="Percentage of available seats filled across all classes"
                subtitle={`${stats.totalEnrollment} of ${stats.totalCapacity} seats`}
            />
            <MetricCard
                icon={<AlertCircle className="size-5 text-[#F1B51C]" />}
                iconBg="bg-amber-50 dark:bg-[#262626]"
                label="Attendance Concerns"
                value={stats.attendanceConcerns}
                tooltip="Classes with patterns of high absences (3+ unexcused per week)"
                subtitle="High absence patterns"
                tooltipAction={
                    <button
                        onClick={() => onNavigate('/classes')}
                        className="text-[#F1B51C] hover:text-[#d9a419] flex items-center gap-1 text-xs"
                    >
                        View classes <ExternalLink className="size-3" />
                    </button>
                }
            />
        </div>
    );
}
