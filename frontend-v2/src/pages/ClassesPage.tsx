import { useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import useSWR from 'swr';
import { useAuth, isDeptAdmin } from '@/auth/useAuth';
import {
    Class,
    ServerResponseMany,
    SelectedClassStatus
} from '@/types';
import {
    getClassSchedule,
    isClassToday,
    getStatusColor,
    formatTime12h
} from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';
import {
    Search,
    Plus,
    Calendar,
    Clock,
    Filter,
    MapPin
} from 'lucide-react';

const STATUS_OPTIONS: Array<{ label: string; value: string }> = [
    { label: 'All Status', value: 'all' },
    { label: 'Active', value: SelectedClassStatus.Active },
    { label: 'Scheduled', value: SelectedClassStatus.Scheduled },
    { label: 'Completed', value: SelectedClassStatus.Completed },
    { label: 'Paused', value: SelectedClassStatus.Paused },
    { label: 'Cancelled', value: SelectedClassStatus.Cancelled }
];

function formatDateRangeFull(startDt: string, endDt: string): string {
    const fmt = (dt: string) => {
        const d = new Date(dt);
        return d.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    };
    if (!startDt) return '';
    const start = fmt(startDt);
    const end = endDt ? fmt(endDt) : '';
    return end ? `${start} - ${end}` : start;
}

export default function ClassesPage() {
    const navigate = useNavigate();
    const { user } = useAuth();

    const [searchQuery, setSearchQuery] = useState('');
    const [todayOnly, setTodayOnly] = useState(false);
    const [attendanceConcerns, setAttendanceConcerns] = useState(false);
    const [programFilter, setProgramFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');

    const { data: classesResp } = useSWR<ServerResponseMany<Class>>(
        '/api/program-classes'
    );
    const allClasses = classesResp?.data ?? [];

    const deptAdmin = user ? isDeptAdmin(user) : false;

    const facilityClasses = useMemo(() => {
        if (deptAdmin || !user) return allClasses;
        return allClasses.filter((c) => c.facility_id === user.facility.id);
    }, [allClasses, deptAdmin, user]);

    const programOptions = useMemo(() => {
        const map = new Map<number, string>();
        for (const cls of facilityClasses) {
            if (cls.program?.name) {
                map.set(cls.program_id, cls.program.name);
            }
        }
        return Array.from(map.entries()).sort((a, b) =>
            a[1].localeCompare(b[1])
        );
    }, [facilityClasses]);

    const filteredClasses = useMemo(() => {
        let result = facilityClasses;

        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            result = result.filter(
                (cls) =>
                    cls.name.toLowerCase().includes(q) ||
                    cls.program?.name?.toLowerCase().includes(q) ||
                    cls.instructor_name.toLowerCase().includes(q)
            );
        }

        if (todayOnly) {
            result = result.filter((cls) => isClassToday(cls));
        }

        if (attendanceConcerns) {
            result = result.filter(
                (cls) =>
                    cls.status === SelectedClassStatus.Active &&
                    cls.enrolled > 0 &&
                    isClassToday(cls)
            );
        }

        if (programFilter !== 'all') {
            const pid = Number(programFilter);
            result = result.filter((cls) => cls.program_id === pid);
        }

        if (statusFilter !== 'all') {
            result = result.filter((cls) => cls.status === statusFilter);
        }

        return result;
    }, [
        facilityClasses,
        searchQuery,
        todayOnly,
        attendanceConcerns,
        programFilter,
        statusFilter
    ]);

    return (
        <div className="-mx-6 -my-4">
            <div className="px-6 pt-4 pb-6 bg-background">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-foreground">
                            Classes
                        </h1>
                        <p className="text-muted-foreground mt-1">
                            Manage and monitor all classes at your facility
                        </p>
                    </div>
                    <Button
                        className="bg-[#F1B51C] text-foreground hover:bg-[#F1B51C]/90 font-medium"
                        onClick={() => navigate('/programs')}
                    >
                        <Plus className="size-4" />
                        Create New Class
                    </Button>
                </div>
            </div>

            <div className="px-16 py-6 bg-muted/40 min-h-[60vh] space-y-4">
                <div className="bg-background rounded-xl border border-border p-4">
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="relative flex-1 min-w-[200px]">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                            <Input
                                placeholder="Search classes, programs, or instructors..."
                                value={searchQuery}
                                onChange={(e) =>
                                    setSearchQuery(e.target.value)
                                }
                                className="pl-9"
                            />
                        </div>
                        <Button
                            variant={todayOnly ? 'default' : 'outline'}
                            className={cn(
                                'gap-2',
                                todayOnly
                                    ? 'bg-[#556830] text-white hover:bg-[#556830]/90'
                                    : 'bg-background border-border text-foreground'
                            )}
                            onClick={() => setTodayOnly(!todayOnly)}
                        >
                            <Calendar className="size-4" />
                            Today Only
                        </Button>
                        <Button
                            variant={attendanceConcerns ? 'default' : 'outline'}
                            className={cn(
                                'gap-2',
                                attendanceConcerns
                                    ? 'bg-amber-500 text-white hover:bg-amber-500/90'
                                    : 'bg-background border-border text-foreground'
                            )}
                            onClick={() =>
                                setAttendanceConcerns(!attendanceConcerns)
                            }
                        >
                            <Clock className="size-4" />
                            Attendance Concerns
                        </Button>
                        <Select
                            value={programFilter}
                            onValueChange={setProgramFilter}
                        >
                            <SelectTrigger className="w-[180px] bg-background">
                                <div className="flex items-center gap-2">
                                    <Filter className="size-3.5 text-muted-foreground" />
                                    <SelectValue placeholder="All Programs" />
                                </div>
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">
                                    All Programs
                                </SelectItem>
                                {programOptions.map(([id, name]) => (
                                    <SelectItem
                                        key={id}
                                        value={String(id)}
                                    >
                                        {name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select
                            value={statusFilter}
                            onValueChange={setStatusFilter}
                        >
                            <SelectTrigger className="w-[160px] bg-background">
                                <SelectValue placeholder="All Status" />
                            </SelectTrigger>
                            <SelectContent>
                                {STATUS_OPTIONS.map((opt) => (
                                    <SelectItem
                                        key={opt.value}
                                        value={opt.value}
                                    >
                                        {opt.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <p className="text-sm text-muted-foreground">
                    Showing {filteredClasses.length}{' '}
                    {filteredClasses.length === 1 ? 'class' : 'classes'}
                </p>

                <div className="bg-background rounded-xl border border-border overflow-hidden">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-border">
                                <th className="text-left py-3 px-5 text-foreground font-semibold">
                                    Class Name
                                </th>
                                <th className="text-left py-3 px-5 text-foreground font-semibold">
                                    Instructor
                                </th>
                                <th className="text-left py-3 px-5 text-foreground font-semibold">
                                    Schedule
                                </th>
                                <th className="text-left py-3 px-5 text-foreground font-semibold">
                                    Enrollment
                                </th>
                                <th className="text-left py-3 px-5 text-foreground font-semibold">
                                    Status
                                </th>
                                <th className="text-left py-3 px-5 text-foreground font-semibold">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredClasses.length === 0 ? (
                                <tr>
                                    <td
                                        colSpan={6}
                                        className="py-12 text-center text-muted-foreground"
                                    >
                                        No classes match the current filters.
                                    </td>
                                </tr>
                            ) : (
                                filteredClasses.map((cls) => (
                                    <ClassRow
                                        key={cls.id}
                                        cls={cls}
                                        onClick={() =>
                                            navigate(
                                                `/program-classes/${cls.id}`
                                            )
                                        }
                                        onAttendance={() =>
                                            navigate(
                                                `/program-classes/${cls.id}/attendance`
                                            )
                                        }
                                    />
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

function ClassRow({
    cls,
    onClick,
    onAttendance
}: {
    cls: Class;
    onClick: () => void;
    onAttendance: () => void;
}) {
    const schedule = getClassSchedule(cls);
    const today = isClassToday(cls);
    const enrollPct =
        cls.capacity > 0 ? (cls.enrolled / cls.capacity) * 100 : 0;

    return (
        <tr
            onClick={onClick}
            className="hover:bg-muted/30 cursor-pointer transition-colors border-b border-border last:border-0"
        >
            <td className="py-4 px-5">
                <div className="flex items-start gap-2">
                    {today && (
                        <span className="size-2.5 rounded-full bg-[#F1B51C] shrink-0 mt-1.5" />
                    )}
                    <div className="space-y-1">
                        <p className="font-semibold text-foreground">
                            {cls.name}
                        </p>
                        <Link
                            to={`/programs/${cls.program_id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="text-xs text-[#556830] hover:underline"
                        >
                            {cls.program?.name ?? 'Program'}
                        </Link>
                        {schedule.room && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <MapPin className="size-3" />
                                {schedule.room}
                            </div>
                        )}
                    </div>
                </div>
            </td>
            <td className="py-4 px-5 text-muted-foreground align-top pt-5">
                {cls.instructor_name}
            </td>
            <td className="py-4 px-5 align-top pt-5">
                <div className="space-y-0.5">
                    {schedule.startTime && (
                        <div className="flex items-center gap-1.5 text-foreground">
                            <Clock className="size-3.5 text-muted-foreground" />
                            <span>
                                {formatTime12h(schedule.startTime)}
                                {schedule.endTime &&
                                    ` - ${formatTime12h(schedule.endTime)}`}
                            </span>
                        </div>
                    )}
                    {schedule.days.length > 0 && (
                        <p className="text-xs text-muted-foreground">
                            {schedule.days.join(', ')}
                        </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                        {formatDateRangeFull(cls.start_dt, cls.end_dt)}
                    </p>
                </div>
            </td>
            <td className="py-4 px-5 align-top pt-5">
                <div className="w-24 space-y-1.5">
                    <p className="text-sm font-medium text-foreground">
                        {cls.enrolled}{' '}
                        <span className="text-muted-foreground font-normal">
                            / {cls.capacity}
                        </span>
                    </p>
                    <Progress
                        value={enrollPct}
                        className="h-1.5 bg-gray-200"
                        indicatorClassName={cn(
                            enrollPct >= 90
                                ? 'bg-amber-500'
                                : 'bg-[#556830]'
                        )}
                    />
                </div>
            </td>
            <td className="py-4 px-5 align-top pt-5">
                <Badge
                    variant="outline"
                    className={getStatusColor(cls.status)}
                >
                    {cls.status}
                </Badge>
            </td>
            <td className="py-4 px-5 align-top pt-5">
                {cls.status === SelectedClassStatus.Active ? (
                    <Button
                        variant="outline"
                        size="sm"
                        className="border-[#556830] text-[#556830] hover:bg-[#556830]/5"
                        onClick={(e) => {
                            e.stopPropagation();
                            onAttendance();
                        }}
                    >
                        Take Attendance
                    </Button>
                ) : cls.status !== SelectedClassStatus.Completed &&
                  cls.status !== SelectedClassStatus.Cancelled ? (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                            e.stopPropagation();
                            onClick();
                        }}
                    >
                        View Details
                    </Button>
                ) : null}
            </td>
        </tr>
    );
}
