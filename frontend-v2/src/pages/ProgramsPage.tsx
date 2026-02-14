import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import useSWR from 'swr';
import { useAuth, isDeptAdmin } from '@/auth/useAuth';
import {
    ProgramOverview,
    ProgramType,
    ProgramEffectiveStatus,
    ServerResponseMany
} from '@/types';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';
import {
    Popover,
    PopoverContent,
    PopoverTrigger
} from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Search,
    Plus,
    Filter,
    Users,
    BookOpen,
    TrendingUp,
    GraduationCap,
    Building2
} from 'lucide-react';

const programTypeColors: Record<string, string> = {
    Educational: 'bg-blue-100 text-blue-700 border-blue-200',
    Vocational: 'bg-orange-100 text-orange-700 border-orange-200',
    Mental_Health_Behavioral: 'bg-pink-100 text-pink-700 border-pink-200',
    Therapeutic: 'bg-teal-100 text-teal-700 border-teal-200',
    Life_Skills: 'bg-green-100 text-green-700 border-green-200',
    'Re-Entry': 'bg-indigo-100 text-indigo-700 border-indigo-200',
    'Religious_Faith-Based': 'bg-amber-100 text-amber-700 border-amber-200'
};

const statusColors: Record<ProgramEffectiveStatus, string> = {
    [ProgramEffectiveStatus.Available]:
        'bg-green-100 text-green-700 border-green-300',
    [ProgramEffectiveStatus.Inactive]:
        'bg-gray-100 text-gray-700 border-gray-300',
    [ProgramEffectiveStatus.Archived]: 'bg-red-100 text-red-700 border-red-300'
};

type SortOption =
    | 'name-asc'
    | 'name-desc'
    | 'enrollment-asc'
    | 'enrollment-desc';

function getEffectiveStatus(program: ProgramOverview): ProgramEffectiveStatus {
    if (program.archived_at) return ProgramEffectiveStatus.Archived;
    if (program.is_active) return ProgramEffectiveStatus.Available;
    return ProgramEffectiveStatus.Inactive;
}

function formatDisplayName(value: string): string {
    return value.replace(/_/g, ' ').replace(/-/g, ' ');
}

