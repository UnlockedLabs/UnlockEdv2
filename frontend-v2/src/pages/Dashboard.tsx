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
    ExclamationTriangleIcon,
    InformationCircleIcon,
    ClockIcon,
    FolderIcon
} from '@heroicons/react/24/outline';
import {
    ClipboardList,
    ArrowRight,
    ChevronDown,
    ChevronUp,
    List
} from 'lucide-react';

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
        <div className="bg-background rounded-lg border border-border p-4 relative">
            <Tooltip>
                <TooltipTrigger asChild>
                    <button className="absolute top-3 right-3 text-muted-foreground/50 hover:text-muted-foreground">
                        <InformationCircleIcon className="size-4" />
                    </button>
                </TooltipTrigger>
                <TooltipContent>{tooltip}</TooltipContent>
            </Tooltip>
            <div className="flex items-start gap-3">
                <div className={cn('rounded-lg p-2 shrink-0', iconBg)}>
                    {icon}
                </div>
                <div className="min-w-0">
                    <p className="text-2xl font-semibold text-foreground leading-tight">
                        {value}
                    </p>
                    <p className="text-sm text-muted-foreground">{label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
                </div>
            </div>
        </div>
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

function TodaysSchedule({
    classes,
    onNavigate
}: {
    classes: Class[];
    onNavigate: (id: number) => void;
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
            .filter((c) => isClassToday(c) && c.status === SelectedClassStatus.Active)
            .sort((a, b) => {
                const schedA = getClassSchedule(a);
                const schedB = getClassSchedule(b);
                return schedA.startTime.localeCompare(schedB.startTime);
            });
    }, [classes]);

    return (
        <div className="bg-background rounded-lg border border-border p-6">
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h3 className="text-lg font-semibold text-foreground">
                        Today's Schedule
                    </h3>
                    <p className="text-sm text-muted-foreground">{dateLabel}</p>
                </div>
                <button
                    onClick={() => navigate('/schedule')}
                    className="text-sm text-[#556830] hover:underline flex items-center gap-1"
                >
                    View all classes
                    <ArrowRight className="size-3.5" />
                </button>
            </div>

            {todayClasses.length === 0 ? (
                <p className="text-muted-foreground text-sm py-8 text-center">
                    No classes scheduled for today.
                </p>
            ) : (
                <div className="space-y-2">
                    {todayClasses.map((cls) => {
                        const schedule = getClassSchedule(cls);
                        return (
                            <div
                                key={cls.id}
                                className="bg-[#e5e7e3] rounded-lg px-4 py-3 flex items-center gap-4"
                            >
                                <div className="flex items-center gap-2 text-sm text-foreground font-medium min-w-[140px] shrink-0">
                                    <ClockIcon className="size-4 text-muted-foreground" />
                                    {formatTime12h(schedule.startTime)}
                                    {schedule.endTime &&
                                        ` - ${formatTime12h(schedule.endTime)}`}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-foreground truncate">
                                        {cls.name}
                                    </p>
                                    <p className="text-xs text-muted-foreground truncate">
                                        {cls.instructor_name}
                                    </p>
                                </div>
                                <p className="text-sm text-muted-foreground shrink-0 hidden sm:block">
                                    {schedule.room || '-'}
                                </p>
                                <Button
                                    size="sm"
                                    className="bg-[#556830] text-white hover:bg-[#556830]/90 shrink-0"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onNavigate(cls.id);
                                    }}
                                >
                                    <ClipboardList className="size-4" />
                                    Take Attendance
                                </Button>
                            </div>
                        );
                    })}
                </div>
            )}
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
    const navigate = useNavigate();

    const missingAttendance = useMemo(() => {
        const now = new Date();
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
        <div className="bg-background rounded-lg border border-border p-6">
            <div className="flex items-center gap-2 mb-1">
                <ExclamationTriangleIcon className="size-5 text-[#F1B51C]" />
                <h3 className="text-lg font-semibold text-foreground">
                    Missing Attendance
                </h3>
            </div>
            <p className="text-sm text-muted-foreground mb-4">Past 3 days</p>

            {missingAttendance.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-4">
                    All attendance records are up to date.
                </p>
            ) : (
                <>
                    <div className="space-y-2">
                        {displayList.map((cls) => {
                            const schedule = getClassSchedule(cls);
                            return (
                                <div
                                    key={cls.id}
                                    className="border border-[#F1B51C] rounded-lg px-4 py-3 flex items-center justify-between gap-3"
                                >
                                    <div className="min-w-0">
                                        <p className="text-sm font-medium text-foreground truncate">
                                            {cls.name}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            {schedule.days.join(', ')}
                                            {schedule.startTime &&
                                                ` ${formatTime12h(schedule.startTime)}`}
                                            {cls.facility_name &&
                                                ` - ${cls.facility_name}`}
                                        </p>
                                    </div>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="border-[#F1B51C] text-[#F1B51C] hover:bg-[#F1B51C]/10 shrink-0"
                                        onClick={() =>
                                            navigate('/program-classes/' + cls.id)
                                        }
                                    >
                                        Take Attendance
                                    </Button>
                                </div>
                            );
                        })}
                    </div>
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
        <div className="bg-background rounded-lg border border-border p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">
                Quick Actions
            </h3>
            <div className="space-y-3">
                <Button
                    variant="outline"
                    className="w-full justify-start gap-3 border-border text-foreground hover:bg-muted/50"
                    onClick={() => navigate('/programs')}
                >
                    <FolderIcon className="size-4 text-muted-foreground" />
                    View All Programs
                </Button>
                <Button
                    variant="outline"
                    className="w-full justify-start gap-3 border-border text-foreground hover:bg-muted/50"
                    onClick={() => navigate('/classes')}
                >
                    <List className="size-4 text-muted-foreground" />
                    Browse Classes
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
            <div className="bg-background rounded-lg border border-border p-6">
                <h3 className="text-lg font-semibold text-foreground mb-4">
                    Facility Health Overview
                </h3>
                <p className="text-muted-foreground text-sm text-center py-4">
                    No facility data available.
                </p>
            </div>
        );
    }

    return (
        <div className="bg-background rounded-lg border border-border p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">
                Facility Health Overview
            </h3>
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-border">
                            <th className="text-left py-2 pr-4 text-muted-foreground font-medium">
                                Facility
                            </th>
                            <th className="text-left py-2 pr-4 text-muted-foreground font-medium">
                                Programs
                            </th>
                            <th className="text-left py-2 pr-4 text-muted-foreground font-medium">
                                Active Classes
                            </th>
                            <th className="text-left py-2 pr-4 text-muted-foreground font-medium">
                                Enrollment
                            </th>
                            <th className="text-left py-2 pr-4 text-muted-foreground font-medium">
                                Missing Attendance
                            </th>
                            <th className="text-left py-2 text-muted-foreground font-medium">
                                Attendance Concerns
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row) => (
                            <tr
                                key={row.facilityName}
                                className="border-b border-border last:border-0"
                            >
                                <td className="py-3 pr-4 font-medium text-foreground">
                                    {row.facilityName}
                                </td>
                                <td className="py-3 pr-4 text-muted-foreground">
                                    {row.programs}
                                </td>
                                <td className="py-3 pr-4 text-muted-foreground">
                                    {row.activeClasses}
                                </td>
                                <td className="py-3 pr-4 text-muted-foreground">
                                    {row.enrollment}
                                </td>
                                <td className="py-3 pr-4">
                                    {row.missingAttendance > 0 ? (
                                        <span className="text-amber-600 font-medium">
                                            {row.missingAttendance}
                                        </span>
                                    ) : (
                                        <span className="text-muted-foreground">0</span>
                                    )}
                                </td>
                                <td className="py-3">
                                    {row.attendanceConcerns > 0 ? (
                                        <span className="text-red-600 font-medium">
                                            {row.attendanceConcerns}
                                        </span>
                                    ) : (
                                        <span className="text-muted-foreground">0</span>
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

function MetricCards({ stats, subtitle }: { stats: DashboardStats; subtitle: string }) {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
                icon={<BookOpenIcon className="size-5 text-[#556830]" />}
                iconBg="bg-[#e5e7e3]"
                label="Active Classes"
                value={stats.activeClasses}
                tooltip="Number of classes currently in Active status"
                subtitle={subtitle}
            />
            <MetricCard
                icon={<UsersIcon className="size-5 text-[#556830]" />}
                iconBg="bg-[#e5e7e3]"
                label="Total Enrollment"
                value={stats.totalEnrollment}
                tooltip="Total students enrolled across all active classes"
                subtitle="Across active classes"
            />
            <MetricCard
                icon={<ChartBarIcon className="size-5 text-[#556830]" />}
                iconBg="bg-[#e5e7e3]"
                label="Capacity Utilization"
                value={`${stats.capacityUtilization}%`}
                tooltip="Percentage of total capacity filled across active classes"
                subtitle="Of available seats filled"
            />
            <MetricCard
                icon={<ExclamationTriangleIcon className="size-5 text-[#F1B51C]" />}
                iconBg="bg-amber-50"
                label="Attendance Concerns"
                value={stats.attendanceConcerns}
                tooltip="Active classes scheduled today that may need attendance tracking"
                subtitle="Classes needing attention"
            />
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
        <div className="space-y-5">
            <div>
                <h1 className="text-2xl font-bold text-foreground">
                    Facility Dashboard
                </h1>
                <p className="text-muted-foreground mt-1">{facilityName}</p>
            </div>

            <MetricCards stats={stats} subtitle="Currently running" />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                <div className="lg:col-span-2">
                    <TodaysSchedule
                        classes={classes}
                        onNavigate={(id) =>
                            navigate('/program-classes/' + id + '/attendance')
                        }
                    />
                </div>
                <div className="space-y-5">
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
        <div className="space-y-5">
            <div>
                <h1 className="text-2xl font-bold text-foreground">
                    Department Overview
                </h1>
                <p className="text-muted-foreground mt-1">
                    {programs.length} programs across {facilityRows.length}{' '}
                    facilities
                </p>
            </div>

            <MetricCards stats={stats} subtitle="Across all facilities" />

            <FacilityHealthTable rows={facilityRows} />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
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

    return (
        <div className="-mx-6 -mt-4 -mb-4 min-h-[calc(100vh-4rem)] bg-[#e5e7e3]">
            <div className="px-16 pt-6 pb-6 space-y-5">
                {deptAdmin ? (
                    <DeptAdminView classes={allClasses} programs={programs} />
                ) : (
                    <FacilityAdminView
                        classes={facilityClasses}
                        facilityName={user?.facility.name ?? 'My Facility'}
                    />
                )}
            </div>
        </div>
    );
}
