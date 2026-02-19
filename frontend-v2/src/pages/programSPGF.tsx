import { useState } from 'react';
import { Search, Plus, Filter, ChevronDown } from 'lucide-react';
import useSWR from 'swr';
import { useAuth, isDeptAdmin } from '@/auth/useAuth';
import {
    ProgramsOverviewTable,
    ProgramType,
    ProgramEffectiveStatus,
    ServerResponseMany,
    CreditType,
    FundingType,
} from '@/types';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../components/ui/popover';
import { Checkbox } from '../components/ui/checkbox';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Pagination } from '@/components/Pagination';

interface ProgramsPageProps {
  onNavigate: (page: any) => void;
}

const programTypeColors: Record<string, string> = {
  Educational: 'bg-blue-100 text-blue-700 border-blue-200',
  Vocational: 'bg-orange-100 text-orange-700 border-orange-200',
  Mental_Health_Behavioral: 'bg-pink-100 text-pink-700 border-pink-200',
  Therapeutic: 'bg-purple-100 text-purple-700 border-purple-200',
  Life_Skills: 'bg-green-100 text-green-700 border-green-200',
  'Re-Entry': 'bg-indigo-100 text-indigo-700 border-indigo-200',
  'Religious_Faith-Based': 'bg-amber-100 text-amber-700 border-amber-200',
};

const statusColors: Record<ProgramEffectiveStatus, string> = {
  [ProgramEffectiveStatus.Available]: 'bg-green-100 text-green-700 border-green-300',
  [ProgramEffectiveStatus.Inactive]: 'bg-gray-100 text-gray-700 border-gray-300',
  [ProgramEffectiveStatus.Archived]: 'bg-red-100 text-red-700 border-red-300',
};

// Helper function to determine effective status
function getEffectiveStatus(program: ProgramsOverviewTable): ProgramEffectiveStatus {
    if (program.archived_at) return ProgramEffectiveStatus.Archived;
    if (program.status) return ProgramEffectiveStatus.Available;
    return ProgramEffectiveStatus.Inactive;
}

// Helper function to parse comma-separated values
function parseCommaSeparated(value: string | null | undefined): string[] {
    if (!value) return [];
    return value
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
}

// Helper function to format display names
function formatDisplayName(value: string): string {
    return value.replace(/_/g, ' ').replace(/-/g, ' ');
}

