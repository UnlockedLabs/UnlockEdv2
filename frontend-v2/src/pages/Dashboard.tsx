import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import useSWR from 'swr';
import { useAuth, isDeptAdmin } from '@/auth/useAuth';
import {
    Class,
    ProgramOverview,
    ServerResponseMany,
    SelectedClassStatus
} from '@/types';
import { getClassSchedule, isClassToday, formatTime12h } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
    Tooltip,
    TooltipTrigger,
    TooltipContent
} from '@/components/ui/tooltip';
import {
    BookOpenIcon,
    UsersIcon,
    ChartBarIcon,
    ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import { ClipboardList, ArrowRight, ChevronDown, ChevronUp } from 'lucide-react';

interface MetricCardProps {
    icon: React.ReactNode;
    iconBg: string;
    label: string;
    value: string | number;
    tooltip: string;
    subtitle: string;
}

function MetricCard({ icon, iconBg, label, value, tooltip, subtitle }: MetricCardProps) {
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <div className="bg-white rounded-lg border border-gray-200 p-5 flex items-start gap-4">
                    <div className={cn('rounded-lg p-2.5 shrink-0', iconBg)}>
                        {icon}
                    </div>
                    <div className="min-w-0">
                        <p className="text-sm text-gray-500">{label}</p>
                        <p className="text-2xl font-semibold text-[#203622]">
                            {value}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>
                    </div>
                </div>
            </TooltipTrigger>
            <TooltipContent>{tooltip}</TooltipContent>
        </Tooltip>
    );
}

interface DashboardStats {
    activeClasses: number;
    totalEnrollment: number;
    capacityUtilization: number;
    attendanceConcerns: number;
}

function computeStats(classes: Class[]): DashboardStats {
    const active = classes.filter(
        (c) => c.status === SelectedClassStatus.Active
    );
    const totalEnrollment = active.reduce((sum, c) => sum + c.enrolled, 0);
    const totalCapacity = active.reduce((sum, c) => sum + c.capacity, 0);
    const capacityUtilization =
        totalCapacity > 0 ? Math.round((totalEnrollment / totalCapacity) * 100) : 0;
    const attendanceConcerns = active.filter(
        (c) => c.enrolled > 0 && isClassToday(c)
    ).length;

    return {
        activeClasses: active.length,
        totalEnrollment,
        capacityUtilization,
        attendanceConcerns
    };
}