export default function ProgramsPage() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { data: resp } = useSWR<ServerResponseMany<ProgramOverview>>(
        '/api/programs'
    );
    const programs = resp?.data ?? [];

    const [search, setSearch] = useState('');
    const [sort, setSort] = useState<SortOption>('name-asc');
    const [typeFilters, setTypeFilters] = useState<Set<ProgramType>>(new Set());
    const [statusFilters, setStatusFilters] = useState<
        Set<ProgramEffectiveStatus>
    >(new Set());

    const toggleTypeFilter = (type: ProgramType) => {
        setTypeFilters((prev) => {
            const next = new Set(prev);
            if (next.has(type)) {
                next.delete(type);
            } else {
                next.add(type);
            }
            return next;
        });
    };

    const toggleStatusFilter = (status: ProgramEffectiveStatus) => {
        setStatusFilters((prev) => {
            const next = new Set(prev);
            if (next.has(status)) {
                next.delete(status);
            } else {
                next.add(status);
            }
            return next;
        });
    };

    const filtered = useMemo(() => {
        let result = programs;

        if (search) {
            const q = search.toLowerCase();
            result = result.filter(
                (p) =>
                    p.name.toLowerCase().includes(q) ||
                    p.description.toLowerCase().includes(q)
            );
        }

        if (typeFilters.size > 0) {
            result = result.filter((p) =>
                p.program_types.some((pt) => typeFilters.has(pt.program_type))
            );
        }

        if (statusFilters.size > 0) {
            result = result.filter((p) =>
                statusFilters.has(getEffectiveStatus(p))
            );
        }

        result = [...result].sort((a, b) => {
            switch (sort) {
                case 'name-asc':
                    return a.name.localeCompare(b.name);
                case 'name-desc':
                    return b.name.localeCompare(a.name);
                case 'enrollment-asc':
                    return a.active_enrollments - b.active_enrollments;
                case 'enrollment-desc':
                    return b.active_enrollments - a.active_enrollments;
            }
        });

        return result;
    }, [programs, search, sort, typeFilters, statusFilters]);

    const stats = useMemo(() => {
        const active = programs.filter((p) => p.is_active && !p.archived_at);
        const totalEnrollment = programs.reduce(
            (sum, p) => sum + p.active_enrollments,
            0
        );
        const totalClasses = programs.reduce(
            (sum, p) => sum + (p.active_class_facility_ids?.length ?? 0),
            0
        );
        const avgCompletion =
            active.length > 0
                ? active.reduce((sum, p) => sum + p.completion_rate, 0) /
                  active.length
                : 0;
        return {
            activePrograms: active.length,
            totalClasses,
            totalEnrollment,
            capacityUtilization: Math.round(avgCompletion)
        };
    }, [programs]);

    const isDeptAdminUser = user ? isDeptAdmin(user) : false;
    const subtitle = isDeptAdminUser
        ? 'Manage programs across all facilities'
        : 'Manage programs at your facility';

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-[#203622]">
                        Programs
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        {subtitle}
                    </p>
                </div>
                <Button
                    className="bg-[#F1B51C] text-[#203622] hover:bg-[#F1B51C]/90 font-medium"
                    onClick={() => navigate('/programs/new')}
                >
                    <Plus className="size-4" />
                    Add Program
                </Button>
            </div>

            <div className="grid grid-cols-4 gap-4">
                <StatCard
                    icon={<BookOpen className="size-5 text-[#556830]" />}
                    label="Active Programs"
                    value={stats.activePrograms}
                />
                <StatCard
                    icon={<GraduationCap className="size-5 text-[#556830]" />}
                    label="Total Classes"
                    value={stats.totalClasses}
                />
                <StatCard
                    icon={<Users className="size-5 text-[#556830]" />}
                    label="Total Enrollment"
                    value={stats.totalEnrollment}
                />
                <StatCard
                    icon={<TrendingUp className="size-5 text-[#556830]" />}
                    label="Avg Completion Rate"
                    value={`${stats.capacityUtilization}%`}
                />
            </div>

            <div className="flex items-center gap-3">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <Input
                        placeholder="Search programs..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9"
                    />
                </div>

                <Select
                    value={sort}
                    onValueChange={(v) => setSort(v as SortOption)}
                >
                    <SelectTrigger className="w-48">
                        <SelectValue placeholder="Sort by" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="name-asc">Name A-Z</SelectItem>
                        <SelectItem value="name-desc">Name Z-A</SelectItem>
                        <SelectItem value="enrollment-desc">
                            Enrollment High-Low
                        </SelectItem>
                        <SelectItem value="enrollment-asc">
                            Enrollment Low-High
                        </SelectItem>
                    </SelectContent>
                </Select>

                <Popover>
                    <PopoverTrigger asChild>
                        <Button variant="outline" size="sm">
                            <Filter className="size-4" />
                            Type
                            {typeFilters.size > 0 && (
                                <span className="ml-1 rounded-full bg-[#556830] text-white size-5 flex items-center justify-center text-xs">
                                    {typeFilters.size}
                                </span>
                            )}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-56">
                        <div className="space-y-2">
                            <p className="text-sm font-medium">Program Type</p>
                            {Object.values(ProgramType).map((type) => (
                                <label
                                    key={type}
                                    className="flex items-center gap-2 cursor-pointer"
                                >
                                    <Checkbox
                                        checked={typeFilters.has(type)}
                                        onCheckedChange={() =>
                                            toggleTypeFilter(type)
                                        }
                                    />
                                    <span className="text-sm">
                                        {formatDisplayName(type)}
                                    </span>
                                </label>
                            ))}
                        </div>
                    </PopoverContent>
                </Popover>

                <Popover>
                    <PopoverTrigger asChild>
                        <Button variant="outline" size="sm">
                            <Filter className="size-4" />
                            Status
                            {statusFilters.size > 0 && (
                                <span className="ml-1 rounded-full bg-[#556830] text-white size-5 flex items-center justify-center text-xs">
                                    {statusFilters.size}
                                </span>
                            )}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-48">
                        <div className="space-y-2">
                            <p className="text-sm font-medium">Status</p>
                            {Object.values(ProgramEffectiveStatus).map(
                                (status) => (
                                    <label
                                        key={status}
                                        className="flex items-center gap-2 cursor-pointer"
                                    >
                                        <Checkbox
                                            checked={statusFilters.has(status)}
                                            onCheckedChange={() =>
                                                toggleStatusFilter(status)
                                            }
                                        />
                                        <span className="text-sm">
                                            {status}
                                        </span>
                                    </label>
                                )
                            )}
                        </div>
                    </PopoverContent>
                </Popover>
            </div>

            {filtered.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                    No programs found matching your criteria.
                </div>
            ) : (
                <div className="grid grid-cols-2 gap-4">
                    {filtered.map((program) => (
                        <ProgramCard
                            key={program.id}
                            program={program}
                            showFacilities={isDeptAdminUser}
                            onClick={() =>
                                navigate('/programs/' + program.id)
                            }
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

function StatCard({
    icon,
    label,
    value
}: {
    icon: React.ReactNode;
    label: string;
    value: string | number;
}) {
    return (
        <Card className="bg-white">
            <CardContent className="flex items-center gap-3 py-4">
                <div className="rounded-lg bg-[#E2E7EA] p-2">{icon}</div>
                <div>
                    <p className="text-2xl font-bold text-[#203622]">{value}</p>
                    <p className="text-xs text-muted-foreground">{label}</p>
                </div>
            </CardContent>
        </Card>
    );
}

function ProgramCard({
    program,
    showFacilities,
    onClick
}: {
    program: ProgramOverview;
    showFacilities: boolean;
    onClick: () => void;
}) {
    const status = getEffectiveStatus(program);
    const types = program.program_types.map((pt) => pt.program_type);
    const credits = program.credit_types.map((ct) => ct.credit_type);
    const funding = program.funding_type
        ? program.funding_type.replace(/_/g, ' ')
        : '';

    return (
        <Card
            className="cursor-pointer hover:shadow-md transition-shadow bg-white"
            onClick={onClick}
        >
            <CardContent className="p-5 space-y-3">
                <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-[#203622] text-lg">
                        {program.name}
                    </h3>
                    <span
                        className={cn(
                            'text-xs px-2 py-0.5 rounded-full border shrink-0',
                            statusColors[status]
                        )}
                    >
                        {status}
                    </span>
                </div>

                <p className="text-sm text-muted-foreground line-clamp-2">
                    {program.description}
                </p>

                {types.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                        {types.map((type) => (
                            <span
                                key={type}
                                className={cn(
                                    'text-xs px-2 py-0.5 rounded border',
                                    programTypeColors[type] ??
                                        'bg-gray-100 text-gray-700 border-gray-200'
                                )}
                            >
                                {formatDisplayName(type)}
                            </span>
                        ))}
                    </div>
                )}

                <div className="grid grid-cols-3 gap-3 pt-2 border-t">
                    <MetricCell
                        label="Active Enrollment"
                        value={program.active_enrollments}
                    />
                    <MetricCell
                        label="Classes"
                        value={
                            program.active_class_facility_ids?.length ?? 0
                        }
                    />
                    <MetricCell
                        label="Completion"
                        value={`${Math.round(program.completion_rate)}%`}
                    />
                </div>

                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground pt-1">
                    {credits.length > 0 && (
                        <span>
                            Credits: {credits.map(formatDisplayName).join(', ')}
                        </span>
                    )}
                    {funding && <span>Funding: {funding}</span>}
                </div>

                {showFacilities && program.facilities?.length > 0 && (
                    <div className="flex items-center gap-1.5 pt-1 text-xs text-muted-foreground border-t">
                        <Building2 className="size-3.5" />
                        Active in {program.facilities.length}{' '}
                        {program.facilities.length === 1
                            ? 'facility'
                            : 'facilities'}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

function MetricCell({
    label,
    value
}: {
    label: string;
    value: string | number;
}) {
    return (
        <div className="text-center">
            <p className="text-lg font-semibold text-[#203622]">{value}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
        </div>
    );
}
