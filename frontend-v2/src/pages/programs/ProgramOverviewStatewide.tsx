import { Fragment, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import useSWR from 'swr';
import { toast } from 'sonner';
import {
    AlertCircle,
    ArrowRight,
    ChevronDown,
    ChevronUp,
    MoreVertical,
    Trash2
} from 'lucide-react';
import API from '@/api/api';
import {
    Class,
    ProgramOverview,
    SelectedClassStatus,
    ServerResponseMany,
    ServerResponseOne
} from '@/types';
import { programTypeColors } from '@/pages/program-detail/constants';
import Breadcrumbs from '@/components/navigation/Breadcrumbs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    ArchiveConfirmDialog,
    CannotArchiveDialog,
    ReactivateDialog
} from '@/components/programs/ProgramDialogs';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger
} from '@/components/ui/tooltip';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@/components/ui/table';

const classStatusColors: Record<string, string> = {
    Active: 'bg-green-100 text-green-700 border-green-200',
    Scheduled: 'bg-blue-100 text-blue-700 border-blue-200',
    Cancelled: 'bg-red-100 text-red-700 border-red-200',
    Completed: 'bg-gray-100 text-gray-700 border-gray-200',
    Paused: 'bg-yellow-100 text-yellow-700 border-yellow-200'
};

const formatDateRange = (
    startDate?: string | null,
    endDate?: string | null
) => {
    if (!startDate) {
        return '—';
    }
    const formatUTCDate = (dateStr: string) => {
        const d = new Date(dateStr);
        if (Number.isNaN(d.getTime())) return '—';
        return d.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            timeZone: 'UTC'
        });
    };
    const startFormatted = formatUTCDate(startDate);
    if (!endDate) {
        return `${startFormatted} - Ongoing`;
    }

    const endFormatted = formatUTCDate(endDate);

    return `${startFormatted} - ${endFormatted}`;
};

const formatEnum = (value: string): string => value.replace(/_/g, ' ');

const weekdayAbbreviations: Record<string, string> = {
    Monday: 'Mon',
    Tuesday: 'Tue',
    Wednesday: 'Wed',
    Thursday: 'Thu',
    Friday: 'Fri',
    Saturday: 'Sat',
    Sunday: 'Sun'
};

const abbreviateScheduleDays = (schedule?: string): string => {
    if (!schedule) return '';
    const [daysPart] = schedule.split(' • ');
    const abbreviatedDays = daysPart
        .split(',')
        .map((day) => {
            const trimmed = day.trim();
            return weekdayAbbreviations[trimmed] ?? trimmed;
        })
        .join(', ');
    return abbreviatedDays;
};

interface FacilityStat {
    facilityId: number;
    facilityName: string;
    classes: Class[];
    totalClasses: number;
    activeClasses: number;
    totalEnrolled: number;
    currentEnrollments: number;
    historicalEnrollments: number;
    totalCapacity: number;
    utilization: number;
    completionRate: number;
    attendanceRate: number;
}

