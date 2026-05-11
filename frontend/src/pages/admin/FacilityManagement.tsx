import { useState } from 'react';
import useSWR from 'swr';
import { toast } from 'sonner';
import { Search, Plus, Edit, ArrowUpDown, Building2 } from 'lucide-react';
import API from '@/api/api';
import type { ServerResponseMany } from '../../types/server';
import { Button } from '@/components/ui/button';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@/components/ui/table';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
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
import { FacilityWithStats } from '@/types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Pagination } from '@/components/Pagination';

type SortColumn = 'name' | 'timezone' | 'programs' | 'classes' | 'residents';
type SortDirection = 'asc' | 'desc';

interface FacilitySortRow {
    name: string;
    timezone?: string | null;
    active_programs: number;
    active_classes: number;
    total_residents: number;
}

const timezones = [
    { value: 'America/New_York', label: 'Eastern Time (ET)' },
    { value: 'America/Chicago', label: 'Central Time (CT)' },
    { value: 'America/Denver', label: 'Mountain Time (MT)' },
    { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
    { value: 'America/Phoenix', label: 'Arizona Time (MST)' },
    { value: 'America/Anchorage', label: 'Alaska Time (AKT)' },
    { value: 'Pacific/Honolulu', label: 'Hawaii Time (HST)' }
];

function getTimezoneLabel(tz: string): string {
    const match = timezones.find((t) => t.value === tz);
    return match ? match.label : tz;
}

interface FacilityFormData {
    name: string;
    timezone: string;
}

export default function FacilityManagement() {
    const [searchQuery, setSearchQuery] = useState('');
    const [sortColumn, setSortColumn] = useState<SortColumn>('name');
    const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(20);

    const [showAddFacility, setShowAddFacility] = useState(false);
    const [showEditFacility, setShowEditFacility] = useState(false);
    const [selectedFacility, setSelectedFacility] =
        useState<FacilityWithStats | null>(null);
    const [formData, setFormData] = useState<FacilityFormData>({
        name: '',
        timezone: 'America/New_York'
    });
    const [saving, setSaving] = useState(false);

    const { data, mutate } = useSWR<ServerResponseMany<FacilityWithStats>>(
        '/api/facilities?per_page=1000'
    );
    const allFacilities: FacilityWithStats[] = data?.data ?? [];

    const normalizedQuery = searchQuery.toLowerCase();
    const filtered: FacilityWithStats[] = normalizedQuery
        ? allFacilities.filter((f) => {
              const row = f as FacilitySortRow;
              return row.name.toLowerCase().includes(normalizedQuery);
          })
        : allFacilities;

    const dir = sortDirection === 'asc' ? 1 : -1;
    const sorted: FacilityWithStats[] = filtered.slice().sort((a, b) => {
        const left = a as FacilitySortRow;
        const right = b as FacilitySortRow;
        switch (sortColumn) {
            case 'name':
                return dir * left.name.localeCompare(right.name);
            case 'timezone':
                return (
                    dir *
                    String(left.timezone ?? '').localeCompare(
                        String(right.timezone ?? '')
                    )
                );
            case 'programs':
                return dir * (left.active_programs - right.active_programs);
            case 'classes':
                return dir * (left.active_classes - right.active_classes);
            case 'residents':
                return dir * (left.total_residents - right.total_residents);
            default:
                return 0;
        }
    });

    const paginated = sorted.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    function toggleSort(column: SortColumn) {
        if (sortColumn === column) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortColumn(column);
            setSortDirection('asc');
        }
    }

    async function handleAddFacility() {
        setSaving(true);
        const resp = await API.post<FacilityWithStats, FacilityFormData>(
            'facilities',
            formData
        );
        if (resp.success) {
            toast.success(`Facility "${formData.name}" added successfully`);
            setShowAddFacility(false);
            setFormData({ name: '', timezone: 'America/New_York' });
            void mutate();
        } else {
            toast.error(resp.message || 'Failed to create facility');
        }
        setSaving(false);
    }

    async function handleEditFacility() {
        if (!selectedFacility) return;
        setSaving(true);
        const resp = await API.patch<FacilityWithStats, FacilityFormData>(
            `facilities/${selectedFacility.id}`,
            formData
        );
        if (resp.success) {
            toast.success(`${selectedFacility.name} updated successfully`);
            setShowEditFacility(false);
            setSelectedFacility(null);
            void mutate();
        } else {
            toast.error(resp.message || 'Failed to update facility');
        }
        setSaving(false);
    }

    function openEdit(facility: FacilityWithStats) {
        setSelectedFacility(facility);
        setFormData({ name: facility.name, timezone: facility.timezone });
        setShowEditFacility(true);
    }

    return (
        <div className="bg-[#E7EAED] dark:bg-[#0a0a0a] min-h-full overflow-x-hidden">
            <div className="max-w-7xl mx-auto px-6 py-8">
                {/* Header */}
                <div className="mb-8">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-[#203622]">Facilities</h1>
                            <p className="text-gray-600 mt-1">
                                Manage correctional facilities and their
                                configurations
                            </p>
                        </div>
                        <Button
                            onClick={() => {
                                setFormData({
                                    name: '',
                                    timezone: 'America/New_York'
                                });
                                setShowAddFacility(true);
                            }}
                            className="gap-2 bg-[#556830] hover:bg-[#203622] text-white"
                        >
                            <Plus className="size-4" />
                            Add Facility
                        </Button>
                    </div>
                </div>

                {/* Search */}
                <div className="mb-6">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 size-5" />
                        <Input
                            placeholder="Search facilities..."
                            value={searchQuery}
                            onChange={(e) => {
                                setSearchQuery(e.target.value);
                                setCurrentPage(1);
                            }}
                            className="pl-10"
                        />
                    </div>
                </div>

                {/* Table */}
                <div className="bg-white rounded-lg border border-gray-200">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead
                                    className="cursor-pointer"
                                    onClick={() => toggleSort('name')}
                                >
                                    <div className="flex items-center gap-1">
                                        Facility Name
                                        <ArrowUpDown className="size-4" />
                                    </div>
                                </TableHead>
                                <TableHead
                                    className="cursor-pointer"
                                    onClick={() => toggleSort('timezone')}
                                >
                                    <div className="flex items-center gap-1">
                                        Timezone
                                        <ArrowUpDown className="size-4" />
                                    </div>
                                </TableHead>
                                <TableHead
                                    className="cursor-pointer"
                                    onClick={() => toggleSort('programs')}
                                >
                                    <div className="flex items-center gap-1">
                                        Active Programs
                                        <ArrowUpDown className="size-4" />
                                    </div>
                                </TableHead>
                                <TableHead
                                    className="cursor-pointer"
                                    onClick={() => toggleSort('classes')}
                                >
                                    <div className="flex items-center gap-1">
                                        Active Classes
                                        <ArrowUpDown className="size-4" />
                                    </div>
                                </TableHead>
                                <TableHead
                                    className="cursor-pointer"
                                    onClick={() => toggleSort('residents')}
                                >
                                    <div className="flex items-center gap-1">
                                        Residents
                                        <ArrowUpDown className="size-4" />
                                    </div>
                                </TableHead>
                                <TableHead className="text-right">
                                    Actions
                                </TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {paginated.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-32">
                                        <div className="flex flex-col items-center gap-2">
                                            <Building2 className="size-12 text-gray-300" />
                                            <p className="text-gray-500">
                                                No facilities found
                                            </p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                paginated.map((facility) => (
                                    <TableRow
                                        key={facility.id}
                                        className="cursor-pointer hover:bg-gray-50"
                                    >
                                        <TableCell className="font-medium text-[#203622]">
                                            {facility.name}
                                        </TableCell>
                                        <TableCell className="text-sm text-gray-600">
                                            {getTimezoneLabel(
                                                facility.timezone
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {facility.active_programs === 0 ? (
                                                <span className="text-orange-600 font-medium">
                                                    0
                                                </span>
                                            ) : (
                                                <span className="text-gray-900">
                                                    {facility.active_programs}
                                                </span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {facility.active_classes === 0 ? (
                                                <span className="text-orange-600 font-medium">
                                                    0
                                                </span>
                                            ) : (
                                                <span className="text-gray-900">
                                                    {facility.active_classes}
                                                </span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-gray-900">
                                            {facility.total_residents}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    openEdit(facility);
                                                }}
                                                className="h-8 w-8 p-0"
                                            >
                                                <Edit className="size-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>

                    <Pagination
                        totalItems={sorted.length}
                        itemsPerPage={itemsPerPage}
                        currentPage={currentPage}
                        onPageChange={setCurrentPage}
                        onItemsPerPageChange={(value) => {
                            setItemsPerPage(value);
                            setCurrentPage(1);
                        }}
                        itemLabel="facilities"
                    />
                </div>

                {/* Add Facility Dialog */}
                <Dialog
                    open={showAddFacility}
                    onOpenChange={setShowAddFacility}
                >
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Add New Facility</DialogTitle>
                            <DialogDescription>
                                Create a new correctional facility
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label htmlFor="add-name">Facility Name</Label>
                                <Input
                                    id="add-name"
                                    value={formData.name}
                                    onChange={(e) =>
                                        setFormData({
                                            ...formData,
                                            name: e.target.value
                                        })
                                    }
                                    placeholder="Northern Regional Facility"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="add-timezone">Timezone</Label>
                                <Select
                                    value={formData.timezone}
                                    onValueChange={(value) =>
                                        setFormData({
                                            ...formData,
                                            timezone: value
                                        })
                                    }
                                >
                                    <SelectTrigger id="add-timezone">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {timezones.map((tz) => (
                                            <SelectItem
                                                key={tz.value}
                                                value={tz.value}
                                            >
                                                {tz.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button
                                variant="outline"
                                onClick={() => setShowAddFacility(false)}
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={() => void handleAddFacility()}
                                disabled={saving || !formData.name.trim()}
                                className="bg-[#556830] hover:bg-[#203622] text-white"
                            >
                                {saving ? 'Adding...' : 'Add Facility'}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Edit Facility Dialog */}
                <Dialog
                    open={showEditFacility}
                    onOpenChange={setShowEditFacility}
                >
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Edit Facility</DialogTitle>
                            <DialogDescription>
                                Update facility information
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label htmlFor="edit-name">Facility Name</Label>
                                <Input
                                    id="edit-name"
                                    value={formData.name}
                                    onChange={(e) =>
                                        setFormData({
                                            ...formData,
                                            name: e.target.value
                                        })
                                    }
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="edit-timezone">Timezone</Label>
                                <Select
                                    value={formData.timezone}
                                    onValueChange={(value) =>
                                        setFormData({
                                            ...formData,
                                            timezone: value
                                        })
                                    }
                                >
                                    <SelectTrigger id="edit-timezone">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {timezones.map((tz) => (
                                            <SelectItem
                                                key={tz.value}
                                                value={tz.value}
                                            >
                                                {tz.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button
                                variant="outline"
                                onClick={() => setShowEditFacility(false)}
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={() => void handleEditFacility()}
                                disabled={saving || !formData.name.trim()}
                                className="bg-[#556830] hover:bg-[#203622] text-white"
                            >
                                {saving ? 'Saving...' : 'Save Changes'}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </div>
    );
}