export function ProgramsPage({ onNavigate }: ProgramsPageProps) {
    const { user } = useAuth();
    const isDeptAdminUser = user ? isDeptAdmin(user) : false;

    const { data: resp } = useSWR<ServerResponseMany<ProgramsOverviewTable>>(
        '/api/programs/detailed-list'
    );
    const programs = resp?.data ?? [];

    const [searchQuery, setSearchQuery] = useState('');
    const [selectedTypes, setSelectedTypes] = useState<ProgramType[]>([]);
    const [selectedStatuses, setSelectedStatuses] = useState<ProgramEffectiveStatus[]>([]);
    const [sortBy, setSortBy] = useState<string>('name-asc');
    const [showAddProgram, setShowAddProgram] = useState(false);

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(20);

    // Form state for adding a program
    const [programFormData, setProgramFormData] = useState({
        name: '',
        description: '',
        types: [] as ProgramType[],
        creditTypes: [] as CreditType[],
        fundingTypes: [] as FundingType[],
        status: ProgramEffectiveStatus.Available,
    });

    // All available program types and statuses
    const programTypes: { value: ProgramType; label: string }[] = [
        { value: ProgramType.EDUCATIONAL, label: 'Educational' },
        { value: ProgramType.VOCATIONAL, label: 'Vocational' },
        { value: ProgramType.MENTAL_HEALTH, label: 'Mental Health' },
        { value: ProgramType.THERAPEUTIC, label: 'Therapeutic' },
        { value: ProgramType.LIFE_SKILLS, label: 'Life Skills' },
        { value: ProgramType.RE_ENTRY, label: 'Re-Entry' },
        { value: ProgramType.RELIGIOUS, label: 'Faith-Based' },
    ];

    const programStatuses: { value: ProgramEffectiveStatus; label: string }[] = [
        { value: ProgramEffectiveStatus.Available, label: 'Available' },
        { value: ProgramEffectiveStatus.Inactive, label: 'Inactive' },
        { value: ProgramEffectiveStatus.Archived, label: 'Archived' },
    ];

    // Toggle filter selection
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

    // Clear all filters
    const clearFilters = () => {
        setSelectedTypes([]);
        setSelectedStatuses([]);
    };

    // Filter based on search, type, and performance
    const filteredPrograms = programs.filter(program => {
        const matchesSearch = program.program_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                             program.description.toLowerCase().includes(searchQuery.toLowerCase());
        const types = parseCommaSeparated(program.program_types);
        const matchesType = selectedTypes.length === 0 || types.some(type => selectedTypes.includes(type as ProgramType));
        const status = getEffectiveStatus(program);
        const matchesStatus = selectedStatuses.length === 0 || selectedStatuses.includes(status);

        return matchesSearch && matchesType && matchesStatus;
    });

    // Sort programs
    const sortedPrograms = [...filteredPrograms].sort((a, b) => {
        if (sortBy === 'name-asc') {
            return a.program_name.localeCompare(b.program_name);
        } else if (sortBy === 'name-desc') {
            return b.program_name.localeCompare(a.program_name);
        } else if (sortBy === 'enrollment-asc') {
            return (a.total_active_enrollments ?? 0) - (b.total_active_enrollments ?? 0);
        } else if (sortBy === 'enrollment-desc') {
            return (b.total_active_enrollments ?? 0) - (a.total_active_enrollments ?? 0);
        } else if (sortBy === 'completion-asc') {
            return (a.completion_rate ?? 0) - (b.completion_rate ?? 0);
        } else if (sortBy === 'completion-desc') {
            return (b.completion_rate ?? 0) - (a.completion_rate ?? 0);
        }
        return 0;
    });

    // Calculate overview stats
    const activePrograms = filteredPrograms.length;
    const totalClasses = filteredPrograms.reduce(
        (sum, p) => sum + (p.total_classes ?? 0),
        0
    );
    const totalEnrollment = filteredPrograms.reduce(
        (sum, p) => sum + (p.total_active_enrollments ?? 0),
        0
    );
    const totalCapacity = filteredPrograms.reduce(
        (sum, p) => sum + (p.total_capacity ?? 0),
        0
    );

    // Calculate weighted completion rate
    const totalCompletedEnrollments = filteredPrograms.reduce(
        (sum, p) => sum + ((p.completion_rate ?? 0) / 100 * ((p.total_enrollments ?? 0) - (p.total_active_enrollments ?? 0))),
        0
    );
    const totalEndedEnrollments = filteredPrograms.reduce(
        (sum, p) => sum + ((p.total_enrollments ?? 0) - (p.total_active_enrollments ?? 0)),
        0
    );
    const completionRate = totalEndedEnrollments > 0
        ? Math.round((totalCompletedEnrollments / totalEndedEnrollments) * 100)
        : 0;

    // Pagination
    const paginatedPrograms = sortedPrograms.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    return (
        <div className="max-w-7xl mx-auto px-6 py-8">
            {/* Header */}
            <div className="mb-8">
                <div className="flex items-center justify-between mb-2">
                    <div>
                        <h1 className="text-[#203622]">Programs</h1>
                        <p className="text-gray-600 mt-1">
                            {isDeptAdminUser
                                ? 'Manage programs across all facilities'
                                : 'Supporting resident growth and rehabilitation'}
                        </p>
                    </div>
                    <Button className="bg-[#F1B51C] hover:bg-[#d9a419] text-[#203622] gap-2" onClick={() => setShowAddProgram(!showAddProgram)}>
                        <Plus className="size-5" />
                        {showAddProgram ? 'Cancel' : (isDeptAdminUser ? 'Create Statewide Program' : 'Add Program')}
                    </Button>
                </div>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-4 gap-6 mb-8">
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <div className="text-3xl text-[#203622] mb-1">{activePrograms}</div>
                    <div className="text-sm text-gray-600">Active Programs</div>
                </div>
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <div className="text-3xl text-[#203622] mb-1">{totalClasses}</div>
                    <div className="text-sm text-gray-600">Total Classes</div>
                </div>
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <div className="text-3xl text-[#203622] mb-1">
                        {totalEnrollment} enrollments of {totalCapacity} capacity
                    </div>
                    <div className="text-sm text-gray-600">Total Enrollment</div>
                </div>
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <div className="text-3xl text-[#203622] mb-1">{completionRate}%</div>
                    <div className="text-sm text-gray-600">Completion Rate</div>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
                <div className="flex gap-4">
                    <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-gray-400" />
                        <Input
                            placeholder="Search programs..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10"
                        />
                    </div>

                    {/* Sort Dropdown */}
                    <Select value={sortBy} onValueChange={setSortBy}>
                        <SelectTrigger className="w-[220px]">
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
                            <button className="w-[220px] bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm flex items-center justify-between hover:bg-gray-50 transition-colors">
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
                                {programTypes.map(type => (
                                    <label key={type.value} className="flex items-center gap-2 cursor-pointer">
                                        <Checkbox
                                            checked={selectedTypes.includes(type.value)}
                                            onCheckedChange={() => toggleTypeFilter(type.value)}
                                        />
                                        <span className="text-sm">{type.label}</span>
                                    </label>
                                ))}
                            </div>
                        </PopoverContent>
                    </Popover>

                    {/* Status Filter */}
                    <Popover>
                        <PopoverTrigger asChild>
                            <button className="w-[220px] bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm flex items-center justify-between hover:bg-gray-50 transition-colors">
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
                                {programStatuses.map(status => (
                                    <label key={status.value} className="flex items-center gap-2 cursor-pointer">
                                        <Checkbox
                                            checked={selectedStatuses.includes(status.value)}
                                            onCheckedChange={() => toggleStatusFilter(status.value)}
                                        />
                                        <span className="text-sm">{status.label}</span>
                                    </label>
                                ))}
                            </div>
                            {(selectedTypes.length > 0 || selectedStatuses.length > 0) && (
                                <Button
                                    className="w-full bg-gray-100 text-gray-700 hover:bg-gray-200"
                                    onClick={clearFilters}
                                    size="sm"
                                >
                                    Clear All Filters
                                </Button>
                            )}
                        </PopoverContent>
                    </Popover>
                </div>
            </div>

            {/* Add Program Form (Inline) */}
            {showAddProgram && (
                <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
                    <h3 className="text-[#203622] mb-4">{isDeptAdminUser ? 'Create Statewide Program' : 'Add New Program'}</h3>
                    <div className="space-y-6">
                        {/* Basic Information */}
                        <div>
                            <h4 className="text-sm text-gray-700 mb-3">Basic Information</h4>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label htmlFor="programName">Program Name *</Label>
                                    <Input
                                        id="programName"
                                        placeholder="e.g., GED Preparation"
                                        value={programFormData.name}
                                        onChange={(e) => setProgramFormData({ ...programFormData, name: e.target.value })}
                                    />
                                </div>
                                <div className="col-span-2">
                                    <Label htmlFor="programDescription">Description</Label>
                                    <Textarea
                                        id="programDescription"
                                        placeholder="Brief description of the program and its goals"
                                        value={programFormData.description}
                                        onChange={(e) => setProgramFormData({ ...programFormData, description: e.target.value })}
                                        rows={3}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Categorization */}
                        <div className="pt-4 border-t border-gray-200">
                            <h4 className="text-sm text-gray-700 mb-3">Categorization</h4>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label htmlFor="category">Category (Program Types) *</Label>
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
                                                />
                                                <span className="text-sm text-gray-700">{type.label}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <Label htmlFor="creditTypes">Credit Types *</Label>
                                    <div className="mt-2 space-y-2">
                                        {Object.values(CreditType).map((type) => (
                                            <label key={type} className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={programFormData.creditTypes.includes(type)}
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            setProgramFormData({
                                                                ...programFormData,
                                                                creditTypes: [...programFormData.creditTypes, type]
                                                            });
                                                        } else {
                                                            setProgramFormData({
                                                                ...programFormData,
                                                                creditTypes: programFormData.creditTypes.filter(t => t !== type)
                                                            });
                                                        }
                                                    }}
                                                    className="rounded border-gray-300 text-[#556830] focus:ring-[#556830]"
                                                />
                                                <span className="text-sm text-gray-700">{formatDisplayName(type)}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                <div className="col-span-2">
                                    <Label htmlFor="fundingTypes">Funding Types *</Label>
                                    <div className="mt-2 grid grid-cols-2 gap-2">
                                        {Object.values(FundingType).map((type) => (
                                            <label key={type} className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={programFormData.fundingTypes.includes(type)}
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            setProgramFormData({
                                                                ...programFormData,
                                                                fundingTypes: [...programFormData.fundingTypes, type]
                                                            });
                                                        } else {
                                                            setProgramFormData({
                                                                ...programFormData,
                                                                fundingTypes: programFormData.fundingTypes.filter(t => t !== type)
                                                            });
                                                        }
                                                    }}
                                                    className="rounded border-gray-300 text-[#556830] focus:ring-[#556830]"
                                                />
                                                <span className="text-sm text-gray-700">{formatDisplayName(type)}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                <div className="col-span-2">
                                    <Label htmlFor="programStatus">Program Availability *</Label>
                                    <Select
                                        value={programFormData.status}
                                        onValueChange={(value) => setProgramFormData({ ...programFormData, status: value as ProgramEffectiveStatus })}
                                    >
                                        <SelectTrigger id="programStatus">
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
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setShowAddProgram(false);
                                    setProgramFormData({
                                        name: '',
                                        description: '',
                                        types: [],
                                        creditTypes: [],
                                        fundingTypes: [],
                                        status: ProgramEffectiveStatus.Available,
                                    });
                                }}
                                className="border-gray-300"
                            >
                                Cancel
                            </Button>
                            <Button
                                className="bg-[#556830] hover:bg-[#203622] text-white"
                                onClick={() => {
                                    setShowAddProgram(false);
                                    import('sonner').then(({ toast }) => {
                                        toast.success('Program created successfully');
                                    });
                                    setProgramFormData({
                                        name: '',
                                        description: '',
                                        types: [],
                                        creditTypes: [],
                                        fundingTypes: [],
                                        status: ProgramEffectiveStatus.Available,
                                    });
                                }}
                            >
                                Create Program
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Programs Grid */}
            <div className="grid grid-cols-2 gap-6">
                {paginatedPrograms.map((program) => {
                    const status = getEffectiveStatus(program);
                    const types = parseCommaSeparated(program.program_types);
                    const credits = parseCommaSeparated(program.credit_types);

                    return (
                        <div
                            key={program.program_id}
                            onClick={() => onNavigate({ name: 'program-detail', programId: program.program_id.toString() })}
                            className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-lg hover:border-[#556830] transition-all cursor-pointer group"
                        >
                            {/* Header with Status Badge */}
                            <div className="flex items-start justify-between mb-4">
                                <div className="flex-1">
                                    <h3 className="text-[#203622] mb-1 group-hover:text-[#556830] transition-colors">
                                        {program.program_name}
                                    </h3>
                                    <p className="text-sm text-gray-600 line-clamp-2">{program.description}</p>
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

                            {/* Primary Metrics Grid */}
                            <div className="grid grid-cols-2 gap-3 mb-4">
                                <div className="bg-[#E2E7EA] rounded-lg p-3">
                                    <div className="text-xs text-gray-600 mb-2">Enrollment</div>
                                    <div className="space-y-1">
                                        <div className="flex items-baseline gap-1.5">
                                            <span className="text-2xl text-[#203622]">{program.total_active_enrollments ?? 0}</span>
                                            <span className="text-xs text-gray-500">currently enrolled</span>
                                        </div>
                                        <div className="text-xs text-gray-500">
                                            {program.total_enrollments ?? 0} total enrollment{(program.total_enrollments ?? 0) !== 1 ? 's' : ''}
                                        </div>
                                        <div className="text-xs text-gray-500 pt-1">
                                            {Math.round(program.completion_rate ?? 0)}% completion rate
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-[#E2E7EA] rounded-lg p-3">
                                    <div className="text-xs text-gray-600 mb-2">Classes</div>
                                    <div className="space-y-1">
                                        <div className="flex items-baseline gap-1.5">
                                            <span className="text-2xl text-[#203622]">{program.total_classes ?? 0}</span>
                                            <span className="text-xs text-gray-500">total</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Credit & Funding Type */}
                            <div className="text-xs text-gray-600 mb-3 space-y-1">
                                {credits.length > 0 && (
                                    <div>
                                        <span className="text-gray-500">Credit:</span> {credits.map(formatDisplayName).join(', ')}
                                    </div>
                                )}
                                {program.funding_type && (
                                    <div>
                                        <span className="text-gray-500">Funding:</span> {formatDisplayName(program.funding_type)}
                                    </div>
                                )}
                            </div>

                            {/* Department Admin: Facility Count */}
                            {isDeptAdminUser && (program.total_active_facilities ?? 0) > 0 && (
                                <div className="pt-3 border-t border-gray-200">
                                    <div className="text-sm text-gray-600">
                                        Active in <span className="text-[#203622] font-medium">{program.total_active_facilities}</span> {program.total_active_facilities === 1 ? 'facility' : 'facilities'}
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {filteredPrograms.length === 0 && (
                <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
                    <p className="text-gray-600 mb-2">No programs found</p>
                    <p className="text-sm text-gray-500">Try adjusting your search or filters</p>
                </div>
            )}

            {/* Pagination */}
            {filteredPrograms.length > itemsPerPage && (
                <Pagination
                    currentPage={currentPage}
                    totalItems={filteredPrograms.length}
                    itemsPerPage={itemsPerPage}
                    onPageChange={setCurrentPage}
                    onItemsPerPageChange={(val) => { setItemsPerPage(val); setCurrentPage(1); }}
                    itemLabel="programs"
                />
            )}
        </div>
    );
}