export default function ProgramOverviewStatewide() {
    const navigate = useNavigate();
    const { program_id } = useParams<{ program_id: string }>();
    const [expandedFacilities, setExpandedFacilities] = useState<
        Record<number, boolean>
    >({});
    const [sortColumn, setSortColumn] = useState<
        'facility' | 'classes' | 'enrolled' | 'completion'
    >('facility');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
    const [showArchiveDialog, setShowArchiveDialog] = useState(false);
    const [showCannotArchiveDialog, setShowCannotArchiveDialog] = useState(false);
    const [showReactivateDialog, setShowReactivateDialog] = useState(false);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [deleteConfirmText, setDeleteConfirmText] = useState('');
    const [archiveCheckLoading, setArchiveCheckLoading] = useState(false);
    const [archiveBlockingFacilities, setArchiveBlockingFacilities] = useState<string[]>([]);

    const { data: programResp, mutate: mutateProgram } = useSWR<
        ServerResponseOne<ProgramOverview>
    >(`/api/programs/${program_id}`);
    const program = programResp?.data;

    const { data: classesResp } = useSWR<ServerResponseMany<Class>>(
        `/api/programs/${program_id}/classes?all=true&order_by=ps.start_dt asc`
    );
    const classes = useMemo(() => classesResp?.data ?? [], [classesResp?.data]);

    async function handleArchiveCheck() {
        if (!program || archiveCheckLoading) return;
        setArchiveCheckLoading(true);
        const resp = await API.get<{ facilities: string[] }>(
            `programs/${program.id}/archive-check`
        );
        setArchiveCheckLoading(false);

        if (!resp.success) {
            toast.error(resp.message || 'Unable to check active class status.');
            return;
        }

        const blocking = (resp.data as { facilities: string[] }).facilities ?? [];
        if (blocking.length > 0) {
            setArchiveBlockingFacilities(blocking);
            setShowCannotArchiveDialog(true);
            return;
        }

        setShowArchiveDialog(true);
    }

    async function handleProgramStatusChange(newStatus: string) {
        if (!program) return;
        const body: Record<string, unknown> = {};
        if (newStatus === 'Archived') {
            body.archived_at = new Date().toISOString();
            body.is_active = false;
        } else {
            body.is_active = newStatus === 'Available';
            if (program.archived_at) {
                body.archived_at = null;
            }
        }

        const resp = await API.patch<
            { updated: boolean; message: string },
            Record<string, unknown>
        >(`programs/${program.id}/status`, body);
        const statusUpdated =
            !Array.isArray(resp.data) && resp.data?.updated !== false;
        if (resp.success && statusUpdated) {
            const successMessage =
                newStatus === 'Archived'
                    ? `${program.name} has been archived`
                    : 'Program status updated';
            toast.success(successMessage);
            void mutateProgram();
        } else {
            toast.error(resp.message || 'Failed to update program status');
        }
    }

    async function handleReactivate(isActive: boolean) {
        if (!program) return;
        const resp = await API.patch<
            { updated: boolean; message: string },
            Record<string, unknown>
        >(`programs/${program.id}/status`, {
            archived_at: null,
            is_active: isActive
        });
        const statusUpdated =
            !Array.isArray(resp.data) && resp.data?.updated !== false;
        if (resp.success && statusUpdated) {
            toast.success(`${program.name} has been reactivated`);
            void mutateProgram();
        } else {
            toast.error(resp.message || 'Failed to reactivate program');
        }
    }

    async function handleDeleteProgram() {
        if (!program) return;
        const resp = await API.delete(`programs/${program.id}`);
        if (resp.success) {
            toast.success(`Program "${program.name}" has been deleted`);
            navigate('/programs');
        } else {
            toast.error(resp.message || 'Failed to delete program');
        }
    }

    const facilityList = useMemo(() => {
        if (program?.facilities?.length) {
            return program.facilities;
        }
        const byId = new Map<number, { id: number; name: string }>();
        classes.forEach((cls) => {
            if (!byId.has(cls.facility_id)) {
                byId.set(cls.facility_id, {
                    id: cls.facility_id,
                    name: cls.facility_name
                });
            }
        });
        return Array.from(byId.values());
    }, [program?.facilities, classes]);

    const facilityStats = useMemo<FacilityStat[]>(
        () =>
            facilityList.map((facility) => {
                const facilityClasses = classes.filter(
                    (cls) => cls.facility_id === facility.id
                );
                const completedClasses = facilityClasses.filter(
                    (cls) => cls.status === SelectedClassStatus.Completed
                );
                const activeClasses = facilityClasses.filter(
                    (cls) => cls.status === SelectedClassStatus.Active
                ).length;
                const totalEnrolled = facilityClasses.reduce(
                    (sum, cls) => sum + (cls.enrolled ?? 0),
                    0
                );
                const totalCapacity = facilityClasses.reduce(
                    (sum, cls) => sum + (cls.capacity ?? 0),
                    0
                );
                const utilization =
                    totalCapacity > 0
                        ? (totalEnrolled / totalCapacity) * 100
                        : 0;
                const completions = completedClasses.reduce(
                    (sum, cls) => sum + (cls.completed ?? 0),
                    0
                );
                const historicalEnrollments = completedClasses.reduce(
                    (sum, cls) =>
                        sum +
                        (cls.historical_enrollments ?? cls.completed ?? 0),
                    0
                );
                const completionRate =
                    historicalEnrollments > 0
                        ? (completions / historicalEnrollments) * 100
                        : 0;
                const attendanceSamples = facilityClasses
                    .map((cls) =>
                        typeof cls.attendance_rate === 'number'
                            ? cls.attendance_rate
                            : null
                    )
                    .filter((rate): rate is number => rate !== null);
                const attendanceRate =
                    attendanceSamples.length > 0
                        ? attendanceSamples.reduce(
                              (sum, rate) => sum + rate,
                              0
                          ) / attendanceSamples.length
                        : 0;

                return {
                    facilityId: facility.id,
                    facilityName: facility.name,
                    classes: facilityClasses,
                    totalClasses: facilityClasses.length,
                    activeClasses,
                    totalEnrolled,
                    currentEnrollments: totalEnrolled,
                    historicalEnrollments,
                    totalCapacity,
                    utilization,
                    completionRate,
                    attendanceRate
                };
            }),
        [facilityList, classes]
    );

    const sortedFacilityStats = useMemo(() => {
        return [...facilityStats].sort((a, b) => {
            let aVal: number | string;
            let bVal: number | string;

            switch (sortColumn) {
                case 'facility':
                    aVal = a.facilityName;
                    bVal = b.facilityName;
                    break;
                case 'classes':
                    aVal = a.totalClasses;
                    bVal = b.totalClasses;
                    break;
                case 'enrolled':
                    aVal = a.totalEnrolled;
                    bVal = b.totalEnrolled;
                    break;
                case 'completion':
                    aVal = a.completionRate;
                    bVal = b.completionRate;
                    break;
                default:
                    return 0;
            }

            if (typeof aVal === 'string' && typeof bVal === 'string') {
                return sortDirection === 'asc'
                    ? aVal.localeCompare(bVal)
                    : bVal.localeCompare(aVal);
            }

            return sortDirection === 'asc'
                ? (aVal as number) - (bVal as number)
                : (bVal as number) - (aVal as number);
        });
    }, [facilityStats, sortColumn, sortDirection]);

    const totalClasses = classes.length;
    const totalEnrolled = classes.reduce((sum, cls) => sum + cls.enrolled, 0);
    const totalCapacity = classes.reduce((sum, cls) => sum + cls.capacity, 0);
    const avgAttendanceRate = Math.round(
        (() => {
            const attendanceSamples = classes
                .map((cls) =>
                    typeof cls.attendance_rate === 'number'
                        ? cls.attendance_rate
                        : null
                )
                .filter((rate): rate is number => rate !== null);
            if (attendanceSamples.length === 0) return 0;
            const total = attendanceSamples.reduce(
                (sum, rate) => sum + rate,
                0
            );
            return total / attendanceSamples.length;
        })()
    );
    const computedCompletionRate = useMemo(() => {
        const completedClasses = classes.filter(
            (cls) => cls.status === SelectedClassStatus.Completed
        );
        const totalCompletions = completedClasses.reduce(
            (sum, cls) => sum + (cls.completed ?? 0),
            0
        );
        const totalHistoricalEnrollments = completedClasses.reduce(
            (sum, cls) =>
                sum + (cls.historical_enrollments ?? cls.completed ?? 0),
            0
        );
        return totalHistoricalEnrollments > 0
            ? (totalCompletions / totalHistoricalEnrollments) * 100
            : 0;
    }, [classes]);
    const avgCompletionRate = Math.round(
        program?.completion_rate && program.completion_rate > 0
            ? program.completion_rate
            : computedCompletionRate
    );
    const deleteDisabled = classes.length > 0;

    const toggleSort = (column: typeof sortColumn) => {
        if (sortColumn === column) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortColumn(column);
            setSortDirection('asc');
        }
    };

    const toggleFacilityExpanded = (facilityId: number) => {
        setExpandedFacilities((prev) => ({
            ...prev,
            [facilityId]: !prev[facilityId]
        }));
    };

    const handleViewAtFacility = async (facilityId: number) => {
        if (!program) return;
        const resp = await API.put<null, object>(
            `admin/facility-context/${facilityId}`,
            {}
        );
        if (resp.success) {
            navigate(`/programs/${program.id}?facility_id=${facilityId}`);
        } else {
            toast.error(resp.message || 'Failed to switch facility context');
        }
    };

    if (!program) {
        return (
            <div className="flex items-center justify-center h-64">
                <p className="text-muted-foreground">Loading program...</p>
            </div>
        );
    }

    const programStatus = program.archived_at
        ? 'Archived'
        : program.is_active
          ? 'Available'
          : 'Inactive';
    const breadcrumbs = [
        { label: 'Dashboard', href: '/dashboard' },
        { label: 'Programs', href: '/programs' },
        { label: program.name }
    ];

    return (
        <div className="min-h-full">
            <div className="max-w-7xl mx-auto px-6 pt-4 pb-8">
                <Breadcrumbs items={breadcrumbs} className="mb-4" />

                <div className="flex items-start justify-between mb-8 mt-6">
                    <div className="flex items-start gap-4">
                        <div>
                            <h1 className="text-[#203622] mb-2">
                                {program.name}
                            </h1>
                            <p className="text-gray-600 max-w-3xl">
                                {program.description}
                            </p>
                            <div className="flex flex-wrap gap-2 mt-3">
                                {program.program_types.map((pt) => (
                                    <Badge
                                        key={pt.program_type}
                                        variant="outline"
                                        className={
                                            programTypeColors[
                                                pt.program_type
                                            ] ??
                                            'bg-gray-100 text-gray-700 border-gray-200'
                                        }
                                    >
                                        {formatEnum(pt.program_type)}
                                    </Badge>
                                ))}
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        {programStatus === 'Available' && (
                            <Button
                                variant="outline"
                                onClick={() => {
                                    void handleProgramStatusChange('Inactive');
                                }}
                                className="gap-2 focus-visible:border-[#b3b3b3] focus-visible:ring-[3px] focus-visible:ring-[#b3b3b3]/50 focus-visible:ring-offset-0"
                            >
                                Mark as Inactive
                            </Button>
                        )}
                        {programStatus === 'Inactive' && (
                            <Button
                                variant="outline"
                                onClick={() => {
                                    void handleProgramStatusChange('Available');
                                }}
                                className="gap-2 bg-[#556830] hover:bg-[#203622] text-white border-[#556830] focus-visible:border-[#b3b3b3] focus-visible:ring-[3px] focus-visible:ring-[#b3b3b3]/50 focus-visible:ring-offset-0"
                            >
                                Mark as Available
                            </Button>
                        )}
                        {programStatus === 'Archived' && (
                            <Badge
                                variant="outline"
                                className="bg-gray-200 text-gray-700 border-gray-400 px-4 py-2"
                            >
                                Archived
                            </Badge>
                        )}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-9 w-9 p-0 hover:bg-gray-100 focus-visible:border-[#b3b3b3] focus-visible:ring-[3px] focus-visible:ring-[#b3b3b3]/50 focus-visible:ring-offset-0"
                                >
                                    <MoreVertical className="size-5" />
                                    <span className="sr-only">Open menu</span>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                                align="end"
                                className="w-48 p-1"
                            >
                                {programStatus === 'Archived' ? (
                                    <>
                                        <DropdownMenuItem
                                            onClick={() => setShowReactivateDialog(true)}
                                        >
                                            Reactivate Program
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                    </>
                                ) : (
                                    <>
                                        <DropdownMenuItem
                                            onClick={() => void handleArchiveCheck()}
                                            disabled={archiveCheckLoading}
                                            className="text-orange-600"
                                        >
                                            Archive Program
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                    </>
                                )}
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <div>
                                            <DropdownMenuItem
                                                onClick={() => {
                                                    setDeleteConfirmText('');
                                                    setShowDeleteDialog(true);
                                                }}
                                                disabled={deleteDisabled}
                                                className="text-red-600 hover:bg-red-50 transition-colors flex items-center gap-2"
                                            >
                                                <Trash2 className="size-4" />
                                                Delete Program
                                            </DropdownMenuItem>
                                        </div>
                                    </TooltipTrigger>
                                    {deleteDisabled && (
                                        <TooltipContent side="left">
                                            Cannot delete program with existing
                                            classes
                                        </TooltipContent>
                                    )}
                                </Tooltip>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>

                <div className="grid grid-cols-4 gap-6 mb-8">
                    <div className="bg-white rounded-lg border border-gray-200 p-6">
                        <div className="text-sm text-gray-600 mb-2">
                            Total Enrollment
                        </div>
                        <div className="text-3xl text-[#203622] mb-1">
                            {totalEnrolled}
                        </div>
                        <div className="text-xs text-gray-500">
                            of {totalCapacity} capacity
                        </div>
                    </div>
                    <div className="bg-white rounded-lg border border-gray-200 p-6">
                        <div className="text-sm text-gray-600 mb-2">
                            Total Classes
                        </div>
                        <div className="text-3xl text-[#203622] mb-1">
                            {totalClasses}
                        </div>
                        <div className="text-xs text-gray-500">
                            across {facilityList.length} facilities
                        </div>
                    </div>
                    <div className="bg-white rounded-lg border border-gray-200 p-6">
                        <div className="text-sm text-gray-600 mb-2">
                            Avg Completion Rate
                        </div>
                        <div className="text-3xl text-[#203622] mb-1">
                            {avgCompletionRate}%
                        </div>
                        <div className="text-xs text-gray-500">
                            of historical residents
                        </div>
                    </div>
                    <div className="bg-white rounded-lg border border-gray-200 p-6">
                        <div className="text-sm text-gray-600 mb-2">
                            Avg Attendance Rate
                        </div>
                        <div className="text-3xl text-[#203622] mb-1">
                            {avgAttendanceRate}%
                        </div>
                        <div className="text-xs text-gray-500">
                            across all classes
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-lg border border-gray-200">
                    <div className="p-6 border-b border-gray-200">
                        <h2 className="text-[#203622]">
                            Performance by Facility
                        </h2>
                        <p className="text-sm text-gray-600 mt-1">
                            Compare how this program performs across different
                            facilities
                        </p>
                    </div>

                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-12" />
                                <TableHead
                                    className="cursor-pointer hover:bg-gray-50"
                                    onClick={() => toggleSort('facility')}
                                >
                                    <div className="flex items-center gap-2">
                                        Facility
                                        {sortColumn === 'facility' &&
                                            (sortDirection === 'asc' ? (
                                                <ChevronUp className="size-4" />
                                            ) : (
                                                <ChevronDown className="size-4" />
                                            ))}
                                    </div>
                                </TableHead>
                                <TableHead
                                    className="cursor-pointer hover:bg-gray-50"
                                    onClick={() => toggleSort('classes')}
                                >
                                    <div className="flex items-center gap-2">
                                        Classes
                                        {sortColumn === 'classes' &&
                                            (sortDirection === 'asc' ? (
                                                <ChevronUp className="size-4" />
                                            ) : (
                                                <ChevronDown className="size-4" />
                                            ))}
                                    </div>
                                </TableHead>
                                <TableHead
                                    className="cursor-pointer hover:bg-gray-50"
                                    onClick={() => toggleSort('enrolled')}
                                >
                                    <div className="flex items-center gap-2">
                                        Enrolled
                                        {sortColumn === 'enrolled' &&
                                            (sortDirection === 'asc' ? (
                                                <ChevronUp className="size-4" />
                                            ) : (
                                                <ChevronDown className="size-4" />
                                            ))}
                                    </div>
                                </TableHead>
                                <TableHead>Utilization</TableHead>
                                <TableHead
                                    className="cursor-pointer hover:bg-gray-50"
                                    onClick={() => toggleSort('completion')}
                                >
                                    <div className="flex items-center gap-2">
                                        Completion
                                        {sortColumn === 'completion' &&
                                            (sortDirection === 'asc' ? (
                                                <ChevronUp className="size-4" />
                                            ) : (
                                                <ChevronDown className="size-4" />
                                            ))}
                                    </div>
                                </TableHead>
                                <TableHead>Attendance</TableHead>
                                <TableHead className="w-32" />
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {sortedFacilityStats.map((stat) => {
                                const isExpanded =
                                    expandedFacilities[stat.facilityId];

                                return (
                                    <Fragment key={stat.facilityId}>
                                        <TableRow
                                            className="hover:bg-gray-50 cursor-pointer"
                                            onClick={() =>
                                                toggleFacilityExpanded(
                                                    stat.facilityId
                                                )
                                            }
                                        >
                                            <TableCell>
                                                {isExpanded ? (
                                                    <ChevronUp className="size-4 text-gray-600" />
                                                ) : (
                                                    <ChevronDown className="size-4 text-gray-600" />
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <div className="font-medium text-[#203622]">
                                                    {stat.facilityName}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div>
                                                    <div className="font-medium">
                                                        {stat.activeClasses}{' '}
                                                        <Tooltip>
                                                            <TooltipTrigger
                                                                asChild
                                                            >
                                                                <span className="text-gray-500 cursor-help">
                                                                    active
                                                                </span>
                                                            </TooltipTrigger>
                                                            <TooltipContent className="bg-[#203622] text-white max-w-xs">
                                                                Classes
                                                                currently
                                                                running with
                                                                enrolled
                                                                residents
                                                            </TooltipContent>
                                                        </Tooltip>
                                                    </div>
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <div className="text-sm text-gray-500 cursor-help w-fit">
                                                                {
                                                                    stat.totalClasses
                                                                }{' '}
                                                                total
                                                            </div>
                                                        </TooltipTrigger>
                                                        <TooltipContent className="bg-[#203622] text-white max-w-xs">
                                                            All classes for this
                                                            program (active,
                                                            completed, and
                                                            scheduled)
                                                        </TooltipContent>
                                                    </Tooltip>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div>
                                                    <div className="font-medium">
                                                        {
                                                            stat.currentEnrollments
                                                        }{' '}
                                                        <Tooltip>
                                                            <TooltipTrigger
                                                                asChild
                                                            >
                                                                <span className="text-gray-500 cursor-help">
                                                                    current
                                                                </span>
                                                            </TooltipTrigger>
                                                            <TooltipContent className="bg-[#203622] text-white max-w-xs">
                                                                Residents
                                                                currently
                                                                enrolled in this
                                                                program. A
                                                                single resident
                                                                can be enrolled
                                                                in more than one
                                                                class.
                                                            </TooltipContent>
                                                        </Tooltip>
                                                    </div>
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <div className="text-sm text-gray-500 cursor-help w-fit">
                                                                {
                                                                    stat.historicalEnrollments
                                                                }{' '}
                                                                historical
                                                            </div>
                                                        </TooltipTrigger>
                                                        <TooltipContent className="bg-[#203622] text-white max-w-xs">
                                                            Past enrollments
                                                            including completed,
                                                            withdrawn, dropped,
                                                            failed to complete,
                                                            and transfered
                                                        </TooltipContent>
                                                    </Tooltip>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <div className="flex-1 bg-gray-200 rounded-full h-2">
                                                        <div
                                                            className="bg-[#556830] rounded-full h-2"
                                                            style={{
                                                                width: `${Math.min(
                                                                    stat.utilization,
                                                                    100
                                                                )}%`
                                                            }}
                                                        />
                                                    </div>
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <span className="text-sm text-gray-600 w-12 cursor-help">
                                                                {Math.round(
                                                                    stat.utilization
                                                                )}
                                                                %
                                                            </span>
                                                        </TooltipTrigger>
                                                        <TooltipContent className="bg-[#203622] text-white max-w-xs">
                                                            Percentage of
                                                            available capacity
                                                            currently filled
                                                        </TooltipContent>
                                                    </Tooltip>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <span
                                                            className={`text-sm font-medium cursor-help ${
                                                                stat.completionRate >=
                                                                75
                                                                    ? 'text-green-700'
                                                                    : stat.completionRate >=
                                                                        50
                                                                      ? 'text-yellow-700'
                                                                      : 'text-red-700'
                                                            }`}
                                                        >
                                                            {Math.round(
                                                                stat.completionRate
                                                            )}
                                                            %
                                                        </span>
                                                    </TooltipTrigger>
                                                    <TooltipContent className="bg-[#203622] text-white max-w-xs">
                                                        Percentage of residents
                                                        who successfully
                                                        completed the program
                                                        out of all who have
                                                        finished (not including
                                                        current enrollments)
                                                    </TooltipContent>
                                                </Tooltip>
                                            </TableCell>
                                            <TableCell>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <span
                                                            className={`text-sm font-medium cursor-help ${
                                                                stat.attendanceRate >=
                                                                85
                                                                    ? 'text-green-700'
                                                                    : stat.attendanceRate >=
                                                                        70
                                                                      ? 'text-yellow-700'
                                                                      : 'text-red-700'
                                                            }`}
                                                        >
                                                            {Math.round(
                                                                stat.attendanceRate
                                                            )}
                                                            %
                                                        </span>
                                                    </TooltipTrigger>
                                                    <TooltipContent className="bg-[#203622] text-white max-w-xs">
                                                        Average attendance rate
                                                        across all active
                                                        classes in this program
                                                    </TooltipContent>
                                                </Tooltip>
                                            </TableCell>
                                            <TableCell>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        void handleViewAtFacility(
                                                            stat.facilityId
                                                        );
                                                    }}
                                                    className="gap-2 text-[#556830] hover:text-[#203622] hover:bg-[#E2E7EA] focus-visible:border-[#b3b3b3] focus-visible:ring-[3px] focus-visible:ring-[#b3b3b3]/50 focus-visible:ring-offset-0"
                                                >
                                                    View at Facility
                                                    <ArrowRight className="size-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>

                                        {isExpanded && (
                                            <TableRow
                                                key={`${stat.facilityId}-expanded`}
                                                className="bg-gray-50"
                                            >
                                                <TableCell
                                                    colSpan={8}
                                                    className="p-0"
                                                >
                                                    {stat.classes.length > 0 ? (
                                                        <div className="px-12 py-4">
                                                            <div className="text-sm font-medium text-gray-700 mb-3">
                                                                Classes at{' '}
                                                                {
                                                                    stat.facilityName
                                                                }
                                                            </div>
                                                            <Table>
                                                                <TableHeader>
                                                                    <TableRow>
                                                                        <TableHead>
                                                                            Class
                                                                            Name
                                                                        </TableHead>
                                                                        <TableHead>
                                                                            Instructor
                                                                        </TableHead>
                                                                        <TableHead>
                                                                            Enrolled
                                                                        </TableHead>
                                                                        <TableHead>
                                                                            Status
                                                                        </TableHead>
                                                                        <TableHead>
                                                                            Schedule
                                                                        </TableHead>
                                                                        <TableHead />
                                                                    </TableRow>
                                                                </TableHeader>
                                                                <TableBody>
                                                                    {stat.classes.map(
                                                                        (
                                                                            cls
                                                                        ) => (
                                                                            <TableRow
                                                                                key={
                                                                                    cls.id
                                                                                }
                                                                                className="hover:bg-white"
                                                                            >
                                                                                <TableCell className="font-medium">
                                                                                    {
                                                                                        cls.name
                                                                                    }
                                                                                </TableCell>
                                                                                <TableCell className="text-sm text-gray-600">
                                                                                    {
                                                                                        cls.instructor_name
                                                                                    }
                                                                                </TableCell>
                                                                                <TableCell>
                                                                                    <span className="text-sm">
                                                                                        {
                                                                                            cls.enrolled
                                                                                        }{' '}
                                                                                        /{' '}
                                                                                        {
                                                                                            cls.capacity
                                                                                        }
                                                                                    </span>
                                                                                </TableCell>
                                                                                <TableCell>
                                                                                    <Badge
                                                                                        variant="outline"
                                                                                        className={`${classStatusColors[cls.status]} text-xs`}
                                                                                    >
                                                                                        {
                                                                                            cls.status
                                                                                        }
                                                                                    </Badge>
                                                                                </TableCell>
                                                                                <TableCell className="text-sm text-gray-600">
                                                                                    <div>
                                                                                        <div>
                                                                                            {cls.schedule
                                                                                                ? abbreviateScheduleDays(
                                                                                                      cls.schedule
                                                                                                  )
                                                                                                : '—'}
                                                                                        </div>
                                                                                        <div className="text-xs text-gray-500">
                                                                                            {formatDateRange(
                                                                                                cls.start_dt,
                                                                                                cls.end_dt
                                                                                            )}
                                                                                        </div>
                                                                                    </div>
                                                                                </TableCell>
                                                                                <TableCell>
                                                                                    <Button
                                                                                        variant="ghost"
                                                                                        size="sm"
                                                                                        onClick={(
                                                                                            event
                                                                                        ) => {
                                                                                            event.stopPropagation();
                                                                                            navigate(
                                                                                                `/program-classes/${cls.id}/dashboard`
                                                                                            );
                                                                                        }}
                                                                                        className="gap-2 text-[#556830] hover:text-[#203622] focus-visible:border-[#b3b3b3] focus-visible:ring-[3px] focus-visible:ring-[#b3b3b3]/50 focus-visible:ring-offset-0"
                                                                                    >
                                                                                        View
                                                                                        Class
                                                                                        <ArrowRight className="size-4" />
                                                                                    </Button>
                                                                                </TableCell>
                                                                            </TableRow>
                                                                        )
                                                                    )}
                                                                </TableBody>
                                                            </Table>
                                                        </div>
                                                    ) : (
                                                        <div className="px-12 py-8 text-center">
                                                            <p className="text-gray-500 text-sm">
                                                                No classes for
                                                                this program at{' '}
                                                                {
                                                                    stat.facilityName
                                                                }
                                                            </p>
                                                        </div>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </Fragment>
                                );
                            })}
                        </TableBody>
                    </Table>
                </div>

                <ReactivateDialog
                    open={showReactivateDialog}
                    onOpenChange={setShowReactivateDialog}
                    onConfirm={(isActive) => void handleReactivate(isActive)}
                />

                <ArchiveConfirmDialog
                    open={showArchiveDialog}
                    onOpenChange={setShowArchiveDialog}
                    programName={program.name}
                    facilityCount={facilityList.length}
                    onConfirm={() => void handleProgramStatusChange('Archived')}
                />

                <CannotArchiveDialog
                    open={showCannotArchiveDialog}
                    onOpenChange={(open) => {
                        if (!open) setArchiveBlockingFacilities([]);
                        setShowCannotArchiveDialog(open);
                    }}
                    programName={program.name}
                    facilities={archiveBlockingFacilities}
                />

                <Dialog
                    open={showDeleteDialog}
                    onOpenChange={setShowDeleteDialog}
                >
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle className="text-[#203622]">
                                Delete Program
                            </DialogTitle>
                            <DialogDescription>
                                Are you sure you want to delete{' '}
                                <strong>{program.name}</strong>? This action
                                cannot be undone.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="bg-red-50 border border-red-200 rounded-lg p-4 my-4">
                            <div className="flex gap-3">
                                <AlertCircle className="size-5 text-red-600 shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-sm text-red-900 font-medium mb-1">
                                        Warning
                                    </p>
                                    <p className="text-sm text-red-700">
                                        This will permanently delete the program
                                        and all associated data from the system.
                                    </p>
                                </div>
                            </div>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <Label htmlFor="deleteConfirmation">
                                    To confirm, type the program name:{' '}
                                    <strong>{program.name}</strong>
                                </Label>
                                <Input
                                    id="deleteConfirmation"
                                    placeholder="Type program name to confirm"
                                    value={deleteConfirmText}
                                    onChange={(event) =>
                                        setDeleteConfirmText(event.target.value)
                                    }
                                    className="mt-2"
                                />
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 mt-6">
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setShowDeleteDialog(false);
                                    setDeleteConfirmText('');
                                }}
                                className="border-gray-300 focus-visible:border-[#b3b3b3] focus-visible:ring-[3px] focus-visible:ring-[#b3b3b3]/50 focus-visible:ring-offset-0"
                            >
                                Cancel
                            </Button>
                            <Button
                                variant="destructive"
                                disabled={deleteConfirmText !== program.name}
                                onClick={() => {
                                    void handleDeleteProgram();
                                    setShowDeleteDialog(false);
                                    setDeleteConfirmText('');
                                }}
                            >
                                <Trash2 className="size-4 mr-2" />
                                Delete Program
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>
        </div>
    );
}
