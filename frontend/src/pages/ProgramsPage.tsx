import { useState, useMemo, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useUrlPagination } from '@/hooks/useUrlPagination';
import { useCanvasLoadingPoll } from '@/hooks/useCanvasLoadingPoll';
import { useNavigate } from 'react-router-dom';
import useSWR from 'swr';
import { useAuth, canSwitchFacility } from '@/auth/useAuth';
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
import { Textarea } from '@/components/ui/textarea';
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage
} from '@/components/ui/form';
import { programCreateSchema, ProgramCreateInput } from '@/lib/validation';
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
import { Search, Plus, Filter, ChevronDown, Loader2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Pagination } from '@/components/Pagination';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@/components/ui/table';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
    TooltipProvider
} from '@/components/ui/tooltip';
import {
    programTypeColors,
    statusColors,
    type SortOption
} from '@/pages/program-detail/constants';
import { clickableProps } from '@/lib/a11y';

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
    const isDeptAdminUser = user ? canSwitchFacility(user) : false;

    const { data: resp, mutate } = useSWR<
        ServerResponseMany<ProgramsOverviewTable>
    >('/api/programs/detailed-list?include_archived=true&per_page=100');

    const programs = resp?.data ?? [];
    const hasLoadingCanvas = programs.some(
        (p) => p.source === 'canvas' && p.loading
    );
    const { exhausted: canvasPollExhausted } = useCanvasLoadingPoll(
        hasLoadingCanvas,
        mutate
    );

    // Fetch facilities for Department Admin
    const { data: facilitiesResp } = useSWR<ServerResponseMany<Facility>>(
        isDeptAdminUser ? '/api/facilities' : null
    );
    const facilities = facilitiesResp?.data ?? [];

    const [search, setSearch] = useState('');
    const [sort, setSort] = useState<SortOption>('name-asc');
    const [selectedTypes, setSelectedTypes] = useState<ProgramType[]>([]);
    const [selectedStatuses, setSelectedStatuses] = useState<
        ProgramEffectiveStatus[]
    >([]);

    const [showAddProgram, setShowAddProgram] = useState(false);
    const emptyProgramForm: ProgramCreateInput = {
        name: '',
        description: '',
        types: [],
        creditTypes: [],
        fundingTypes: [],
        status: ProgramEffectiveStatus.Available,
        facilities: []
    };
    const programForm = useForm<ProgramCreateInput>({
        resolver: zodResolver(programCreateSchema),
        defaultValues: emptyProgramForm
    });
    const {
        formState: { isSubmitting }
    } = programForm;

    const handleCreateProgram = async (data: ProgramCreateInput) => {
        try {
            const payload = {
                name: data.name,
                description: data.description,
                program_types: data.types.map(
                    (type): PgmType => ({ program_type: type })
                ),
                credit_types: data.creditTypes.map(
                    (type): ProgramCreditType => ({ credit_type: type })
                ),
                funding_type: data.fundingTypes[0],
                is_active: data.status === ProgramEffectiveStatus.Available,
                facilities: data.facilities
            };

            const resp = (await API.post<Program, typeof payload>(
                'programs',
                payload
            )) as ServerResponseOne<Program>;

            if (!resp.success) {
                toast.error('Failed to create program');
                return;
            }

            toast.success('Program created successfully');

            setShowAddProgram(false);
            programForm.reset(emptyProgramForm);

            void mutate();
        } catch {
            toast.error('Failed to create program');
        }
    };

    const { page, perPage, setPage, setPerPage } = useUrlPagination(1, 20);

    // Reset to page 1 only when a filter/sort/search value actually changes.
    // Comparing against the previous values (rather than a first-render ref) keeps
    // this correct under React StrictMode, which double-invokes effects on mount
    // and would otherwise defeat the ref guard and reset a deep-linked/refreshed
    // page back to 1.
    const prevFilters = useRef({
        search,
        sort,
        selectedTypes,
        selectedStatuses
    });
    useEffect(() => {
        const prev = prevFilters.current;
        if (
            prev.search !== search ||
            prev.sort !== sort ||
            prev.selectedTypes !== selectedTypes ||
            prev.selectedStatuses !== selectedStatuses
        ) {
            prevFilters.current = {
                search,
                sort,
                selectedTypes,
                selectedStatuses
            };
            setPage(1);
        }
    }, [search, sort, selectedTypes, selectedStatuses, setPage]);

    const toggleTypeFilter = (type: ProgramType) => {
        setSelectedTypes((prev) =>
            prev.includes(type)
                ? prev.filter((t) => t !== type)
                : [...prev, type]
        );
    };

    const toggleStatusFilter = (status: ProgramEffectiveStatus) => {
        setSelectedStatuses((prev) =>
            prev.includes(status)
                ? prev.filter((s) => s !== status)
                : [...prev, status]
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
        { value: ProgramType.RELIGIOUS, label: 'Faith-Based' }
    ];

    const creditTypes: { value: CreditType; label: string }[] = [
        { value: CreditType.COMPLETION, label: 'Completion' },
        { value: CreditType.EARNED_TIME, label: 'Earned Time' },
        { value: CreditType.EDUCATION, label: 'Education' },
        { value: CreditType.PARTICIPATION, label: 'Participation' }
    ];

    const fundingTypes: { value: FundingType; label: string }[] = [
        { value: FundingType.EDUCATIONAL_GRANTS, label: 'Educational Grants' },
        { value: FundingType.FEDERAL_GRANTS, label: 'Federal Grants' },
        { value: FundingType.INMATE_WELFARE, label: 'Inmate Welfare Funds' },
        {
            value: FundingType.NON_PROFIT_ORGANIZATION,
            label: 'Nonprofit Organizations'
        },
        { value: FundingType.STATE_GRANTS, label: 'State Grants' },
        { value: FundingType.OTHER, label: 'Other' }
    ];

    const filtered = useMemo(() => {
        const programs = resp?.data ?? [];
        let result = programs;

        if (search) {
            const q = search.toLowerCase();
            result = result.filter(
                (p) =>
                    p.program_name.toLowerCase().includes(q) ||
                    p.description?.toLowerCase().includes(q)
            );
        }

        if (selectedTypes.length > 0) {
            result = result.filter((p) => {
                const types = parseCommaSeparated(p.program_types);
                return types.some((type) =>
                    selectedTypes.includes(type as ProgramType)
                );
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

    const paginatedPrograms = filtered.slice(
        (page - 1) * perPage,
        page * perPage
    );

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
            (sum, p) =>
                sum +
                ((p.completion_rate ?? 0) *
                    (p.total_enrollments - (p.total_active_enrollments ?? 0))) /
                    100,
            0
        );
        const totalCompletedEnrollments = filtered.reduce(
            (sum, p) =>
                sum + (p.total_enrollments - (p.total_active_enrollments ?? 0)),
            0
        );
        const completionRate =
            totalCompletedEnrollments > 0
                ? Math.round(
                      (completedEnrollmentsSum / totalCompletedEnrollments) *
                          100
                  )
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
        <div className="min-h-[calc(100vh-4rem)] bg-surface-hover dark:bg-[#0a0a0a]">
            <div className="max-w-7xl mx-auto px-6 pt-[34px] pb-8">
                {/* Header */}
                <div className="mb-8">
                    <div className="flex items-center justify-between mb-2">
                        <div>
                            <h1 className="text-2xl font-medium text-brand-dark">
                                Programs
                            </h1>
                            <p className="text-gray-600 mt-1.5 leading-[1.5]">
                                {subtitle}
                            </p>
                        </div>
                        <Button
                            className="bg-brand-gold text-brand-dark hover:bg-brand-gold-dark gap-2 cursor-default"
                            onClick={() => setShowAddProgram(!showAddProgram)}
                        >
                            <Plus className="size-5" />
                            {showAddProgram
                                ? 'Cancel'
                                : isDeptAdminUser
                                  ? 'Create Statewide Program'
                                  : 'Add Program'}
                        </Button>
                    </div>
                </div>

                {/* Stats Overview */}
                <TooltipProvider>
                    <div className="grid grid-cols-4 gap-6 mb-8">
                        <StatCard
                            label="Active Programs"
                            value={stats.activePrograms}
                            tooltip={
                                isDeptAdminUser
                                    ? 'The count of unique programs offered across all facilities'
                                    : 'The count of unique programs offered at this facility'
                            }
                        />
                        <StatCard
                            label="Total Classes"
                            value={stats.totalClasses}
                            tooltip={
                                isDeptAdminUser
                                    ? 'All classes across all facilities (active, completed, and scheduled)'
                                    : 'All classes at this facility (active, completed, and scheduled)'
                            }
                        />
                        <StatCard
                            label="Total Enrolled"
                            value={stats.totalEnrollment}
                            tooltip={
                                isDeptAdminUser
                                    ? 'The total number of enrollments across all facilities. A single resident can be enrolled in more than one program.'
                                    : 'The total number of enrollments at this facility. A single resident can be enrolled in more than one program.'
                            }
                        />
                        <StatCard
                            label="Completion Rate"
                            value={`${stats.completionRate}%`}
                            tooltip={
                                isDeptAdminUser
                                    ? 'The percentage of residents who have completed a class across all facilities'
                                    : 'The percentage of residents who have completed a class at this facility'
                            }
                        />
                    </div>
                </TooltipProvider>

                {/* Filters */}
                <div className="card-block p-4 mb-6">
                    <div className="flex gap-4">
                        <div className="relative flex-1">
                            <Search className="input-icon-left size-5" />
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
                            <SelectTrigger className="w-55 focus-visible:border-gray-400 focus-visible:ring-gray-400/50 dark:!bg-[rgba(38,38,38,0.3)] cursor-default">
                                <SelectValue placeholder="Sort By" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="name-asc">
                                    Name (A-Z)
                                </SelectItem>
                                <SelectItem value="name-desc">
                                    Name (Z-A)
                                </SelectItem>
                                <SelectItem value="enrollment-asc">
                                    Enrollment (Low-High)
                                </SelectItem>
                                <SelectItem value="enrollment-desc">
                                    Enrollment (High-Low)
                                </SelectItem>
                                <SelectItem value="completion-asc">
                                    Completion (Low-High)
                                </SelectItem>
                                <SelectItem value="completion-desc">
                                    Completion (High-Low)
                                </SelectItem>
                            </SelectContent>
                        </Select>
                        {/* Program Type Filter */}
                        <Popover>
                            <PopoverTrigger asChild>
                                <button className="filter-button">
                                    <div className="flex items-center gap-2">
                                        <Filter className="size-4" />
                                        <span>
                                            Type{' '}
                                            {selectedTypes.length > 0 &&
                                                `(${selectedTypes.length})`}
                                        </span>
                                    </div>
                                    <ChevronDown className="size-4" />
                                </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-60 p-4">
                                <div className="mb-3 font-medium text-sm">
                                    Filter by Program Type
                                </div>
                                <div className="space-y-3">
                                    {Object.values(ProgramType).map((type) => (
                                        <label
                                            key={type}
                                            className="flex items-center gap-2 cursor-pointer"
                                        >
                                            <Checkbox
                                                checked={selectedTypes.includes(
                                                    type
                                                )}
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
                        {/* Status Filter */}
                        <Popover>
                            <PopoverTrigger asChild>
                                <button className="filter-button">
                                    <div className="flex items-center gap-2">
                                        <Filter className="size-4" />
                                        <span>
                                            Status{' '}
                                            {selectedStatuses.length > 0 &&
                                                `(${selectedStatuses.length})`}
                                        </span>
                                    </div>
                                    <ChevronDown className="size-4" />
                                </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-60 p-4">
                                <div className="mb-3 font-medium text-sm">
                                    Filter by Status
                                </div>
                                <div className="space-y-3 mb-4">
                                    {Object.values(ProgramEffectiveStatus).map(
                                        (status) => (
                                            <label
                                                key={status}
                                                className="flex items-center gap-2 cursor-pointer"
                                            >
                                                <Checkbox
                                                    checked={selectedStatuses.includes(
                                                        status
                                                    )}
                                                    onCheckedChange={() =>
                                                        toggleStatusFilter(
                                                            status
                                                        )
                                                    }
                                                />
                                                <span className="text-sm">
                                                    {status}
                                                </span>
                                            </label>
                                        )
                                    )}
                                </div>
                                {selectedTypes.length > 0 ||
                                selectedStatuses.length > 0 ? (
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
                    <div className="card-block p-6 mb-6">
                        <h3 className="text-brand-dark mb-4">
                            {isDeptAdminUser
                                ? 'Create Statewide Program'
                                : 'Add New Program'}
                        </h3>
                        <Form {...programForm}>
                            <form
                                onSubmit={(e) => {
                                    e.preventDefault();
                                    void programForm.handleSubmit(
                                        handleCreateProgram
                                    )(e);
                                }}
                                className="space-y-6"
                            >
                                {/* Basic Information */}
                                <div>
                                    <h4 className="text-sm text-gray-700 mb-3">
                                        Basic Information
                                    </h4>
                                    <div className="grid grid-cols-2 gap-4">
                                        <FormField
                                            control={programForm.control}
                                            name="name"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel
                                                        htmlFor="programName"
                                                        className="text-black"
                                                    >
                                                        Program Name *
                                                    </FormLabel>
                                                    <FormControl>
                                                        <Input
                                                            id="programName"
                                                            placeholder="e.g., GED Preparation"
                                                            className="focus-visible:border-gray-400 focus-visible:ring-gray-400/50 dark:!bg-[rgba(38,38,38,0.3)]"
                                                            {...field}
                                                        />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={programForm.control}
                                            name="description"
                                            render={({ field }) => (
                                                <FormItem className="col-span-2">
                                                    <FormLabel
                                                        htmlFor="programDescription"
                                                        className="text-black"
                                                    >
                                                        Description
                                                    </FormLabel>
                                                    <FormControl>
                                                        <Textarea
                                                            id="programDescription"
                                                            placeholder="Brief description of the program and its goals"
                                                            rows={2}
                                                            className="min-h-0 focus-visible:border-gray-400 focus-visible:ring-gray-400/50 dark:!bg-[rgba(38,38,38,0.3)]"
                                                            {...field}
                                                        />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>
                                </div>

                                {/* Categorization */}
                                <div className="pt-4 border-t border-gray-200">
                                    <h4 className="text-sm text-gray-700 mb-3">
                                        Categorization
                                    </h4>
                                    <div className="grid grid-cols-2 gap-4">
                                        <FormField
                                            control={programForm.control}
                                            name="types"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="text-black">
                                                        Category (Program Types)
                                                        *
                                                    </FormLabel>
                                                    <div className="mt-2 space-y-2">
                                                        {programTypes.map(
                                                            (type) => (
                                                                <label
                                                                    key={
                                                                        type.value
                                                                    }
                                                                    className="flex items-center gap-2 cursor-pointer"
                                                                >
                                                                    <span className="inline-flex rounded-[1px] focus-within:ring-2 focus-within:ring-gray-300/80 focus-within:ring-offset-1 focus-within:ring-offset-white">
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={field.value.includes(
                                                                                type.value
                                                                            )}
                                                                            onChange={(
                                                                                e
                                                                            ) =>
                                                                                field.onChange(
                                                                                    e
                                                                                        .target
                                                                                        .checked
                                                                                        ? [
                                                                                              ...field.value,
                                                                                              type.value
                                                                                          ]
                                                                                        : field.value.filter(
                                                                                              (
                                                                                                  t
                                                                                              ) =>
                                                                                                  t !==
                                                                                                  type.value
                                                                                          )
                                                                                )
                                                                            }
                                                                            className="checkbox-brand"
                                                                        />
                                                                    </span>
                                                                    <span className="text-sm text-gray-700">
                                                                        {
                                                                            type.label
                                                                        }
                                                                    </span>
                                                                </label>
                                                            )
                                                        )}
                                                    </div>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />

                                        <FormField
                                            control={programForm.control}
                                            name="creditTypes"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="text-black">
                                                        Credit Types *
                                                    </FormLabel>
                                                    <div className="mt-2 space-y-2">
                                                        {creditTypes.map(
                                                            (type) => (
                                                                <label
                                                                    key={
                                                                        type.value
                                                                    }
                                                                    className="flex items-center gap-2 cursor-pointer"
                                                                >
                                                                    <span className="inline-flex rounded-[1px] focus-within:ring-2 focus-within:ring-gray-300/80 focus-within:ring-offset-1 focus-within:ring-offset-white">
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={field.value.includes(
                                                                                type.value
                                                                            )}
                                                                            onChange={(
                                                                                e
                                                                            ) =>
                                                                                field.onChange(
                                                                                    e
                                                                                        .target
                                                                                        .checked
                                                                                        ? [
                                                                                              ...field.value,
                                                                                              type.value
                                                                                          ]
                                                                                        : field.value.filter(
                                                                                              (
                                                                                                  t
                                                                                              ) =>
                                                                                                  t !==
                                                                                                  type.value
                                                                                          )
                                                                                )
                                                                            }
                                                                            className="checkbox-brand"
                                                                        />
                                                                    </span>
                                                                    <span className="text-sm text-gray-700">
                                                                        {
                                                                            type.label
                                                                        }
                                                                    </span>
                                                                </label>
                                                            )
                                                        )}
                                                    </div>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />

                                        <FormField
                                            control={programForm.control}
                                            name="fundingTypes"
                                            render={({ field }) => (
                                                <FormItem className="col-span-2">
                                                    <FormLabel
                                                        htmlFor="fundingType"
                                                        className="text-black"
                                                    >
                                                        Funding Type *
                                                    </FormLabel>
                                                    <Select
                                                        value={
                                                            field.value[0] ?? ''
                                                        }
                                                        onValueChange={(
                                                            value
                                                        ) =>
                                                            field.onChange([
                                                                value as FundingType
                                                            ])
                                                        }
                                                    >
                                                        <FormControl>
                                                            <SelectTrigger
                                                                id="fundingType"
                                                                className="focus-visible:border-gray-400 focus-visible:ring-gray-400/50 dark:!bg-[rgba(38,38,38,0.3)]"
                                                            >
                                                                <SelectValue placeholder="Select funding type" />
                                                            </SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent>
                                                            {fundingTypes.map(
                                                                (type) => (
                                                                    <SelectItem
                                                                        key={
                                                                            type.value
                                                                        }
                                                                        value={
                                                                            type.value
                                                                        }
                                                                    >
                                                                        {
                                                                            type.label
                                                                        }
                                                                    </SelectItem>
                                                                )
                                                            )}
                                                        </SelectContent>
                                                    </Select>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />

                                        <FormField
                                            control={programForm.control}
                                            name="status"
                                            render={({ field }) => (
                                                <FormItem className="col-span-2">
                                                    <FormLabel
                                                        htmlFor="programStatus"
                                                        className="text-black"
                                                    >
                                                        Program Availability *
                                                    </FormLabel>
                                                    <Select
                                                        value={field.value}
                                                        onValueChange={
                                                            field.onChange
                                                        }
                                                    >
                                                        <FormControl>
                                                            <SelectTrigger
                                                                id="programStatus"
                                                                className="focus-visible:border-gray-400 focus-visible:ring-gray-400/50 dark:!bg-[rgba(38,38,38,0.3)]"
                                                            >
                                                                <SelectValue placeholder="Select program status" />
                                                            </SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent>
                                                            <SelectItem
                                                                value={
                                                                    ProgramEffectiveStatus.Available
                                                                }
                                                            >
                                                                Available
                                                            </SelectItem>
                                                            <SelectItem
                                                                value={
                                                                    ProgramEffectiveStatus.Inactive
                                                                }
                                                            >
                                                                Inactive
                                                            </SelectItem>
                                                            <SelectItem
                                                                value={
                                                                    ProgramEffectiveStatus.Archived
                                                                }
                                                            >
                                                                Archived
                                                            </SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                    <p className="text-xs text-gray-500 mt-1">
                                                        Available programs can
                                                        accept new class
                                                        enrollments. Inactive
                                                        programs are temporarily
                                                        paused. Archived
                                                        programs are no longer
                                                        offered.
                                                    </p>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />

                                        {/* Facilities Selection - Only for Department Admin */}
                                        {isDeptAdminUser && (
                                            <FormField
                                                control={programForm.control}
                                                name="facilities"
                                                render={({ field }) => (
                                                    <FormItem className="col-span-2">
                                                        <FormLabel className="text-black">
                                                            Facilities Offered *
                                                        </FormLabel>
                                                        <div className="mt-2 max-h-60 overflow-y-auto space-y-2 p-3">
                                                            {facilities.length ===
                                                            0 ? (
                                                                <p className="text-sm text-gray-500">
                                                                    Loading
                                                                    facilities...
                                                                </p>
                                                            ) : (
                                                                facilities.map(
                                                                    (
                                                                        facility
                                                                    ) => (
                                                                        <label
                                                                            key={
                                                                                facility.id
                                                                            }
                                                                            className="flex items-center gap-2 cursor-pointer"
                                                                        >
                                                                            <span className="inline-flex rounded-[1px] focus-within:ring-2 focus-within:ring-gray-300/80 focus-within:ring-offset-1 focus-within:ring-offset-white">
                                                                                <input
                                                                                    type="checkbox"
                                                                                    checked={field.value.includes(
                                                                                        facility.id
                                                                                    )}
                                                                                    onChange={(
                                                                                        e
                                                                                    ) =>
                                                                                        field.onChange(
                                                                                            e
                                                                                                .target
                                                                                                .checked
                                                                                                ? [
                                                                                                      ...field.value,
                                                                                                      facility.id
                                                                                                  ]
                                                                                                : field.value.filter(
                                                                                                      (
                                                                                                          f
                                                                                                      ) =>
                                                                                                          f !==
                                                                                                          facility.id
                                                                                                  )
                                                                                        )
                                                                                    }
                                                                                    className="checkbox-brand"
                                                                                />
                                                                            </span>
                                                                            <span className="text-sm text-gray-700">
                                                                                {
                                                                                    facility.name
                                                                                }
                                                                            </span>
                                                                        </label>
                                                                    )
                                                                )
                                                            )}
                                                        </div>
                                                        <p className="text-xs text-gray-500 mt-1">
                                                            Select which
                                                            facilities will
                                                            offer this program.
                                                            You can add more
                                                            facilities later.
                                                        </p>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        )}
                                    </div>
                                </div>

                                <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => {
                                            setShowAddProgram(false);
                                            programForm.reset(emptyProgramForm);
                                        }}
                                        className="border-gray-300 dark:!bg-[rgba(38,38,38,0.3)]"
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        type="submit"
                                        className="bg-brand hover:bg-brand-dark text-white"
                                        disabled={isSubmitting}
                                    >
                                        {isSubmitting
                                            ? 'Creating...'
                                            : 'Create Program'}
                                    </Button>
                                </div>
                            </form>
                        </Form>
                    </div>
                )}

                {filtered.length === 0 ? (
                    <div className="card-block p-12 text-center">
                        <p className="text-gray-600 mb-2">No programs found</p>
                        <p className="text-sm text-gray-500">
                            Try adjusting your search or filters
                        </p>
                    </div>
                ) : (
                    <>
                        {isDeptAdminUser ? (
                            <ProgramsTable
                                programs={paginatedPrograms}
                                pollExhausted={canvasPollExhausted}
                                onRowClick={(programId) =>
                                    navigate('/programs/' + programId)
                                }
                            />
                        ) : (
                            <div className="grid grid-cols-2 gap-6 mb-4">
                                {paginatedPrograms.map((program) => (
                                    <ProgramCard
                                        key={program.program_id}
                                        program={program}
                                        showFacilities={false}
                                        pollExhausted={canvasPollExhausted}
                                        onClick={() =>
                                            navigate(
                                                '/programs/' +
                                                    program.program_id
                                            )
                                        }
                                    />
                                ))}
                            </div>
                        )}

                        {/* Pagination */}
                        {filtered.length > 0 && (
                            <div className="mt-6">
                                <Pagination
                                    currentPage={page}
                                    totalItems={filtered.length}
                                    itemsPerPage={perPage}
                                    onPageChange={setPage}
                                    onItemsPerPageChange={setPerPage}
                                    itemLabel="items"
                                />
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

function StatCard({
    label,
    value,
    tooltip
}: {
    label: string;
    value: string | number;
    tooltip?: string;
}) {
    const cardContent = (
        <div className="card-block p-6 cursor-help">
            <p className="text-3xl text-brand-dark mb-1">{value}</p>
            <p className="text-sm text-gray-600">{label}</p>
        </div>
    );

    if (!tooltip) {
        return cardContent;
    }

    return (
        <Tooltip>
            <TooltipTrigger asChild>{cardContent}</TooltipTrigger>
            <TooltipContent className="bg-brand-dark text-white max-w-xs">
                {tooltip}
            </TooltipContent>
        </Tooltip>
    );
}

function ProgramCardSkeleton({ exhausted }: { exhausted: boolean }) {
    return (
        <Card className="bg-white !p-0">
            <CardContent className="pt-6">
                <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex-1 space-y-2">
                        <Skeleton className="h-5 w-3/4" />
                        <Skeleton className="h-4 w-1/3" />
                        <Skeleton className="h-4 w-full" />
                    </div>
                    <Skeleton className="h-6 w-16 rounded-full" />
                </div>
                <div className="flex gap-2 mb-4">
                    <Skeleton className="h-5 w-16 rounded-full" />
                    <Skeleton className="h-5 w-20 rounded-full" />
                </div>
                <div className="grid grid-cols-2 gap-3 mb-4">
                    <Skeleton className="h-16 rounded-md" />
                    <Skeleton className="h-16 rounded-md" />
                </div>
                <div className="flex items-center gap-2 mt-2">
                    {exhausted ? (
                        <span className="text-xs text-amber-600">
                            Taking longer than expected —{' '}
                            <button
                                className="underline"
                                onClick={() => window.location.reload()}
                            >
                                refresh to retry
                            </button>
                        </span>
                    ) : (
                        <>
                            <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
                            <span className="text-xs text-blue-600">
                                Syncing from Canvas…
                            </span>
                        </>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}

function ProgramCard({
    program,
    showFacilities,
    onClick,
    pollExhausted
}: {
    program: ProgramsOverviewTable;
    showFacilities: boolean;
    onClick: () => void;
    pollExhausted?: boolean;
}) {
    if (program.source === 'canvas' && program.loading) {
        return <ProgramCardSkeleton exhausted={!!pollExhausted} />;
    }
    const status = getEffectiveStatus(program);
    const types = parseCommaSeparated(program.program_types);
    const credits = parseCommaSeparated(program.credit_types);
    const funding = program.funding_type
        ? program.funding_type.replace(/_/g, ' ')
        : '';

    return (
        <Card
            className="group cursor-pointer hover:shadow-lg hover:border-brand transition-all bg-white !p-0"
            onClick={onClick}
        >
            <CardContent className="pt-6">
                <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex-1">
                        <h3 className="text-brand-dark mb-1 group-hover:text-brand transition-colors">
                            {program.program_name}
                        </h3>
                        {program.source === 'canvas' && (
                            <Badge
                                variant="outline"
                                className="text-xs bg-blue-50 text-blue-700 border-blue-200 mb-1 inline-flex"
                            >
                                Synced from Canvas
                            </Badge>
                        )}
                        {program.description && (
                            <p className="text-sm text-gray-600 line-clamp-2">
                                {program.description}
                            </p>
                        )}
                    </div>
                    <Badge
                        variant="outline"
                        className={`${statusColors[status]} ml-3 shrink-0`}
                    >
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
                            <span className="text-gray-500">
                                Funding: {funding}
                            </span>
                        </div>
                    )}
                </div>
                {/* Department Admin: Facility Count */}
                {showFacilities &&
                    (program.total_active_facilities ?? 0) > 0 && (
                        <div className="pt-3 border-t border-gray-200">
                            <div className="text-sm text-gray-600">
                                Active in{' '}
                                <span className="text-brand-dark font-medium">
                                    {program.total_active_facilities}
                                </span>{' '}
                                {program.total_active_facilities === 1
                                    ? 'facility'
                                    : 'facilities'}
                            </div>
                        </div>
                    )}
            </CardContent>
        </Card>
    );
}

function MetricBox({
    label,
    primaryValue,
    primaryLabel,
    secondaryLines
}: {
    label: string;
    primaryValue: number;
    primaryLabel: string;
    secondaryLines?: { value: string | number }[];
}) {
    return (
        <div className="bg-surface-hover rounded-lg p-3">
            <div className="text-xs text-gray-600 mb-2">{label}</div>
            <div className="space-y-1">
                <div className="flex items-baseline gap-1.5">
                    <span className="text-2xl text-brand-dark">
                        {primaryValue}
                    </span>
                    <span className="text-xs text-gray-500">
                        {primaryLabel}
                    </span>
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
    return (
        (program.total_enrollments ?? 0) -
        (program.total_active_enrollments ?? 0)
    );
}

function getUtilizationRate(program: ProgramsOverviewTable): number {
    const capacity = program.total_capacity ?? 0;
    const enrolled = program.total_active_enrollments ?? 0;
    return capacity > 0 ? Math.round((enrolled / capacity) * 100) : 0;
}

function getPercentageColorClass(percentage: number): string {
    if (percentage >= 75) return 'text-brand';
    if (percentage >= 50) return 'text-brand-gold';
    return 'text-red-600';
}

function ProgramsTable({
    programs,
    onRowClick,
    pollExhausted
}: {
    programs: ProgramsOverviewTable[];
    onRowClick: (programId: number) => void;
    pollExhausted?: boolean;
}) {
    const navigate = useNavigate();
    const nameRefs = useRef<Map<number, HTMLDivElement>>(new Map());
    const [truncatedIds, setTruncatedIds] = useState<Set<number>>(new Set());

    useEffect(() => {
        const recompute = () =>
            setTruncatedIds((prev) => {
                const next = new Set<number>();
                nameRefs.current.forEach((el, id) => {
                    if (el.scrollWidth > el.clientWidth) next.add(id);
                });
                if (
                    next.size === prev.size &&
                    [...next].every((id) => prev.has(id))
                ) {
                    return prev;
                }
                return next;
            });
        recompute();
        const observer = new ResizeObserver(recompute);
        nameRefs.current.forEach((el) => observer.observe(el));
        return () => observer.disconnect();
    }, [programs]);

    return (
        <TooltipProvider>
            <div className="card-block overflow-hidden">
                <Table>
                    <TableHeader className="bg-surface-hover [&_tr]:border-b-0">
                        <TableRow>
                            <TableHead className="text-left px-6 py-4 text-sm font-bold text-brand-dark w-[30%]">
                                Program
                            </TableHead>
                            <TableHead className="text-left px-6 py-4 text-sm font-bold text-brand-dark w-[16%]">
                                Classes
                            </TableHead>
                            <TableHead className="text-left px-6 py-4 text-sm font-bold text-brand-dark w-[16%]">
                                Enrollment
                            </TableHead>
                            <TableHead className="text-left px-6 py-4 text-sm font-bold text-brand-dark w-[16%]">
                                Capacity
                            </TableHead>
                            <TableHead className="text-left px-6 py-4 text-sm font-bold text-brand-dark w-[8%]">
                                Completion
                            </TableHead>
                            <TableHead className="text-left px-6 py-4 text-sm font-bold text-brand-dark w-[8%]">
                                Attendance
                            </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {programs.map((program) => {
                            if (
                                program.source === 'canvas' &&
                                program.loading
                            ) {
                                return (
                                    <TableRow key={program.program_id}>
                                        <TableCell className="px-6 py-4">
                                            <div className="space-y-1.5">
                                                <Skeleton className="h-4 w-48" />
                                                {pollExhausted ? (
                                                    <span className="text-xs text-amber-600">
                                                        Taking longer than
                                                        expected —{' '}
                                                        <button
                                                            className="underline"
                                                            onClick={() =>
                                                                window.location.reload()
                                                            }
                                                        >
                                                            refresh to retry
                                                        </button>
                                                    </span>
                                                ) : (
                                                    <div className="flex items-center gap-1.5">
                                                        <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
                                                        <span className="text-xs text-blue-600">
                                                            Syncing from Canvas…
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        </TableCell>
                                        {Array.from({ length: 5 }).map(
                                            (_, i) => (
                                                <TableCell
                                                    key={i}
                                                    className="px-6 py-4"
                                                >
                                                    <Skeleton className="h-4 w-12" />
                                                </TableCell>
                                            )
                                        )}
                                    </TableRow>
                                );
                            }
                            const status = getEffectiveStatus(program);
                            const types = parseCommaSeparated(
                                program.program_types
                            );
                            const utilizationRate = getUtilizationRate(program);
                            const historicalEnrollments =
                                getHistoricalEnrollments(program);
                            const completionRate = Math.round(
                                program.completion_rate ?? 0
                            );
                            const attendanceRate = Math.round(
                                program.attendance_rate ?? 0
                            );

                            return (
                                <TableRow
                                    key={program.program_id}
                                    className={`hover:bg-surface-hover/50 transition-colors cursor-pointer ${
                                        status ===
                                        ProgramEffectiveStatus.Archived
                                            ? 'opacity-40'
                                            : status ===
                                                ProgramEffectiveStatus.Inactive
                                              ? 'opacity-60'
                                              : ''
                                    }`}
                                    {...clickableProps(() =>
                                        onRowClick(program.program_id)
                                    )}
                                >
                                    <TableCell className="px-6 py-4 max-w-0">
                                        <div>
                                            {(status ===
                                                ProgramEffectiveStatus.Inactive ||
                                                status ===
                                                    ProgramEffectiveStatus.Archived) && (
                                                <Badge
                                                    variant="outline"
                                                    className={`${statusColors[status]} text-xs mb-1.5`}
                                                >
                                                    {status}
                                                </Badge>
                                            )}
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <div
                                                        ref={(el) => {
                                                            if (el) {
                                                                nameRefs.current.set(
                                                                    program.program_id,
                                                                    el
                                                                );
                                                            } else {
                                                                nameRefs.current.delete(
                                                                    program.program_id
                                                                );
                                                            }
                                                        }}
                                                        className="text-base text-brand-dark hover:text-brand transition-colors font-medium mb-1.5 truncate"
                                                    >
                                                        {program.program_name}
                                                    </div>
                                                </TooltipTrigger>
                                                {truncatedIds.has(
                                                    program.program_id
                                                ) && (
                                                    <TooltipContent className="bg-brand-dark text-white max-w-xs">
                                                        {program.program_name}
                                                    </TooltipContent>
                                                )}
                                            </Tooltip>
                                            {program.source === 'canvas' && (
                                                <Badge
                                                    variant="outline"
                                                    className="text-xs bg-blue-50 text-blue-700 border-blue-200 mb-1"
                                                >
                                                    Synced from Canvas
                                                </Badge>
                                            )}
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
                                                <Badge
                                                    variant="outline"
                                                    className="text-xs bg-gray-100 text-gray-600 border-gray-200"
                                                >
                                                    +{types.length - 3}
                                                </Badge>
                                            )}
                                            {(program.total_active_facilities ??
                                                0) > 0 && (
                                                <>
                                                    <span className="text-gray-300">
                                                        •
                                                    </span>
                                                    <button
                                                        className="text-xs text-gray-500 hover:text-gray-500 no-underline"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            navigate(
                                                                `/facilities?program=${program.program_id}`
                                                            );
                                                        }}
                                                    >
                                                        {
                                                            program.total_active_facilities
                                                        }{' '}
                                                        {program.total_active_facilities ===
                                                        1
                                                            ? 'facility'
                                                            : 'facilities'}
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell className="px-6 py-4">
                                        <div className="text-sm text-gray-700">
                                            <div>
                                                <span className="font-medium text-brand-dark">
                                                    {program.total_active_classes ??
                                                        0}
                                                </span>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <span className="text-gray-500 cursor-help">
                                                            {' '}
                                                            active
                                                        </span>
                                                    </TooltipTrigger>
                                                    <TooltipContent className="bg-brand-dark text-white max-w-xs">
                                                        Classes currently
                                                        running with enrolled
                                                        residents
                                                    </TooltipContent>
                                                </Tooltip>
                                            </div>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <div className="text-xs text-gray-500 mt-0.5 cursor-help w-fit">
                                                        {program.total_classes ??
                                                            0}{' '}
                                                        total
                                                    </div>
                                                </TooltipTrigger>
                                                <TooltipContent className="bg-brand-dark text-white max-w-xs">
                                                    All classes for this program
                                                    (active, completed, and
                                                    scheduled)
                                                </TooltipContent>
                                            </Tooltip>
                                        </div>
                                    </TableCell>
                                    <TableCell className="px-6 py-4">
                                        <div className="text-sm text-gray-700">
                                            <div>
                                                <span className="font-medium text-brand-dark">
                                                    {program.total_active_enrollments ??
                                                        0}
                                                </span>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <span className="text-gray-500 cursor-help">
                                                            {' '}
                                                            currently
                                                        </span>
                                                    </TooltipTrigger>
                                                    <TooltipContent className="bg-brand-dark text-white max-w-xs">
                                                        Residents currently
                                                        enrolled in this
                                                        program. A single
                                                        resident can be enrolled
                                                        in more than one class.
                                                    </TooltipContent>
                                                </Tooltip>
                                            </div>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <div className="text-xs text-gray-500 mt-0.5 cursor-help w-fit">
                                                        {historicalEnrollments}{' '}
                                                        all-time
                                                    </div>
                                                </TooltipTrigger>
                                                <TooltipContent className="bg-brand-dark text-white max-w-xs">
                                                    Past enrollments including
                                                    completed, withdrawn,
                                                    dropped, failed to complete,
                                                    and transfered
                                                </TooltipContent>
                                            </Tooltip>
                                        </div>
                                    </TableCell>
                                    <TableCell className="px-6 py-4">
                                        {program.source === 'canvas' ? (
                                            <div className="text-sm text-gray-400">
                                                —
                                            </div>
                                        ) : (
                                            <div className="text-sm">
                                                <div className="font-medium text-brand-dark">
                                                    {program.total_capacity ??
                                                        0}
                                                </div>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <div className="text-xs text-gray-500 mt-0.5 cursor-help w-fit">
                                                            {utilizationRate}%
                                                            utilized
                                                        </div>
                                                    </TooltipTrigger>
                                                    <TooltipContent className="bg-brand-dark text-white max-w-xs">
                                                        Percentage of available
                                                        capacity currently
                                                        filled
                                                    </TooltipContent>
                                                </Tooltip>
                                            </div>
                                        )}
                                    </TableCell>
                                    <TableCell className="px-6 py-4">
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <div
                                                    className={`text-sm font-medium cursor-help w-fit ${getPercentageColorClass(completionRate)}`}
                                                >
                                                    {completionRate}%
                                                </div>
                                            </TooltipTrigger>
                                            <TooltipContent className="bg-brand-dark text-white max-w-xs">
                                                Percentage of residents who
                                                successfully completed the
                                                program out of all who have
                                                finished (not including current
                                                enrollments)
                                            </TooltipContent>
                                        </Tooltip>
                                    </TableCell>
                                    <TableCell className="px-6 py-4">
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <div
                                                    className={`text-sm font-medium cursor-help w-fit ${getPercentageColorClass(attendanceRate)}`}
                                                >
                                                    {attendanceRate}%
                                                </div>
                                            </TooltipTrigger>
                                            <TooltipContent className="bg-brand-dark text-white max-w-xs">
                                                Average attendance rate across
                                                all active classes in this
                                                program
                                            </TooltipContent>
                                        </Tooltip>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </div>
        </TooltipProvider>
    );
}
