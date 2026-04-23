import { useState, useMemo, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import useSWR from 'swr';
import { useAuth, canSwitchFacility } from '@/auth/useAuth';
import {
    Class,
    Facility,
    Program,
    ServerResponseMany,
    SelectedClassStatus
} from '@/types';
import {
    getClassSchedule,
    getInstructorName,
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
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog';
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
    CalendarOff,
    Clock,
    AlertCircle,
    Filter,
    MapPin,
    Users
} from 'lucide-react';
import { Pagination } from '@/components/shared';
import { TakeAttendanceModal } from './class-detail/TakeAttendanceModal';
import { BulkCancelClassesModal } from '@/components/BulkCancelClassesModal';

const STATUS_OPTIONS: { label: string; value: string }[] = [
    { label: 'Active & Scheduled', value: 'active_scheduled' },
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
    const [statusFilter, setStatusFilter] = useState('active_scheduled');
    const [facilityFilter, setFacilityFilter] = useState('all');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showFacilityModal, setShowFacilityModal] = useState(false);
    const [selectedFacilityForClass, setSelectedFacilityForClass] =
        useState<number | null>(null);
    const [facilitySearch, setFacilitySearch] = useState('');
    const [programSearch, setProgramSearch] = useState('');
    const [attendanceClass, setAttendanceClass] = useState<Class | null>(null);
    const [showBulkCancel, setShowBulkCancel] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(20);

    const crossFacility = user ? canSwitchFacility(user) : false;

    const classesUrl = crossFacility
        ? facilityFilter === 'all'
            ? '/api/program-classes?per_page=100&facility=all'
            : `/api/program-classes?per_page=100&facility_id=${facilityFilter}`
        : '/api/program-classes?per_page=100';
    const { data: classesResp, mutate: mutateClasses } =
        useSWR<ServerResponseMany<Class>>(classesUrl);
    const programsUrl =
        showCreateModal || showFacilityModal
            ? `/api/programs?per_page=100${programSearch ? `&search=${encodeURIComponent(programSearch)}` : ''}${selectedFacilityForClass ? `&facility_id=${selectedFacilityForClass}` : ''}`
            : null;
    const { data: programsResp } =
        useSWR<ServerResponseMany<Program>>(programsUrl);
    const { data: facilitiesResp } = useSWR<ServerResponseMany<Facility>>(
        crossFacility ? '/api/facilities' : null
    );
    const allClasses = classesResp?.data ?? [];
    const facilities = facilitiesResp?.data ?? [];

    const facilityClasses = useMemo(() => {
        if (crossFacility || !user) return allClasses;
        return allClasses.filter((c) => c.facility_id === user.facility.id);
    }, [allClasses, crossFacility, user]);

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

    const filteredPrograms = useMemo(() => {
        const programs = programsResp?.data ?? [];
        return programs.filter((p) => {
            if (!p.is_active) return false;
            if (selectedFacilityForClass) {
                if (!p.facilities?.length) return false;
                return p.facilities.some(
                    (f) => f.id === selectedFacilityForClass
                );
            }
            if (crossFacility) return true;
            const facilityId = user?.facility?.id;
            if (!facilityId || !p.facilities?.length) return true;
            return p.facilities.some((f) => f.id === facilityId);
        });
    }, [programsResp, crossFacility, user, selectedFacilityForClass]);

    const handleProgramSelect = (programId: number) => {
        setShowCreateModal(false);
        setProgramSearch('');
        setSelectedFacilityForClass(null);
        navigate(`/programs/${programId}/classes`);
    };

    const filteredClasses = useMemo(() => {
        let result = facilityClasses;

        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            result = result.filter(
                (cls) =>
                    cls.name.toLowerCase().includes(q) ||
                    cls.program?.name?.toLowerCase().includes(q) ||
                    getInstructorName(cls.events).toLowerCase().includes(q)
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

        if (statusFilter === 'active_scheduled') {
            result = result.filter(
                (cls) =>
                    cls.status === SelectedClassStatus.Active ||
                    cls.status === SelectedClassStatus.Scheduled
            );
        } else if (statusFilter !== 'all') {
            result = result.filter((cls) => cls.status === (statusFilter as SelectedClassStatus));
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

    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, todayOnly, attendanceConcerns, facilityFilter, programFilter, statusFilter]);

    const paginatedClasses = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return filteredClasses.slice(start, start + itemsPerPage);
    }, [filteredClasses, currentPage, itemsPerPage]);

    return (
        <>
        <div className="max-w-7xl mx-auto px-6 py-8">
                <div className="mb-8">
                    <div className="flex items-center justify-between mb-2">
                        <div>
                            <h1 className="text-[#203622]">
                                Classes
                            </h1>
                            <p className="text-gray-600 mt-1">
                                Manage and monitor all classes at your facility
                            </p>
                        </div>
                        <div className="flex gap-3">
                            <Button
                                variant="outline"
                                className="border-red-300 text-red-700 hover:bg-red-50 hover:border-red-400"
                                onClick={() => setShowBulkCancel(true)}
                            >
                                <CalendarOff className="size-4 mr-2" />
                                Cancel Classes by Instructor
                            </Button>
                            <Button
                                className="bg-[#F1B51C] text-[#203622] hover:bg-[#d9a419] gap-2"
                                onClick={() => {
                                    if (crossFacility) {
                                        setShowFacilityModal(true);
                                    } else {
                                        setShowCreateModal(true);
                                    }
                                }}
                            >
                                <Plus className="size-5" />
                                Create New Class
                            </Button>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
                    <div className="flex gap-4 items-center flex-wrap">
                        <div className="flex-1 relative min-w-[300px]">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-gray-400" />
                            <Input
                                placeholder="Search classes, programs, or instructors..."
                                value={searchQuery}
                                onChange={(e) =>
                                    setSearchQuery(e.target.value)
                                }
                                className="pl-10"
                            />
                        </div>
                        <Button
                            variant={todayOnly ? 'default' : 'outline'}
                            className={cn(
                                todayOnly
                                    ? 'bg-[#556830] hover:bg-[#203622]'
                                    : ''
                            )}
                            onClick={() => setTodayOnly(!todayOnly)}
                        >
                            <Calendar className="size-4 mr-2" />
                            Today Only
                        </Button>
                        <Button
                            variant={
                                attendanceConcerns ? 'default' : 'outline'
                            }
                            className={cn(
                                attendanceConcerns
                                    ? 'bg-[#F1B51C] hover:bg-[#d9a419] text-[#203622]'
                                    : ''
                            )}
                            onClick={() =>
                                setAttendanceConcerns(!attendanceConcerns)
                            }
                        >
                            <AlertCircle className="size-4 mr-2" />
                            Attendance Concerns
                        </Button>
                        {crossFacility && (
                            <Select
                                value={facilityFilter}
                                onValueChange={setFacilityFilter}
                            >
                                <SelectTrigger className="w-[200px] overflow-hidden">
                                    <Filter className="size-4 mr-2 shrink-0" />
                                    <SelectValue placeholder="All Facilities" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">
                                        All Facilities
                                    </SelectItem>
                                    {facilities.map((facility) => (
                                        <SelectItem
                                            key={facility.id}
                                            value={String(facility.id)}
                                        >
                                            {facility.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                        <Select
                            value={programFilter}
                            onValueChange={setProgramFilter}
                        >
                            <SelectTrigger className="w-[220px]">
                                <Filter className="size-4 mr-2" />
                                <SelectValue placeholder="All Programs" />
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
                            <SelectTrigger className="w-[180px]">
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

                <div className="mb-4 text-sm text-gray-600">
                    Showing {filteredClasses.length}{' '}
                    {filteredClasses.length === 1 ? 'class' : 'classes'}
                    {todayOnly &&
                        ` scheduled for today (${new Date().toLocaleDateString('en-US', { weekday: 'long' })})`}
                    {attendanceConcerns && ' with attendance concerns'}
                </div>

                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                    <table className="w-full">
                        <thead className="bg-[#E2E7EA] border-b border-gray-200">
                            <tr>
                                <th className="text-left px-6 py-4 text-sm text-[#203622] w-[24%]">
                                    Class Name
                                </th>
                                <th className="text-left px-6 py-4 text-sm text-[#203622] w-[15%]">
                                    Instructor
                                </th>
                                <th className="text-left px-6 py-4 text-sm text-[#203622] w-[23%]">
                                    Schedule
                                </th>
                                <th className="text-left px-6 py-4 text-sm text-[#203622] w-[14%]">
                                    Enrollment
                                </th>
                                <th className="text-left px-6 py-4 text-sm text-[#203622] w-[10%]">
                                    Status
                                </th>
                                <th className="text-left px-6 py-4 text-sm text-[#203622] w-[14%]">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {paginatedClasses.length === 0 ? (
                                <tr>
                                    <td
                                        colSpan={6}
                                        className="px-6 py-12 text-center text-gray-500"
                                    >
                                        <Users className="size-12 mx-auto mb-3 text-gray-300" />
                                        <p>No classes found</p>
                                        <p className="text-sm mt-1">
                                            Try adjusting your search or
                                            filters
                                        </p>
                                    </td>
                                </tr>
                            ) : (
                                paginatedClasses.map((cls) => (
                                    <ClassRow
                                        key={cls.id}
                                        cls={cls}
                                        showFacility={crossFacility}
                                        onClick={() =>
                                            navigate(
                                                `/program-classes/${cls.id}/detail`
                                            )
                                        }
                                        onAttendance={() =>
                                            setAttendanceClass(cls)
                                        }
                                    />
                                ))
                            )}
                        </tbody>
                    </table>
                    <Pagination
                        totalItems={filteredClasses.length}
                        itemsPerPage={itemsPerPage}
                        currentPage={currentPage}
                        onPageChange={setCurrentPage}
                        onItemsPerPageChange={setItemsPerPage}
                        itemLabel="classes"
                    />
                </div>
            </div>

            <Dialog
                open={showFacilityModal}
                onOpenChange={(open) => {
                    setShowFacilityModal(open);
                    if (!open) setFacilitySearch('');
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Create New Class</DialogTitle>
                        <DialogDescription>
                            Classes are organized within Programs. Which
                            facility is this class for?
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3 mt-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
                            <Input
                                placeholder="Search facilities..."
                                value={facilitySearch}
                                onChange={(e) =>
                                    setFacilitySearch(e.target.value)
                                }
                                className="pl-10"
                            />
                        </div>
                        <div className="max-h-[400px] overflow-y-auto space-y-2">
                            {facilities
                                .filter(
                                    (f) =>
                                        !facilitySearch ||
                                        f.name
                                            .toLowerCase()
                                            .includes(
                                                facilitySearch.toLowerCase()
                                            )
                                )
                                .map((facility) => (
                                    <button
                                        key={facility.id}
                                        onClick={() => {
                                            setSelectedFacilityForClass(
                                                facility.id
                                            );
                                            setShowFacilityModal(false);
                                            setFacilitySearch('');
                                            setShowCreateModal(true);
                                        }}
                                        className="w-full text-left p-4 rounded-lg border border-gray-200 hover:border-[#556830] hover:bg-[#E2E7EA]/50 transition-colors"
                                    >
                                        <div className="text-[#203622] font-medium">
                                            {facility.name}
                                        </div>
                                    </button>
                                ))}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog
                open={showCreateModal}
                onOpenChange={(open) => {
                    setShowCreateModal(open);
                    if (!open) {
                        setProgramSearch('');
                                        setSelectedFacilityForClass(null);
                    }
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Create New Class</DialogTitle>
                        <DialogDescription>
                            Classes are organized within Programs. Which
                            program is this class for?
                        </DialogDescription>
                    </DialogHeader>
                    {crossFacility && selectedFacilityForClass && (() => {
                        const selectedFacility = facilities.find(
                            (f) => f.id === selectedFacilityForClass
                        );
                        return (
                            <div className="bg-[#E2E7EA] rounded-lg p-3 border border-[#556830] mt-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="text-xs text-gray-600 mb-0.5">
                                            Selected Facility
                                        </div>
                                        <div className="text-[#203622] font-medium">
                                            {selectedFacility?.name}
                                        </div>
                                    </div>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                            setShowCreateModal(false);
                                            setProgramSearch('');
                                            setShowFacilityModal(true);
                                        }}
                                    >
                                        Change Facility
                                    </Button>
                                </div>
                            </div>
                        );
                    })()}
                    <div className="space-y-3 mt-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
                            <Input
                                placeholder="Search programs..."
                                value={programSearch}
                                onChange={(e) => {
                                    setProgramSearch(e.target.value);
                                                            }}
                                className="pl-10"
                            />
                        </div>
                        <div className="max-h-[400px] overflow-y-auto space-y-2">
                            {!programsResp ? (
                                <p className="text-center text-gray-500 py-8">
                                    Loading programs...
                                </p>
                            ) : filteredPrograms.length === 0 ? (
                                <p className="text-center text-gray-500 py-8">
                                    No programs found.
                                </p>
                            ) : (
                                filteredPrograms.map((program) => (
                                    <button
                                        key={program.id}
                                        onClick={() =>
                                            handleProgramSelect(program.id)
                                        }
                                        className="w-full text-left p-4 rounded-lg border border-gray-200 hover:border-[#556830] hover:bg-[#E2E7EA]/50 transition-colors"
                                    >
                                        <div className="text-[#203622] font-medium">
                                            {program.name}
                                        </div>
                                        {program.description && (
                                            <div className="text-sm text-gray-600 mt-1">
                                                {program.description}
                                            </div>
                                        )}
                                    </button>
                                ))
                            )}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {attendanceClass && (
                <TakeAttendanceModal
                    open={!!attendanceClass}
                    onOpenChange={(open) => {
                        if (!open) setAttendanceClass(null);
                    }}
                    classId={attendanceClass.id}
                    className={attendanceClass.name}
                />
            )}

            <BulkCancelClassesModal
                open={showBulkCancel}
                onClose={() => setShowBulkCancel(false)}
                mutate={mutateClasses}
            />
        </>
    );
}

function ClassRow({
    cls,
    showFacility,
    onClick,
    onAttendance
}: {
    cls: Class;
    showFacility: boolean;
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
            className="hover:bg-[#E2E7EA]/50 cursor-pointer transition-colors"
        >
            <td className="px-6 py-4">
                <div className="flex items-center gap-3">
                    {today && cls.status === SelectedClassStatus.Active && (
                        <div className="w-2 h-2 bg-[#F1B51C] rounded-full flex-shrink-0" />
                    )}
                    <div>
                        <div className="text-[#203622] hover:text-[#556830] transition-colors font-medium">
                            {cls.name}
                        </div>
                        <Link
                            to={`/programs/${cls.program_id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="text-sm text-[#556830] hover:text-[#203622] hover:underline mt-0.5 block"
                        >
                            {cls.program?.name ?? 'Program'}
                        </Link>
                        {schedule.room && (
                            <div className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                                <MapPin className="size-3" />
                                {schedule.room}
                            </div>
                        )}
                        {showFacility &&
                            (cls.facility_name ||
                                cls.facility?.name) && (
                                <div className="text-xs text-gray-500 mt-1">
                                    {cls.facility_name ||
                                        cls.facility?.name}
                                </div>
                            )}
                    </div>
                </div>
            </td>
            <td className="px-6 py-4">
                <div className="text-sm text-gray-700">
                    {getInstructorName(cls.events)}
                </div>
            </td>
            <td className="px-6 py-4">
                <div className="text-sm text-gray-700">
                    {schedule.startTime && (
                        <div className="flex items-center gap-1 mb-1">
                            <Clock className="size-3 text-gray-500" />
                            <span>
                                {formatTime12h(schedule.startTime)}
                                {schedule.endTime &&
                                    ` - ${formatTime12h(schedule.endTime)}`}
                            </span>
                        </div>
                    )}
                    {schedule.days.length > 0 && (
                        <div className="text-xs text-gray-500 mb-1">
                            {schedule.days.join(', ')}
                        </div>
                    )}
                    <div className="text-xs text-gray-500">
                        {formatDateRangeFull(cls.start_dt, cls.end_dt)}
                    </div>
                </div>
            </td>
            <td className="px-6 py-4">
                <div className="w-[140px]">
                    <div className="mb-1">
                        <span className="text-sm text-gray-700">
                            {cls.enrolled} / {cls.capacity}
                        </span>
                    </div>
                    <Progress
                        value={enrollPct}
                        className="h-1.5"
                        indicatorClassName={cn(
                            enrollPct >= 80
                                ? 'bg-[#556830]'
                                : enrollPct >= 50
                                  ? 'bg-[#F1B51C]'
                                  : 'bg-gray-400'
                        )}
                    />
                </div>
            </td>
            <td className="px-6 py-4">
                <Badge
                    variant="outline"
                    className={getStatusColor(cls.status)}
                >
                    {cls.status}
                </Badge>
            </td>
            <td className="px-6 py-4">
                {cls.status === SelectedClassStatus.Active && (
                    <Button
                        size="sm"
                        variant="outline"
                        className="border-[#556830] text-[#556830] hover:bg-[#556830] hover:text-white"
                        onClick={(e) => {
                            e.stopPropagation();
                            onAttendance();
                        }}
                    >
                        Take Attendance
                    </Button>
                )}
            </td>
        </tr>
    );
}
