import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import useSWR from 'swr';
import { useAuth, isDeptAdmin } from '@/auth/useAuth';
import {
    ProgramsOverviewTable,
    ProgramType,
    ProgramEffectiveStatus,
    ServerResponseMany,
    ServerResponseOne,
    CreditType,
    FundingType,
    Program,
    ProgramCreditType,
    PgmType,
    Facility
} from '@/types';
import API from '@/api/api';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
    PopoverTrigger,
} from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Search, Plus, Filter, ChevronDown, Edit, Trash2, Eye } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Pagination } from '@/components/Pagination';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
    TooltipProvider,
} from '@/components/ui/tooltip';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { programTypeColors, statusColors, type SortOption } from '@/pages/program-detail/constants';

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
    const isDeptAdminUser = user ? isDeptAdmin(user) : false;

    const { data: resp, mutate } = useSWR<ServerResponseMany<ProgramsOverviewTable>>(
        '/api/programs/detailed-list?include_archived=true&per_page=100'
    );

    // Fetch facilities for Department Admin
    const { data: facilitiesResp } = useSWR<ServerResponseMany<Facility>>(
        isDeptAdminUser ? '/api/facilities' : null
    );
    const facilities = facilitiesResp?.data ?? [];

    const [search, setSearch] = useState('');
    const [sort, setSort] = useState<SortOption>('name-asc');
    const [selectedTypes, setSelectedTypes] = useState<ProgramType[]>([]);
    const [selectedStatuses, setSelectedStatuses] = useState<ProgramEffectiveStatus[]>([]);

    const [showAddProgram, setShowAddProgram] = useState(false);
    const [programFormData, setProgramFormData] = useState({
        name: '',
        description: '',
        types: [] as ProgramType[],
        creditTypes: [] as CreditType[],
        fundingTypes: [] as FundingType[],
        status: ProgramEffectiveStatus.Available,
        facilities: [] as number[],
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [editingProgram, setEditingProgram] = useState<ProgramsOverviewTable | null>(null);

    const handleEditClick = (program: ProgramsOverviewTable) => {
        // Parse program types, credit types, funding type from program data
        const types = parseCommaSeparated(program.program_types) as ProgramType[];
        const creditTypes = parseCommaSeparated(program.credit_types) as CreditType[];
        const fundingTypes = program.funding_type ? [program.funding_type as FundingType] : [];

        setProgramFormData({
            name: program.program_name,
            description: program.description || '',
            types,
            creditTypes,
            fundingTypes,
            status: getEffectiveStatus(program),
            facilities: [],
        });
        setEditingProgram(program);
        setShowAddProgram(true);
    };

    const handleCreateProgram = async () => {
        if (programFormData.types.length === 0) {
            toast.error('Please select at least one program type');
            return;
        }
        if (programFormData.creditTypes.length === 0) {
            toast.error('Please select at least one credit type');
            return;
        }
        if (programFormData.fundingTypes.length === 0) {
            toast.error('Please select at least one funding type');
            return;
        }

        setIsSubmitting(true);

        const isEditing = editingProgram !== null;

        try {
            const payload = {
                name: programFormData.name,
                description: programFormData.description,
                program_types: programFormData.types.map(
                    (type): PgmType => ({ program_type: type })
                ),
                credit_types: programFormData.creditTypes.map(
                    (type): ProgramCreditType => ({ credit_type: type })
                ),
                funding_type: programFormData.fundingTypes[0],
                is_active: programFormData.status === ProgramEffectiveStatus.Available,
            };

            const resp = isEditing
                ? await API.patch<Program, typeof payload>(
                    `programs/${editingProgram.program_id}`,
                    payload
                  ) as ServerResponseOne<Program>
                : await API.post<Program, typeof payload>(
                    'programs',
                    payload
                  ) as ServerResponseOne<Program>;

            if (!resp.success) {
                toast.error(isEditing ? 'Failed to update program' : 'Failed to create program');
                return;
            }

            toast.success(isEditing ? 'Program updated successfully' : 'Program created successfully');

            setShowAddProgram(false);
            setEditingProgram(null);
            setProgramFormData({
                name: '',
                description: '',
                types: [],
                creditTypes: [],
                fundingTypes: [],
                status: ProgramEffectiveStatus.Available,
                facilities: [],
            });

            void mutate();

        } catch {
            toast.error(isEditing ? 'Failed to update program' : 'Failed to create program');
        } finally {
            setIsSubmitting(false);
        }
    };

    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    const toggleTypeFilter = (type: ProgramType) => {
        setSelectedTypes(prev =>
            prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
        );
    };

    const toggleStatusFilter = (status: ProgramEffectiveStatus) => {
        setSelectedStatuses(prev =>
            prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]
        );
    };

    const clearFilters = () => {
        setSelectedTypes([]);
        setSelectedStatuses([]);
    };

    const programTypes: { value: ProgramType; label: string }[] = [
        { value: ProgramType.EDUCATIONAL, label: 'Educational' },
        { value: ProgramType.VOCATIONAL, label: 'Vocational' },
        { value: ProgramType.MENTAL_HEALTH, label: 'Mental Health' },
        { value: ProgramType.THERAPEUTIC, label: 'Therapeutic' },
        { value: ProgramType.LIFE_SKILLS, label: 'Life Skills' },
        { value: ProgramType.RE_ENTRY, label: 'Re-Entry' },
        { value: ProgramType.RELIGIOUS, label: 'Faith-Based' },
    ];

    const creditTypes: { value: CreditType; label: string }[] = [
        { value: CreditType.COMPLETION, label: 'Completion' },
        { value: CreditType.EARNED_TIME, label: 'Earned Time' },
        { value: CreditType.EDUCATION, label: 'Education' },
        { value: CreditType.PARTICIPATION, label: 'Participation' },
    ];

    const fundingTypes: { value: FundingType; label: string }[] = [
        { value: FundingType.EDUCATIONAL_GRANTS, label: 'Educational Grants' },
        { value: FundingType.FEDERAL_GRANTS, label: 'Federal Grants' },
        { value: FundingType.INMATE_WELFARE, label: 'Inmate Welfare Funds' },
        { value: FundingType.NON_PROFIT_ORGANIZATION, label: 'Nonprofit Organizations' },
        { value: FundingType.STATE_GRANTS, label: 'State Grants' },
        { value: FundingType.OTHER, label: 'Other' },
    ];

    const filtered = useMemo(() => {
        const programs = resp?.data ?? [];
        let result = programs;

        if (search) {
            const q = search.toLowerCase();
            result = result.filter((p) =>
                p.program_name.toLowerCase().includes(q) ||
                p.description?.toLowerCase().includes(q)
            );
        }

        if (selectedTypes.length > 0) {
            result = result.filter((p) => {
                const types = parseCommaSeparated(p.program_types);
                return types.some(type => selectedTypes.includes(type as ProgramType));
            });
        }

        if (selectedStatuses.length > 0) {
            result = result.filter((p) => {
                const status = getEffectiveStatus(p);
                return selectedStatuses.includes(status);
            });
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
                case 'completion-asc':
                    return (a.completion_rate ?? 0) - (b.completion_rate ?? 0);
                case 'completion-desc':
                    return (b.completion_rate ?? 0) - (a.completion_rate ?? 0);
                default:
                    return 0;
            }
        });

        return result;
    }, [resp?.data, search, sort, selectedTypes, selectedStatuses]);

    const paginatedPrograms = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    const stats = useMemo(() => {
        const active = filtered.filter((p) => p.status && !p.archived_at);
        const totalEnrollment = filtered.reduce(
            (sum, p) => sum + (p.total_active_enrollments ?? 0),
            0
        );
        const totalClasses = filtered.reduce(
            (sum, p) => sum + (p.total_classes ?? 0),
            0
        );
        const totalCapacity = filtered.reduce(
            (sum, p) => sum + (p.total_capacity ?? 0),
            0
        );

        const completedEnrollmentsSum = filtered.reduce(
            (sum, p) => sum + ((p.completion_rate ?? 0) * (p.total_enrollments - (p.total_active_enrollments ?? 0)) / 100),
            0
        );
        const totalCompletedEnrollments = filtered.reduce(
            (sum, p) => sum + (p.total_enrollments - (p.total_active_enrollments ?? 0)),
            0
        );
        const completionRate = totalCompletedEnrollments > 0
            ? Math.round((completedEnrollmentsSum / totalCompletedEnrollments) * 100)
            : 0;

        const utilization =
            totalCapacity > 0
                ? Math.round((totalEnrollment / totalCapacity) * 100)
                : 0;
        return {
            activePrograms: active.length,
            totalClasses,
            totalEnrollment,
            totalCapacity,
            completionRate,
            capacityUtilization: utilization
        };
    }, [filtered]);

    const subtitle = isDeptAdminUser
        ? 'Monitor program performance across all facilities'
        : 'Supporting resident growth and rehabilitation';

    return (
        <div className="-mx-6 -mt-4 -mb-4 min-h-[calc(100vh-4rem)] bg-[#E2E7EA] dark:bg-[#0a0a0a]">
            <div className="max-w-7xl mx-auto px-6 py-8">

            {/* Header */}
            <div className="mb-8">
                <div className="flex items-center justify-between mb-2">
                    <div>
                        <h1 className="text-2xl text-[#203622]">
                            Programs
                        </h1>
                        <p className="text-gray-600 mt-1 leading-[1.5]">
                            {subtitle}
                        </p>
                    </div>
                    <Button
                        className="bg-[#F1B51C] text-[#203622] hover:bg-[#d9a419] gap-2 cursor-default"
                        onClick={() => setShowAddProgram(!showAddProgram)}
                    >
                        <Plus className="size-5" />
                        {showAddProgram ? 'Cancel' : (isDeptAdminUser ? 'Create Statewide Program' : 'Add Program')}
                    </Button>
                </div>
            </div>

            {/* Stats Overview */}
            <TooltipProvider>
                <div className="grid grid-cols-4 gap-6 mb-8">
                    <StatCard
                        label="Active Programs"
                        value={stats.activePrograms}
                        tooltip={isDeptAdminUser ? 'The count of unique programs offered across all facilities' : 'The count of unique programs offered at this facility'}
                    />
                    <StatCard
                        label="Total Classes"
                        value={stats.totalClasses}
                        tooltip={isDeptAdminUser ? 'All classes across all facilities (active, completed, and scheduled)' : 'All classes at this facility (active, completed, and scheduled)'}
                    />
                    <StatCard
                        label={`enrollments of ${stats.totalCapacity} capacity`}
                        value={stats.totalEnrollment}
                        tooltip={isDeptAdminUser ? 'The total number of enrollments across all facilities. A single resident can be enrolled in more than one program.' : 'The total number of enrollments at this facility. A single resident can be enrolled in more than one program.'}
                    />
                    <StatCard
                        label="Completion Rate"
                        value={`${stats.completionRate}%`}
                        tooltip={isDeptAdminUser ? 'The percentage of residents who have completed a class across all facilities' : 'The percentage of residents who have completed a class at this facility'}
                    />
                </div>
            </TooltipProvider>

            {/* Filters */}
            <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
                <div className="flex gap-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-gray-400" />
                        <Input
                            placeholder="Search programs..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-10 focus-visible:border-gray-400 focus-visible:ring-gray-400/50 dark:!bg-[rgba(38,38,38,0.3)]"
                        />
                    </div>

                    {/* Sort Dropdown */}
                    <Select
                        value={sort}
                        onValueChange={(v) => setSort(v as SortOption)}
                    >
                        <SelectTrigger className="w-[220px] dark:!bg-[rgba(38,38,38,0.3)] cursor-default">
                            <SelectValue placeholder="Sort By" />
                        </SelectTrigger>
                        <SelectContent>
                        <SelectItem value="name-asc">Name (A-Z)</SelectItem>
                        <SelectItem value="name-desc">Name (Z-A)</SelectItem>
                        <SelectItem value="enrollment-asc">Enrollment (Low-High)</SelectItem>
                        <SelectItem value="enrollment-desc">Enrollment (High-Low)</SelectItem>
                        <SelectItem value="completion-asc">Completion (Low-High)</SelectItem>
                        <SelectItem value="completion-desc">Completion (High-Low)</SelectItem>
                        </SelectContent>
                    </Select>
                    {/* Program Type Filter */}
                    <Popover>
                        <PopoverTrigger asChild>
                            <button className="w-[220px] bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm flex items-center justify-between hover:bg-gray-50 transition-colors cursor-default">
                                <div className="flex items-center gap-2">
                                    <Filter className="size-4" />
                                    <span>Type {selectedTypes.length > 0 && `(${selectedTypes.length})`}</span>
                                </div>
                                <ChevronDown className="size-4" />
                            </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[240px] p-4">
                            <div className="mb-3 font-medium text-sm">Filter by Program Type</div>
                            <div className="space-y-3">
                                {Object.values(ProgramType).map((type) => (
                                    <label key={type} className="flex items-center gap-2 cursor-pointer">
                                        <Checkbox
                                            checked={selectedTypes.includes(type)}
                                            onCheckedChange={() => toggleTypeFilter(type)}
                                        />
                                        <span className="text-sm">{formatDisplayName(type)}</span>
                                    </label>
                                ))}
                            </div>
                        </PopoverContent>
                    </Popover>
                    {/* Status Filter */}
                    <Popover>
                        <PopoverTrigger asChild>
                            <button className="w-[220px] bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm flex items-center justify-between hover:bg-gray-50 transition-colors cursor-default">
                                <div className="flex items-center gap-2">
                                    <Filter className="size-4" />
                                    <span>Status {selectedStatuses.length > 0 && `(${selectedStatuses.length})`}</span>
                                </div>
                                <ChevronDown className="size-4" />
                            </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[240px] p-4">
                            <div className="mb-3 font-medium text-sm">Filter by Status</div>
                            <div className="space-y-3 mb-4">
                                {Object.values(ProgramEffectiveStatus).map(
                                    (status) => (
                                        <label key={status} className="flex items-center gap-2 cursor-pointer">
                                            <Checkbox
                                                checked={selectedStatuses.includes(status)}
                                                onCheckedChange={() => toggleStatusFilter(status)}
                                            />
                                            <span className="text-sm">{status}</span>
                                        </label>
                                    )
                                )}
                            </div>
                            {selectedTypes.length > 0 || selectedStatuses.length > 0 ? (
                                <Button
                                    className="w-full bg-gray-100 text-gray-700 hover:bg-gray-200"
                                    onClick={clearFilters}
                                    size="sm"
                                >
                                    Clear All Filters
                                </Button>
                            ) : null}
                        </PopoverContent>
                    </Popover>
                </div>
            </div>

            {/* Add Program Form */}
            {showAddProgram && (
                <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
                    <h3 className="text-[#203622] mb-4">
                        {editingProgram
                            ? 'Edit Program'
                            : isDeptAdminUser
                                ? 'Create Statewide Program'
                                : 'Add New Program'
                        }
                    </h3>
                    <div className="space-y-6">
                        {/* Basic Information */}
                        <div>
                            <h4 className="text-sm text-gray-700 mb-3">Basic Information</h4>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label htmlFor="programName" className="text-[#203622]">Program Name *</Label>
                                    <Input
                                        id="programName"
                                        placeholder="e.g., GED Preparation"
                                        value={programFormData.name}
                                        onChange={(e) => setProgramFormData({ ...programFormData, name: e.target.value })}
                                        className="focus-visible:border-gray-400 focus-visible:ring-gray-400/50 dark:!bg-[rgba(38,38,38,0.3)]"
                                    />
                                </div>
                                <div className="col-span-2">
                                    <Label htmlFor="programDescription" className="text-[#203622]">Description</Label>
                                    <Textarea
                                        id="programDescription"
                                        placeholder="Brief description of the program and its goals"
                                        value={programFormData.description}
                                        onChange={(e) => setProgramFormData({ ...programFormData, description: e.target.value })}
                                        rows={2}
                                        className="min-h-0 focus-visible:border-gray-400 focus-visible:ring-gray-400/50 dark:!bg-[rgba(38,38,38,0.3)]"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Categorization */}
                        <div className="pt-4 border-t border-gray-200">
                            <h4 className="text-sm text-gray-700 mb-3">Categorization</h4>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label htmlFor="category" className="text-[#203622]">Category (Program Types) *</Label>
                                    <div className="mt-2 space-y-2">
                                        {programTypes.map((type) => (
                                            <label key={type.value} className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={programFormData.types.includes(type.value)}
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            setProgramFormData({
                                                                ...programFormData,
                                                                types: [...programFormData.types, type.value]
                                                            });
                                                        } else {
                                                            setProgramFormData({
                                                                ...programFormData,
                                                                types: programFormData.types.filter(t => t !== type.value)
                                                            });
                                                        }
                                                    }}
                                                    className="rounded border-gray-300 text-[#556830] focus:ring-[#556830]"
                                                    style={{ colorScheme: 'light' }}
                                                />
                                                <span className="text-sm text-gray-700">{type.label}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <Label htmlFor="creditTypes">Credit Types *</Label>
                                    <div className="mt-2 space-y-2">
                                        {creditTypes.map((type) => (
                                            <label key={type.value} className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={programFormData.creditTypes.includes(type.value)}
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            setProgramFormData({
                                                                ...programFormData,
                                                                creditTypes: [...programFormData.creditTypes, type.value]
                                                            });
                                                        } else {
                                                            setProgramFormData({
                                                                ...programFormData,
                                                                creditTypes: programFormData.creditTypes.filter(t => t !== type.value)
                                                            });
                                                        }
                                                    }}
                                                    className="rounded border-gray-300 text-[#556830] focus:ring-[#556830]"
                                                    style={{ colorScheme: 'light' }}
                                                />
                                                <span className="text-sm text-gray-700">{type.label}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                <div className="col-span-2">
                                    <Label htmlFor="fundingType" className="text-[#203622]">Funding Type *</Label>
                                    <Select
                                        value={programFormData.fundingTypes[0] ?? ''}
                                        onValueChange={(value) => setProgramFormData({ ...programFormData, fundingTypes: [value as FundingType] })}
                                    >
                                        <SelectTrigger id="fundingType" className="dark:!bg-[rgba(38,38,38,0.3)]">
                                            <SelectValue placeholder="Select funding type" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {fundingTypes.map((type) => (
                                                <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="col-span-2">
                                    <Label htmlFor="programStatus" className="text-[#203622]">Program Availability *</Label>
                                    <Select
                                        value={programFormData.status}
                                        onValueChange={(value) => setProgramFormData({ ...programFormData, status: value as ProgramEffectiveStatus })}
                                    >
                                        <SelectTrigger id="programStatus" className="dark:!bg-[rgba(38,38,38,0.3)]">
                                            <SelectValue placeholder="Select program status" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value={ProgramEffectiveStatus.Available}>Available</SelectItem>
                                            <SelectItem value={ProgramEffectiveStatus.Inactive}>Inactive</SelectItem>
                                            <SelectItem value={ProgramEffectiveStatus.Archived}>Archived</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <p className="text-xs text-gray-500 mt-1">
                                        Available programs can accept new class enrollments. Inactive programs are temporarily paused. Archived programs are no longer offered.
                                    </p>
                                </div>

                                {/* Facilities Selection - Only for Department Admin */}
                                {isDeptAdminUser && (
                                    <div className="col-span-2">
                                        <Label htmlFor="facilities" className="text-[#203622]">Facilities Offered *</Label>
                                        <div className="mt-2 max-h-60 overflow-y-auto space-y-2 border border-gray-200 rounded-lg p-3">
                                            {facilities.length === 0 ? (
                                                <p className="text-sm text-gray-500">Loading facilities...</p>
                                            ) : (
                                                facilities.map((facility) => (
                                                    <label key={facility.id} className="flex items-center gap-2 cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            checked={programFormData.facilities.includes(facility.id)}
                                                            onChange={(e) => {
                                                                if (e.target.checked) {
                                                                    setProgramFormData({
                                                                        ...programFormData,
                                                                        facilities: [...programFormData.facilities, facility.id]
                                                                    });
                                                                } else {
                                                                    setProgramFormData({
                                                                        ...programFormData,
                                                                        facilities: programFormData.facilities.filter(f => f !== facility.id)
                                                                    });
                                                                }
                                                            }}
                                                            className="rounded border-gray-300 text-[#556830] focus:ring-[#556830]"
                                                            style={{ colorScheme: 'light' }}
                                                        />
                                                        <span className="text-sm text-gray-700">{facility.name}</span>
                                                    </label>
                                                ))
                                            )}
                                        </div>
                                        <p className="text-xs text-gray-500 mt-1">
                                            Select which facilities will offer this program. You can add more facilities later.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setShowAddProgram(false);
                                    setEditingProgram(null);
                                    // Reset form
                                    setProgramFormData({
                                        name: '',
                                        description: '',
                                        types: [],
                                        creditTypes: [],
                                        fundingTypes: [],
                                        status: ProgramEffectiveStatus.Available,
                                        facilities: [],
                                    });
                                }}
                                className="border-gray-300 dark:!bg-[rgba(38,38,38,0.3)]"
                            >
                                Cancel
                            </Button>
                            <Button
                                className="bg-[#556830] hover:bg-[#203622] text-white"
                                onClick={() => void handleCreateProgram()}
                                disabled={!programFormData.name.trim() || isSubmitting}
                            >
                                {isSubmitting
                                    ? (editingProgram ? 'Saving...' : 'Creating...')
                                    : (editingProgram ? 'Save Changes' : 'Create Program')
                                }
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {filtered.length === 0 ? (
                <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
                    <p className="text-gray-600 mb-2">No programs found</p>
                    <p className="text-sm text-gray-500">Try adjusting your search or filters</p>
                </div>
            ) : (
                <>
                    {isDeptAdminUser ? (
                        <ProgramsTable
                            programs={paginatedPrograms}
                            onRowClick={(programId) => navigate('/programs/' + programId + '/detail')}
                            onEditClick={handleEditClick}
                        />
                    ) : (
                        <div className="grid grid-cols-2 gap-6 mb-4">
                            {paginatedPrograms.map((program) => (
                                <ProgramCard
                                    key={program.program_id}
                                    program={program}
                                    showFacilities={false}
                                    onClick={() =>
                                        navigate(
                                            '/programs/' + program.program_id
                                        )
                                    }
                                />
                            ))}
                        </div>
                    )}

                {/* Pagination */}
                {filtered.length > itemsPerPage && (
                    <Pagination
                        currentPage={currentPage}
                        totalItems={filtered.length}
                        itemsPerPage={itemsPerPage}
                        onPageChange={setCurrentPage}
                        onItemsPerPageChange={(val) => { setItemsPerPage(val); setCurrentPage(1); }}
                        itemLabel="programs"
                    />
                )}
                </>
            )}
        </div>
        </div>
    );
}

function StatCard({ label, value, tooltip }: { label: string; value: string | number; tooltip?: string }) {
    const cardContent = (
        <div className="bg-white rounded-lg border border-gray-200 p-6 cursor-help">
            <p className="text-3xl text-[#203622] mb-1">{value}</p>
            <p className="text-sm text-gray-600">{label}</p>
        </div>
    );

    if (!tooltip) {
        return cardContent;
    }

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                {cardContent}
            </TooltipTrigger>
            <TooltipContent className="bg-[#203622] text-white max-w-xs">
                {tooltip}
            </TooltipContent>
        </Tooltip>
    );
}

function ProgramCard({ program, showFacilities, onClick }: { program: ProgramsOverviewTable; showFacilities: boolean; onClick: () => void }) {
    const status = getEffectiveStatus(program);
    const types = parseCommaSeparated(program.program_types);
    const credits = parseCommaSeparated(program.credit_types);
    const funding = program.funding_type
        ? program.funding_type.replace(/_/g, ' ')
        : '';

    return (
        <Card
            className="group cursor-pointer hover:shadow-lg hover:border-[#556830] transition-all bg-white !p-0"
            onClick={onClick}
        >
            <CardContent className="pt-6">
                <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex-1">
                        <h3 className="text-[#203622] mb-1 group-hover:text-[#556830] transition-colors">
                            {program.program_name}
                        </h3>
                        {program.description && (
                            <p className="text-sm text-gray-600 line-clamp-2">
                                {program.description}
                            </p>
                        )}
                    </div>
                     <Badge variant="outline" className={`${statusColors[status]} ml-3 shrink-0`}>
                                    {status}
                    </Badge>
                </div>

                 {/* Category Badges */}
                 <div className="flex flex-wrap gap-2 mb-4">
                                {types.map((type) => (
                                    <Badge
                                        key={type}
                                        variant="outline"
                                        className={`${programTypeColors[type] || 'bg-gray-100 text-gray-700 border-gray-200'} text-xs`}
                                    >
                                        {formatDisplayName(type)}
                                    </Badge>
                                ))}
                            </div>

                <div className="grid grid-cols-2 gap-3  mb-4">
                    <MetricBox
                        label="Enrollment"
                        primaryValue={program.total_active_enrollments ?? 0}
                        primaryLabel="currently enrolled"
                        secondaryLines={[
                            {
                                value: `${program.total_enrollments ?? 0} total enrollment${(program.total_enrollments ?? 0) !== 1 ? 's' : ''}`
                            },
                            {
                                value: `${Math.round(program.completion_rate ?? 0)}% completion rate`
                            }
                        ]}
                    />
                    <MetricBox
                        label="Classes"
                        primaryValue={program.total_active_classes ?? 0}
                        primaryLabel="active"
                        secondaryLines={[
                            {
                                value: `${program.total_classes ?? 0} total class${(program.total_classes ?? 0) !== 1 ? 'es' : ''}`
                            }
                        ]}
                    />
                </div>
                {/* Credit & Funding Type */}
                <div className="text-xs text-gray-600 mb-3 space-y-1">
                    {credits.length > 0 && (
                        <div>
                            <span className="text-gray-500">
                                Credit:{' '}
                                {credits.map(formatDisplayName).join(', ')}
                            </span>
                        </div>
                    )}
                    {funding && (
                        <div>
                            <span className="text-gray-500">Funding: {funding}</span>
                        </div>
                    )}
                </div>
                {/* Department Admin: Facility Count */}
                {showFacilities &&
                    (program.total_active_facilities ?? 0) > 0 && (
                        <div className="pt-3 border-t border-gray-200">
                            <div className="text-sm text-gray-600">
                                Active in <span className="text-[#203622] font-medium">{program.total_active_facilities}</span> {program.total_active_facilities === 1 ? 'facility' : 'facilities'}
                            </div>
                        </div>
                    )}
            </CardContent>
        </Card>
    );
}

function MetricBox({ label, primaryValue, primaryLabel, secondaryLines }: { label: string; primaryValue: number; primaryLabel: string; secondaryLines?: { value: string | number }[] }) {
    return (
        <div className="bg-[#E2E7EA] rounded-lg p-3">
            <div className="text-xs text-gray-600 mb-2">{label}</div>
            <div className="space-y-1">
                <div className="flex items-baseline gap-1.5">
                    <span className="text-2xl text-[#203622]">{primaryValue}</span>
                    <span className="text-xs text-gray-500">{primaryLabel}</span>
                </div>
                {secondaryLines?.map((line, index) => (
                    <div key={index} className="text-xs text-gray-500">
                        {line.value}
                    </div>
                ))}
            </div>
        </div>
    );
}

function getHistoricalEnrollments(program: ProgramsOverviewTable): number {
    return (program.total_enrollments ?? 0) - (program.total_active_enrollments ?? 0);
}

function getUtilizationRate(program: ProgramsOverviewTable): number {
    const capacity = program.total_capacity ?? 0;
    const enrolled = program.total_active_enrollments ?? 0;
    return capacity > 0 ? Math.round((enrolled / capacity) * 100) : 0;
}

function getPercentageColorClass(percentage: number): string {
    if (percentage >= 75) return 'text-[#556830]';
    if (percentage >= 50) return 'text-[#F1B51C]';
    return 'text-red-600';
}

function ProgramsTable({ programs, onRowClick, onEditClick }: {
    programs: ProgramsOverviewTable[];
    onRowClick: (programId: number) => void;
    onEditClick: (program: ProgramsOverviewTable) => void;
}) {
    const navigate = useNavigate();
    const [deleteConfirmProgram, setDeleteConfirmProgram] = useState<ProgramsOverviewTable | null>(null);

    const handleDelete = async () => {
        if (!deleteConfirmProgram) return;

        try {
            const resp = await API.delete(`programs/${deleteConfirmProgram.program_id}`);
            if (resp.success) {
                toast.success('Program deleted successfully');
                // Note: mutate will be called by parent component via SWR revalidation
            } else {
                toast.error(resp.message || 'Failed to delete program');
            }
        } catch {
            toast.error('Failed to delete program');
        } finally {
            setDeleteConfirmProgram(null);
        }
    };

    return (
        <TooltipProvider>
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <Table>
                    <TableHeader className="bg-[#E2E7EA] border-b border-gray-200">
                        <TableRow>
                            <TableHead className="text-left px-6 py-4 text-sm text-[#203622] w-[30%]">Program</TableHead>
                            <TableHead className="text-left px-6 py-4 text-sm text-[#203622] w-[16%]">Classes</TableHead>
                            <TableHead className="text-left px-6 py-4 text-sm text-[#203622] w-[16%]">Enrollment</TableHead>
                            <TableHead className="text-left px-6 py-4 text-sm text-[#203622] w-[16%]">Capacity</TableHead>
                            <TableHead className="text-left px-6 py-4 text-sm text-[#203622] w-[8%]">Completion</TableHead>
                            <TableHead className="text-left px-6 py-4 text-sm text-[#203622] w-[8%]">Attendance</TableHead>
                            <TableHead className="text-right px-6 py-4 text-sm text-[#203622] w-[6%]">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody className="divide-y divide-gray-200">
                        {programs.map((program) => {
                            const status = getEffectiveStatus(program);
                            const types = parseCommaSeparated(program.program_types);
                            const utilizationRate = getUtilizationRate(program);
                            const historicalEnrollments = getHistoricalEnrollments(program);
                            const completionRate = Math.round(program.completion_rate ?? 0);
                            const attendanceRate = Math.round(program.attendance_rate ?? 0);

                            return (
                                <TableRow
                                    key={program.program_id}
                                    className={`hover:bg-[#E2E7EA]/50 transition-colors cursor-pointer ${
                                        status === ProgramEffectiveStatus.Archived ? 'opacity-40' :
                                        status === ProgramEffectiveStatus.Inactive ? 'opacity-60' : ''
                                    }`}
                                    onClick={() => onRowClick(program.program_id)}
                                >
                                    <TableCell className="px-6 py-4">
                                        <div>
                                            {(status === ProgramEffectiveStatus.Inactive || status === ProgramEffectiveStatus.Archived) && (
                                                <Badge variant="outline" className={`${statusColors[status]} text-xs mb-1.5`}>
                                                    {status}
                                                </Badge>
                                            )}
                                            <div className="text-[#203622] hover:text-[#556830] transition-colors font-medium mb-1.5">
                                                {program.program_name}
                                            </div>
                                        </div>
                                        <div className="flex flex-wrap gap-1.5 items-center">
                                            {types.slice(0, 3).map((type) => (
                                                <Badge
                                                    key={type}
                                                    variant="outline"
                                                    className={`${programTypeColors[type] || 'bg-gray-100 text-gray-700 border-gray-200'} text-xs`}
                                                >
                                                    {formatDisplayName(type)}
                                                </Badge>
                                            ))}
                                            {types.length > 3 && (
                                                <Badge variant="outline" className="text-xs bg-gray-100 text-gray-600 border-gray-200">
                                                    +{types.length - 3}
                                                </Badge>
                                            )}
                                            {(program.total_active_facilities ?? 0) > 0 && (
                                                <>
                                                    <span className="text-gray-300">•</span>
                                                    <button
                                                        className="text-xs text-[#556830] hover:underline font-medium"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            navigate(`/facilities?program=${program.program_id}`);
                                                        }}
                                                    >
                                                        {program.total_active_facilities} {program.total_active_facilities === 1 ? 'facility' : 'facilities'}
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell className="px-6 py-4">
                                        <div className="text-sm text-gray-700">
                                            <div>
                                                <span className="font-medium text-[#203622]">{program.total_active_classes ?? 0}</span>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <span className="text-gray-500 cursor-help"> active</span>
                                                    </TooltipTrigger>
                                                    <TooltipContent className="bg-[#203622] text-white max-w-xs">
                                                        Classes currently running with enrolled residents
                                                    </TooltipContent>
                                                </Tooltip>
                                            </div>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <div className="text-xs text-gray-500 mt-0.5 cursor-help w-fit">{program.total_classes ?? 0} total</div>
                                                </TooltipTrigger>
                                                <TooltipContent className="bg-[#203622] text-white max-w-xs">
                                                    All classes for this program (active, completed, and scheduled)
                                                </TooltipContent>
                                            </Tooltip>
                                        </div>
                                    </TableCell>
                                    <TableCell className="px-6 py-4">
                                        <div className="text-sm text-gray-700">
                                            <div>
                                                <span className="font-medium text-[#203622]">{program.total_active_enrollments ?? 0}</span>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <span className="text-gray-500 cursor-help"> currently</span>
                                                    </TooltipTrigger>
                                                    <TooltipContent className="bg-[#203622] text-white max-w-xs">
                                                        Residents currently enrolled in this program. A single resident can be enrolled in more than one class.
                                                    </TooltipContent>
                                                </Tooltip>
                                            </div>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <div className="text-xs text-gray-500 mt-0.5 cursor-help w-fit">{historicalEnrollments} all-time</div>
                                                </TooltipTrigger>
                                                <TooltipContent className="bg-[#203622] text-white max-w-xs">
                                                    Past enrollments including completed, withdrawn, and dropped
                                                </TooltipContent>
                                            </Tooltip>
                                        </div>
                                    </TableCell>
                                    <TableCell className="px-6 py-4">
                                        <div className="text-sm">
                                            <div className="font-medium text-[#203622]">{program.total_capacity ?? 0}</div>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <div className="text-xs text-gray-500 mt-0.5 cursor-help w-fit">{utilizationRate}% utilized</div>
                                                </TooltipTrigger>
                                                <TooltipContent className="bg-[#203622] text-white max-w-xs">
                                                    Percentage of available capacity currently filled
                                                </TooltipContent>
                                            </Tooltip>
                                        </div>
                                    </TableCell>
                                    <TableCell className="px-6 py-4">
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <div className={`text-sm font-medium cursor-help w-fit ${getPercentageColorClass(completionRate)}`}>
                                                    {completionRate}%
                                                </div>
                                            </TooltipTrigger>
                                            <TooltipContent className="bg-[#203622] text-white max-w-xs">
                                                Percentage of residents who successfully completed the program out of all who have finished (not including current enrollments)
                                            </TooltipContent>
                                        </Tooltip>
                                    </TableCell>
                                    <TableCell className="px-6 py-4">
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <div className={`text-sm font-medium cursor-help w-fit ${getPercentageColorClass(attendanceRate)}`}>
                                                    {attendanceRate}%
                                                </div>
                                            </TooltipTrigger>
                                            <TooltipContent className="bg-[#203622] text-white max-w-xs">
                                                Average attendance rate across all active classes in this program
                                            </TooltipContent>
                                        </Tooltip>
                                    </TableCell>
                                    <TableCell className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            navigate('/programs/' + program.program_id + '/statewide');
                                                        }}
                                                        className="p-1.5 hover:bg-gray-100 rounded transition-colors"
                                                    >
                                                        <Eye className="size-4 text-gray-600" />
                                                    </button>
                                                </TooltipTrigger>
                                                <TooltipContent>View program</TooltipContent>
                                            </Tooltip>

                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            onEditClick(program);
                                                        }}
                                                        className="p-1.5 hover:bg-gray-100 rounded transition-colors"
                                                    >
                                                        <Edit className="size-4 text-gray-600" />
                                                    </button>
                                                </TooltipTrigger>
                                                <TooltipContent>Edit program</TooltipContent>
                                            </Tooltip>

                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setDeleteConfirmProgram(program);
                                                        }}
                                                        disabled={program.total_active_classes > 0}
                                                        className={`p-1.5 rounded transition-colors ${
                                                            program.total_active_classes > 0
                                                                ? 'opacity-50 cursor-not-allowed'
                                                                : 'hover:bg-red-50'
                                                        }`}
                                                    >
                                                        <Trash2 className="size-4 text-gray-600" />
                                                    </button>
                                                </TooltipTrigger>
                                                {program.total_active_classes > 0 ? (
                                                    <TooltipContent>Cannot delete programs with active classes</TooltipContent>
                                                ) : (
                                                    <TooltipContent>Delete program</TooltipContent>
                                                )}
                                            </Tooltip>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </div>

            {/* Delete Confirmation Dialog */}
            <ConfirmDialog
                open={!!deleteConfirmProgram}
                onOpenChange={(open) => !open && setDeleteConfirmProgram(null)}
                title="Delete Program"
                description={`Are you sure you want to delete "${deleteConfirmProgram?.program_name}"? This action cannot be undone.`}
                confirmLabel="Delete"
                onConfirm={() => void handleDelete()}
                variant="destructive"
            />
        </TooltipProvider>
    );
}