function TodaysScheduleTable({
    classes,
    onNavigate
}: {
    classes: Class[];
    onNavigate: (id: number) => void;
}) {
    const todayClasses = useMemo(() => {
        return classes
            .filter((c) => isClassToday(c) && c.status === SelectedClassStatus.Active)
            .sort((a, b) => {
                const schedA = getClassSchedule(a);
                const schedB = getClassSchedule(b);
                return schedA.startTime.localeCompare(schedB.startTime);
            });
    }, [classes]);

    if (todayClasses.length === 0) {
        return (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-[#203622] mb-4">
                    Today's Schedule
                </h3>
                <p className="text-gray-500 text-sm py-8 text-center">
                    No classes scheduled for today.
                </p>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-[#203622] mb-4">
                Today's Schedule
            </h3>
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-gray-100">
                            <th className="text-left py-2 pr-4 text-gray-500 font-medium">
                                Time
                            </th>
                            <th className="text-left py-2 pr-4 text-gray-500 font-medium">
                                Class
                            </th>
                            <th className="text-left py-2 pr-4 text-gray-500 font-medium">
                                Instructor
                            </th>
                            <th className="text-left py-2 pr-4 text-gray-500 font-medium">
                                Room
                            </th>
                            <th className="text-right py-2 text-gray-500 font-medium">
                                Action
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {todayClasses.map((cls) => {
                            const schedule = getClassSchedule(cls);
                            return (
                                <tr
                                    key={cls.id}
                                    className="border-b border-gray-50 last:border-0"
                                >
                                    <td className="py-3 pr-4 text-[#203622] font-medium whitespace-nowrap">
                                        {formatTime12h(schedule.startTime)}
                                        {schedule.endTime &&
                                            ` - ${formatTime12h(schedule.endTime)}`}
                                    </td>
                                    <td className="py-3 pr-4 text-[#203622]">
                                        {cls.name}
                                    </td>
                                    <td className="py-3 pr-4 text-gray-600">
                                        {cls.instructor_name}
                                    </td>
                                    <td className="py-3 pr-4 text-gray-600">
                                        {schedule.room || '-'}
                                    </td>
                                    <td className="py-3 text-right">
                                        <Button
                                            size="sm"
                                            className="bg-[#F1B51C] text-[#203622] hover:bg-[#F1B51C]/90"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onNavigate(cls.id);
                                            }}
                                        >
                                            <ClipboardList className="size-4" />
                                            Take Attendance
                                        </Button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function MissingAttendanceWidget({
    classes,
    expandable
}: {
    classes: Class[];
    expandable?: boolean;
}) {
    const [expanded, setExpanded] = useState(false);

    const missingAttendance = useMemo(() => {
        const now = new Date();
        const threeDaysAgo = new Date(now);
        threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

        return classes.filter(
            (c) =>
                c.status === SelectedClassStatus.Active &&
                c.enrolled > 0 &&
                new Date(c.start_dt) <= now
        );
    }, [classes]);

    const displayList = expandable && !expanded
        ? missingAttendance.slice(0, 5)
        : missingAttendance;

    return (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
                <ExclamationTriangleIcon className="size-5 text-amber-500" />
                <h3 className="text-lg font-semibold text-[#203622]">
                    Missing Attendance
                </h3>
                {missingAttendance.length > 0 && (
                    <span className="ml-auto bg-amber-100 text-amber-700 text-xs font-medium px-2 py-0.5 rounded-full">
                        {missingAttendance.length}
                    </span>
                )}
            </div>
            {missingAttendance.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-4">
                    All attendance records are up to date.
                </p>
            ) : (
                <>
                    <ul className="space-y-2">
                        {displayList.map((cls) => (
                            <li
                                key={cls.id}
                                className="flex items-center justify-between py-2 px-3 rounded-md bg-amber-50/50 border border-amber-100"
                            >
                                <div>
                                    <p className="text-sm font-medium text-[#203622]">
                                        {cls.name}
                                    </p>
                                    <p className="text-xs text-gray-500">
                                        {cls.instructor_name}
                                        {cls.facility_name && ` - ${cls.facility_name}`}
                                    </p>
                                </div>
                                <span className="text-xs text-amber-600 font-medium">
                                    {cls.enrolled} enrolled
                                </span>
                            </li>
                        ))}
                    </ul>
                    {expandable && missingAttendance.length > 5 && (
                        <button
                            onClick={() => setExpanded(!expanded)}
                            className="flex items-center gap-1 text-sm text-[#556830] mt-3 hover:underline"
                        >
                            {expanded ? (
                                <>
                                    Show less <ChevronUp className="size-4" />
                                </>
                            ) : (
                                <>
                                    Show {missingAttendance.length - 5} more{' '}
                                    <ChevronDown className="size-4" />
                                </>
                            )}
                        </button>
                    )}
                </>
            )}
        </div>
    );
}

function QuickActions({ navigate }: { navigate: (path: string) => void }) {
    return (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-[#203622] mb-4">
                Quick Actions
            </h3>
            <div className="space-y-3">
                <Button
                    variant="outline"
                    className="w-full justify-between border-gray-200 text-[#203622] hover:bg-[#E2E7EA]/50"
                    onClick={() => navigate('/programs')}
                >
                    View All Programs
                    <ArrowRight className="size-4" />
                </Button>
                <Button
                    variant="outline"
                    className="w-full justify-between border-gray-200 text-[#203622] hover:bg-[#E2E7EA]/50"
                    onClick={() => navigate('/classes')}
                >
                    Browse Classes
                    <ArrowRight className="size-4" />
                </Button>
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
            <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-[#203622] mb-4">
                    Facility Health Overview
                </h3>
                <p className="text-gray-500 text-sm text-center py-4">
                    No facility data available.
                </p>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-[#203622] mb-4">
                Facility Health Overview
            </h3>
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-gray-100">
                            <th className="text-left py-2 pr-4 text-gray-500 font-medium">
                                Facility
                            </th>
                            <th className="text-left py-2 pr-4 text-gray-500 font-medium">
                                Programs
                            </th>
                            <th className="text-left py-2 pr-4 text-gray-500 font-medium">
                                Active Classes
                            </th>
                            <th className="text-left py-2 pr-4 text-gray-500 font-medium">
                                Enrollment
                            </th>
                            <th className="text-left py-2 pr-4 text-gray-500 font-medium">
                                Missing Attendance
                            </th>
                            <th className="text-left py-2 text-gray-500 font-medium">
                                Attendance Concerns
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row) => (
                            <tr
                                key={row.facilityName}
                                className="border-b border-gray-50 last:border-0"
                            >
                                <td className="py-3 pr-4 font-medium text-[#203622]">
                                    {row.facilityName}
                                </td>
                                <td className="py-3 pr-4 text-gray-600">
                                    {row.programs}
                                </td>
                                <td className="py-3 pr-4 text-gray-600">
                                    {row.activeClasses}
                                </td>
                                <td className="py-3 pr-4 text-gray-600">
                                    {row.enrollment}
                                </td>
                                <td className="py-3 pr-4">
                                    {row.missingAttendance > 0 ? (
                                        <span className="text-amber-600 font-medium">
                                            {row.missingAttendance}
                                        </span>
                                    ) : (
                                        <span className="text-gray-400">0</span>
                                    )}
                                </td>
                                <td className="py-3">
                                    {row.attendanceConcerns > 0 ? (
                                        <span className="text-red-600 font-medium">
                                            {row.attendanceConcerns}
                                        </span>
                                    ) : (
                                        <span className="text-gray-400">0</span>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function FacilityAdminView({
    classes,
    facilityName
}: {
    classes: Class[];
    facilityName: string;
}) {
    const navigate = useNavigate();
    const stats = useMemo(() => computeStats(classes), [classes]);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-[#203622]">
                    Facility Dashboard
                </h1>
                <p className="text-gray-500 mt-1">{facilityName}</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                    icon={<BookOpenIcon className="size-5 text-white" />}
                    iconBg="bg-[#556830]"
                    label="Active Classes"
                    value={stats.activeClasses}
                    tooltip="Number of classes currently in Active status"
                    subtitle="Currently running"
                />
                <MetricCard
                    icon={<UsersIcon className="size-5 text-white" />}
                    iconBg="bg-[#203622]"
                    label="Total Enrollment"
                    value={stats.totalEnrollment}
                    tooltip="Total students enrolled across all active classes"
                    subtitle="Across active classes"
                />
                <MetricCard
                    icon={<ChartBarIcon className="size-5 text-white" />}
                    iconBg="bg-[#556830]"
                    label="Capacity Utilization"
                    value={`${stats.capacityUtilization}%`}
                    tooltip="Percentage of total capacity filled across active classes"
                    subtitle="Of available seats filled"
                />
                <MetricCard
                    icon={
                        <ExclamationTriangleIcon className="size-5 text-white" />
                    }
                    iconBg="bg-amber-500"
                    label="Attendance Concerns"
                    value={stats.attendanceConcerns}
                    tooltip="Active classes scheduled today that may need attendance tracking"
                    subtitle="Classes needing attention"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                    <TodaysScheduleTable
                        classes={classes}
                        onNavigate={(id) =>
                            navigate('/program-classes/' + id)
                        }
                    />
                </div>
                <div className="space-y-6">
                    <MissingAttendanceWidget classes={classes} />
                    <QuickActions navigate={navigate} />
                </div>
            </div>
        </div>
    );
}

function DeptAdminView({
    classes,
    programs
}: {
    classes: Class[];
    programs: ProgramOverview[];
}) {
    const navigate = useNavigate();
    const stats = useMemo(() => computeStats(classes), [classes]);

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
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-[#203622]">
                    Department Overview
                </h1>
                <p className="text-gray-500 mt-1">
                    {programs.length} programs across {facilityRows.length}{' '}
                    facilities
                </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                    icon={<BookOpenIcon className="size-5 text-white" />}
                    iconBg="bg-[#556830]"
                    label="Active Classes"
                    value={stats.activeClasses}
                    tooltip="Number of classes currently in Active status across all facilities"
                    subtitle="Across all facilities"
                />
                <MetricCard
                    icon={<UsersIcon className="size-5 text-white" />}
                    iconBg="bg-[#203622]"
                    label="Total Enrollment"
                    value={stats.totalEnrollment}
                    tooltip="Total students enrolled across all active classes in all facilities"
                    subtitle="Across active classes"
                />
                <MetricCard
                    icon={<ChartBarIcon className="size-5 text-white" />}
                    iconBg="bg-[#556830]"
                    label="Capacity Utilization"
                    value={`${stats.capacityUtilization}%`}
                    tooltip="Percentage of total capacity filled across all active classes"
                    subtitle="Of available seats filled"
                />
                <MetricCard
                    icon={
                        <ExclamationTriangleIcon className="size-5 text-white" />
                    }
                    iconBg="bg-amber-500"
                    label="Attendance Concerns"
                    value={stats.attendanceConcerns}
                    tooltip="Active classes scheduled today that may need attendance tracking"
                    subtitle="Classes needing attention"
                />
            </div>

            <FacilityHealthTable rows={facilityRows} />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                    <MissingAttendanceWidget
                        classes={classes}
                        expandable
                    />
                </div>
                <QuickActions navigate={navigate} />
            </div>
        </div>
    );
}

export default function Dashboard() {
    const { user } = useAuth();

    const { data: classesResp } = useSWR<ServerResponseMany<Class>>(
        '/api/program-classes'
    );
    const { data: programsResp } = useSWR<ServerResponseMany<ProgramOverview>>(
        '/api/programs'
    );

    const allClasses = classesResp?.data ?? [];
    const programs = programsResp?.data ?? [];

    const deptAdmin = user ? isDeptAdmin(user) : false;

    const facilityClasses = useMemo(() => {
        if (deptAdmin || !user) return allClasses;
        return allClasses.filter((c) => c.facility_id === user.facility.id);
    }, [allClasses, deptAdmin, user]);

    if (deptAdmin) {
        return (
            <div className="bg-[#E2E7EA] min-h-screen p-6">
                <div className="max-w-7xl mx-auto">
                    <DeptAdminView classes={allClasses} programs={programs} />
                </div>
            </div>
        );
    }

    return (
        <div className="bg-[#E2E7EA] min-h-screen p-6">
            <div className="max-w-7xl mx-auto">
                <FacilityAdminView
                    classes={facilityClasses}
                    facilityName={user?.facility.name ?? 'My Facility'}
                />
            </div>
        </div>
    );
}
