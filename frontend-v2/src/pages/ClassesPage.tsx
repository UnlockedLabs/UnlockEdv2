import { useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import useSWR from 'swr';
import { useAuth, isDeptAdmin } from '@/auth/useAuth';
import {
    Class,
    ServerResponseMany,
    SelectedClassStatus
} from '@/types';
import { getClassSchedule, isClassToday, getStatusColor, formatTime12h } from '@/lib/formatters';
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
import { Search, Plus, ClipboardList } from 'lucide-react';

const STATUS_OPTIONS: Array<{ label: string; value: string }> = [
    { label: 'All Statuses', value: 'all' },
    { label: 'Active', value: SelectedClassStatus.Active },
    { label: 'Scheduled', value: SelectedClassStatus.Scheduled },
    { label: 'Completed', value: SelectedClassStatus.Completed },
    { label: 'Paused', value: SelectedClassStatus.Paused },
    { label: 'Cancelled', value: SelectedClassStatus.Cancelled }
];

function formatDateRange(startDt: string, endDt: string): string {
    const fmt = (dt: string) => {
        const d = new Date(dt);
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };
    if (!startDt) return '';
    const start = fmt(startDt);
    const end = endDt ? fmt(endDt) : '';
    return end ? `${start} - ${end}` : start;
}

function abbreviateDay(day: string): string {
    return day.slice(0, 3);
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
    }, [facilityClasses, searchQuery, todayOnly, attendanceConcerns, programFilter, statusFilter]);

    return (
        <div className="bg-[#E2E7EA] min-h-screen p-6">
            <div className="max-w-7xl mx-auto space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-[#203622]">
                            Classes
                        </h1>
                        <p className="text-gray-500 mt-1">
                            Manage and monitor all program classes
                        </p>
                    </div>
                    <Button
                        className="bg-[#F1B51C] text-[#203622] hover:bg-[#F1B51C]/90 font-medium"
                        onClick={() => navigate('/programs')}
                    >
                        <Plus className="size-4" />
                        Create New Class
                    </Button>
                </div>

                <div className="bg-white rounded-lg border border-gray-200 p-4">
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="relative flex-1 min-w-[200px]">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
                            <Input
                                placeholder="Search by class, program, or instructor..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9"
                            />
                        </div>
                        <Button
                            variant={todayOnly ? 'default' : 'outline'}
                            size="sm"
                            className={cn(
                                todayOnly
                                    ? 'bg-[#556830] text-white hover:bg-[#556830]/90'
                                    : 'border-gray-200 text-gray-600'
                            )}
                            onClick={() => setTodayOnly(!todayOnly)}
                        >
                            Today Only
                        </Button>
                        <Button
                            variant={attendanceConcerns ? 'default' : 'outline'}
                            size="sm"
                            className={cn(
                                attendanceConcerns
                                    ? 'bg-amber-500 text-white hover:bg-amber-500/90'
                                    : 'border-gray-200 text-gray-600'
                            )}
                            onClick={() =>
                                setAttendanceConcerns(!attendanceConcerns)
                            }
                        >
                            Attendance Concerns
                        </Button>
                        <Select
                            value={programFilter}
                            onValueChange={setProgramFilter}
                        >
                            <SelectTrigger className="w-[180px]" size="sm">
                                <SelectValue placeholder="All Programs" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Programs</SelectItem>
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
                            <SelectTrigger className="w-[160px]" size="sm">
                                <SelectValue placeholder="All Statuses" />
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

                <p className="text-sm text-gray-500">
                    {filteredClasses.length}{' '}
                    {filteredClasses.length === 1 ? 'class' : 'classes'} found
                </p>

                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-gray-100 bg-gray-50/50">
                                    <th className="text-left py-3 px-4 text-gray-500 font-medium">
                                        Class Name
                                    </th>
                                    <th className="text-left py-3 px-4 text-gray-500 font-medium">
                                        Instructor
                                    </th>
                                    <th className="text-left py-3 px-4 text-gray-500 font-medium">
                                        Schedule
                                    </th>
                                    <th className="text-left py-3 px-4 text-gray-500 font-medium">
                                        Enrollment
                                    </th>
                                    <th className="text-left py-3 px-4 text-gray-500 font-medium">
                                        Status
                                    </th>
                                    <th className="text-right py-3 px-4 text-gray-500 font-medium">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredClasses.length === 0 ? (
                                    <tr>
                                        <td
                                            colSpan={6}
                                            className="py-12 text-center text-gray-500"
                                        >
                                            No classes match the current
                                            filters.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredClasses.map((cls) => {
                                        const schedule = getClassSchedule(cls);
                                        const today = isClassToday(cls);
                                        const enrollPct =
                                            cls.capacity > 0
                                                ? (cls.enrolled / cls.capacity) *
                                                  100
                                                : 0;

                                        return (
                                            <tr
                                                key={cls.id}
                                                onClick={() =>
                                                    navigate(
                                                        '/program-classes/' +
                                                            cls.id
                                                    )
                                                }
                                                className="hover:bg-[#E2E7EA]/50 cursor-pointer transition-colors border-b border-gray-50 last:border-0"
                                            >
                                                <td className="py-3 px-4">
                                                    <div className="flex items-center gap-2">
                                                        {today && (
                                                            <span className="size-2 rounded-full bg-[#F1B51C] shrink-0" />
                                                        )}
                                                        <div>
                                                            <p className="font-medium text-[#203622]">
                                                                {cls.name}
                                                            </p>
                                                            <div className="flex items-center gap-1 text-xs text-gray-500">
                                                                <Link
                                                                    to={`/programs/${cls.program_id}`}
                                                                    onClick={(e) =>
                                                                        e.stopPropagation()
                                                                    }
                                                                    className="hover:text-[#556830] hover:underline"
                                                                >
                                                                    {cls.program
                                                                        ?.name ??
                                                                        'Program'}
                                                                </Link>
                                                                {schedule.room && (
                                                                    <>
                                                                        <span>
                                                                            -
                                                                        </span>
                                                                        <span>
                                                                            {
                                                                                schedule.room
                                                                            }
                                                                        </span>
                                                                    </>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="py-3 px-4 text-gray-600">
                                                    {cls.instructor_name}
                                                </td>
                                                <td className="py-3 px-4">
                                                    <div className="space-y-0.5">
                                                        {schedule.startTime && (
                                                            <p className="text-[#203622] font-medium">
                                                                {formatTime12h(
                                                                    schedule.startTime
                                                                )}
                                                                {schedule.endTime &&
                                                                    ` - ${formatTime12h(schedule.endTime)}`}
                                                            </p>
                                                        )}
                                                        {schedule.days.length >
                                                            0 && (
                                                            <p className="text-xs text-gray-500">
                                                                {schedule.days
                                                                    .map(
                                                                        abbreviateDay
                                                                    )
                                                                    .join(
                                                                        ', '
                                                                    )}
                                                            </p>
                                                        )}
                                                        <p className="text-xs text-gray-400">
                                                            {formatDateRange(
                                                                cls.start_dt,
                                                                cls.end_dt
                                                            )}
                                                        </p>
                                                    </div>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <div className="w-24 space-y-1">
                                                        <p className="text-xs text-gray-600">
                                                            {cls.enrolled} /{' '}
                                                            {cls.capacity}
                                                        </p>
                                                        <Progress
                                                            value={enrollPct}
                                                            className="h-1.5"
                                                            indicatorClassName={cn(
                                                                enrollPct >= 90
                                                                    ? 'bg-amber-500'
                                                                    : 'bg-[#556830]'
                                                            )}
                                                        />
                                                    </div>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <Badge
                                                        variant="outline"
                                                        className={getStatusColor(
                                                            cls.status
                                                        )}
                                                    >
                                                        {cls.status}
                                                    </Badge>
                                                </td>
                                                <td className="py-3 px-4 text-right">
                                                    {cls.status ===
                                                        SelectedClassStatus.Active && (
                                                        <Button
                                                            size="sm"
                                                            className="bg-[#F1B51C] text-[#203622] hover:bg-[#F1B51C]/90"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                navigate(
                                                                    '/program-classes/' +
                                                                        cls.id
                                                                );
                                                            }}
                                                        >
                                                            <ClipboardList className="size-4" />
                                                            Attendance
                                                        </Button>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
