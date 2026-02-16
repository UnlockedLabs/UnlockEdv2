import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import useSWR from 'swr';
import { useAuth, isDeptAdmin } from '@/auth/useAuth';
import {
    ProgramsOverviewTable,
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
import { Search, Plus, Filter, Building2 } from 'lucide-react';

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
        'bg-muted text-foreground border-gray-300',
    [ProgramEffectiveStatus.Archived]: 'bg-red-100 text-red-700 border-red-300'
};

type SortOption =
    | 'name-asc'
    | 'name-desc'
    | 'enrollment-asc'
    | 'enrollment-desc';

function getEffectiveStatus(
    program: ProgramsOverviewTable
): ProgramEffectiveStatus {
    if (program.archived_at) return ProgramEffectiveStatus.Archived;
    if (program.status) return ProgramEffectiveStatus.Available;
    return ProgramEffectiveStatus.Inactive;
}

function formatDisplayName(value: string): string {
    return value.replace(/_/g, ' ').replace(/-/g, ' ');
}

function parseCommaSeparated(value: string | null | undefined): string[] {
    if (!value) return [];
    return value
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
}

export default function ProgramsPage() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { data: resp } =
        useSWR<ServerResponseMany<ProgramsOverviewTable>>(
            '/api/programs/detailed-list'
        );
    const programs = resp?.data ?? [];

    const [search, setSearch] = useState('');
    const [sort, setSort] = useState<SortOption>('name-asc');
    const [typeFilters, setTypeFilters] = useState<Set<ProgramType>>(
        new Set()
    );
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
            result = result.filter((p) =>
                p.program_name.toLowerCase().includes(q)
            );
        }

        if (typeFilters.size > 0) {
            result = result.filter((p) => {
                const types = parseCommaSeparated(p.program_types);
                return types.some((t) => typeFilters.has(t as ProgramType));
            });
        }

        if (statusFilters.size > 0) {
            result = result.filter((p) =>
                statusFilters.has(getEffectiveStatus(p))
            );
        }

        result = [...result].sort((a, b) => {
            switch (sort) {
                case 'name-asc':
                    return a.program_name.localeCompare(b.program_name);
                case 'name-desc':
                    return b.program_name.localeCompare(a.program_name);
                case 'enrollment-asc':
                    return (
                        (a.total_active_enrollments ?? 0) -
                        (b.total_active_enrollments ?? 0)
                    );
                case 'enrollment-desc':
                    return (
                        (b.total_active_enrollments ?? 0) -
                        (a.total_active_enrollments ?? 0)
                    );
            }
        });

        return result;
    }, [programs, search, sort, typeFilters, statusFilters]);

    const stats = useMemo(() => {
        const active = programs.filter((p) => p.status && !p.archived_at);
        const totalEnrollment = programs.reduce(
            (sum, p) => sum + (p.total_active_enrollments ?? 0),
            0
        );
        const totalClasses = programs.reduce(
            (sum, p) => sum + (p.total_classes ?? 0),
            0
        );
        const totalCapacity = programs.reduce(
            (sum, p) => sum + (p.total_capacity ?? 0),
            0
        );
        const utilization =
            totalCapacity > 0
                ? Math.round((totalEnrollment / totalCapacity) * 100)
                : 0;
        return {
            activePrograms: active.length,
            totalClasses,
            totalEnrollment,
            capacityUtilization: utilization
        };
    }, [programs]);

    const isDeptAdminUser = user ? isDeptAdmin(user) : false;
    const subtitle = isDeptAdminUser
        ? 'Manage programs across all facilities'
        : 'Supporting resident growth and rehabilitation';

    return (
        <div className="space-y-6">
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">
                        Programs
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        {subtitle}
                    </p>
                </div>
                <Button
                    className="bg-[#F1B51C] text-foreground hover:bg-[#F1B51C]/90 font-medium"
                    onClick={() => navigate('/programs/detail')}
                >
                    <Plus className="size-4" />
                    {isDeptAdminUser
                        ? 'Create Statewide Program'
                        : 'Add Program'}
                </Button>
            </div>

            <div className="grid grid-cols-4 gap-4">
                <StatCard
                    label="Active Programs"
                    value={stats.activePrograms}
                />
                <StatCard
                    label="Total Classes"
                    value={stats.totalClasses}
                />
                <StatCard
                    label="Total Enrollment"
                    value={stats.totalEnrollment}
                />
                <StatCard
                    label="Capacity Utilization"
                    value={`${stats.capacityUtilization}%`}
                />
            </div>

            <div className="flex items-center gap-3">
                <div className="relative flex-1">
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
                    <SelectTrigger className="w-44">
                        <SelectValue placeholder="Sort by" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="name-asc">Name (A-Z)</SelectItem>
                        <SelectItem value="name-desc">Name (Z-A)</SelectItem>
                        <SelectItem value="enrollment-desc">
                            Enrollment (High-Low)
                        </SelectItem>
                        <SelectItem value="enrollment-asc">
                            Enrollment (Low-High)
                        </SelectItem>
                    </SelectContent>
                </Select>

                <Popover>
                    <PopoverTrigger asChild>
                        <Button variant="outline" className="gap-2">
                            <Filter className="size-4" />
                            Type
                            {typeFilters.size > 0 && (
                                <span className="rounded-full bg-[#556830] text-white size-5 flex items-center justify-center text-xs">
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
                        <Button variant="outline" className="gap-2">
                            <Filter className="size-4" />
                            Status
                            {statusFilters.size > 0 && (
                                <span className="rounded-full bg-[#556830] text-white size-5 flex items-center justify-center text-xs">
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
                            key={program.program_id}
                            program={program}
                            showFacilities={isDeptAdminUser}
                            onClick={() =>
                                navigate(
                                    '/programs/' + program.program_id
                                )
                            }
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

function StatCard({
    label,
    value
}: {
    label: string;
    value: string | number;
}) {
    return (
        <Card className="bg-card">
            <CardContent className="p-5">
                <p className="text-3xl font-bold text-foreground">{value}</p>
                <p className="text-sm text-muted-foreground mt-1">{label}</p>
            </CardContent>
        </Card>
    );
}

function ProgramCard({
    program,
    showFacilities,
    onClick
}: {
    program: ProgramsOverviewTable;
    showFacilities: boolean;
    onClick: () => void;
}) {
    const status = getEffectiveStatus(program);
    const types = parseCommaSeparated(program.program_types);
    const credits = parseCommaSeparated(program.credit_types);
    const funding = program.funding_type
        ? program.funding_type.replace(/_/g, ' ')
        : '';

    return (
        <Card
            className="cursor-pointer hover:shadow-md transition-shadow bg-card"
            onClick={onClick}
        >
            <CardContent className="p-5 space-y-4">
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <h3 className="font-semibold text-foreground text-lg leading-tight">
                            {program.program_name}
                        </h3>
                        {program.description && (
                            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                                {program.description}
                            </p>
                        )}
                    </div>
                    <span
                        className={cn(
                            'text-xs px-2.5 py-0.5 rounded-full border shrink-0 font-medium',
                            statusColors[status]
                        )}
                    >
                        {status}
                    </span>
                </div>

                {types.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                        {types.map((type) => (
                            <span
                                key={type}
                                className={cn(
                                    'text-xs px-2.5 py-0.5 rounded-full border font-medium',
                                    programTypeColors[type] ??
                                        'bg-muted text-foreground border-border'
                                )}
                            >
                                {formatDisplayName(type)}
                            </span>
                        ))}
                    </div>
                )}

                <div className="grid grid-cols-3 gap-3">
                    <MetricBox
                        label="Active Enrollment"
                        value={program.total_active_enrollments ?? 0}
                    />
                    <MetricBox
                        label="Classes"
                        value={program.total_classes ?? 0}
                    />
                    <MetricBox
                        label="Completion"
                        value={`${Math.round(program.completion_rate ?? 0)}%`}
                    />
                </div>

                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    {credits.length > 0 && (
                        <span>
                            Credit:{' '}
                            {credits.map(formatDisplayName).join(', ')}
                        </span>
                    )}
                    {funding && <span>Funding: {funding}</span>}
                </div>

                {showFacilities &&
                    (program.total_active_facilities ?? 0) > 0 && (
                        <div className="flex items-center gap-1.5 pt-1 text-xs text-muted-foreground border-t">
                            <Building2 className="size-3.5" />
                            Active in{' '}
                            <span className="font-semibold text-foreground">
                                {program.total_active_facilities}
                            </span>{' '}
                            {program.total_active_facilities === 1
                                ? 'facility'
                                : 'facilities'}
                        </div>
                    )}
            </CardContent>
        </Card>
    );
}

function MetricBox({
    label,
    value
}: {
    label: string;
    value: string | number;
}) {
    return (
        <div className="bg-muted/50 rounded-lg p-3">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-lg font-semibold text-foreground mt-0.5">
                {value}
            </p>
        </div>
    );
}
