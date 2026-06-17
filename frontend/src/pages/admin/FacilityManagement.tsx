import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useUrlPagination } from '@/hooks/useUrlPagination';
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
import { DialogFooter } from '@/components/ui/dialog';
import { FormModal } from '@/components/shared';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';
import { FacilityWithStats } from '@/types';
import { Input } from '@/components/ui/input';
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage
} from '@/components/ui/form';
import { facilitySchema, FacilityInput } from '@/lib/validation';
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

const DEFAULT_TIMEZONE = 'America/New_York';

export default function FacilityManagement() {
    const [searchQuery, setSearchQuery] = useState('');
    const [sortColumn, setSortColumn] = useState<SortColumn>('name');
    const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
    const { page, perPage, setPage, setPerPage } = useUrlPagination();

    const [showAddFacility, setShowAddFacility] = useState(false);
    const [showEditFacility, setShowEditFacility] = useState(false);
    const [selectedFacility, setSelectedFacility] =
        useState<FacilityWithStats | null>(null);

    const addForm = useForm<FacilityInput>({
        resolver: zodResolver(facilitySchema),
        defaultValues: { name: '', timezone: DEFAULT_TIMEZONE }
    });
    const editForm = useForm<FacilityInput>({
        resolver: zodResolver(facilitySchema),
        defaultValues: { name: '', timezone: DEFAULT_TIMEZONE }
    });

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

    const paginated = sorted.slice((page - 1) * perPage, page * perPage);

    function toggleSort(column: SortColumn) {
        if (sortColumn === column) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortColumn(column);
            setSortDirection('asc');
        }
    }

    async function handleAddFacility(data: FacilityInput) {
        const resp = await API.post<FacilityWithStats, FacilityInput>(
            'facilities',
            data
        );
        if (resp.success) {
            toast.success(`Facility "${data.name}" added successfully`);
            setShowAddFacility(false);
            addForm.reset({ name: '', timezone: DEFAULT_TIMEZONE });
            void mutate();
        } else {
            toast.error(resp.message || 'Failed to create facility');
        }
    }

    async function handleEditFacility(data: FacilityInput) {
        if (!selectedFacility) return;
        const resp = await API.patch<FacilityWithStats, FacilityInput>(
            `facilities/${selectedFacility.id}`,
            data
        );
        if (resp.success) {
            toast.success(`${selectedFacility.name} updated successfully`);
            setShowEditFacility(false);
            setSelectedFacility(null);
            void mutate();
        } else {
            toast.error(resp.message || 'Failed to update facility');
        }
    }

    function openEdit(facility: FacilityWithStats) {
        setSelectedFacility(facility);
        editForm.reset({
            name: facility.name,
            timezone: facility.timezone
        });
        setShowEditFacility(true);
    }

    return (
        <div className="bg-[#E7EAED] dark:bg-[#0a0a0a] min-h-full overflow-x-hidden">
            <div className="max-w-7xl mx-auto px-6 py-8">
                {/* Header */}
                <div className="mb-8">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-brand-dark">Facilities</h1>
                            <p className="text-gray-600 mt-1">
                                Manage correctional facilities and their
                                configurations
                            </p>
                        </div>
                        <Button
                            onClick={() => {
                                addForm.reset({
                                    name: '',
                                    timezone: DEFAULT_TIMEZONE
                                });
                                setShowAddFacility(true);
                            }}
                            className="gap-2 bg-brand hover:bg-brand-dark text-white"
                        >
                            <Plus className="size-4" />
                            Add Facility
                        </Button>
                    </div>
                </div>

                {/* Search */}
                <div className="mb-6">
                    <div className="relative">
                        <Search className="input-icon-left size-5" />
                        <Input
                            placeholder="Search facilities..."
                            value={searchQuery}
                            onChange={(e) => {
                                setSearchQuery(e.target.value);
                                setPage(1);
                            }}
                            className="pl-10"
                        />
                    </div>
                </div>

                {/* Table */}
                <div className="card-block">
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
                                        <TableCell className="font-medium text-brand-dark">
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
                        itemsPerPage={perPage}
                        currentPage={page}
                        onPageChange={setPage}
                        onItemsPerPageChange={setPerPage}
                        itemLabel="facilities"
                    />
                </div>

                {/* Add Facility Dialog */}
                <FormModal
                    open={showAddFacility}
                    onOpenChange={setShowAddFacility}
                    title="Add New Facility"
                    description="Create a new correctional facility"
                    titleClassName="text-foreground"
                >
                    <Form {...addForm}>
                        <form
                            onSubmit={(e) => {
                                e.preventDefault();
                                void addForm.handleSubmit(handleAddFacility)(e);
                            }}
                        >
                            <div className="space-y-4 py-4">
                                <FormField
                                    control={addForm.control}
                                    name="name"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Facility Name</FormLabel>
                                            <FormControl>
                                                <Input
                                                    placeholder="Northern Regional Facility"
                                                    {...field}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={addForm.control}
                                    name="timezone"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Timezone</FormLabel>
                                            <Select
                                                value={field.value}
                                                onValueChange={field.onChange}
                                            >
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                </FormControl>
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
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                            <DialogFooter>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setShowAddFacility(false)}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="submit"
                                    disabled={addForm.formState.isSubmitting}
                                    variant="brand"
                                >
                                    {addForm.formState.isSubmitting
                                        ? 'Adding...'
                                        : 'Add Facility'}
                                </Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </FormModal>

                {/* Edit Facility Dialog */}
                <FormModal
                    open={showEditFacility}
                    onOpenChange={setShowEditFacility}
                    title="Edit Facility"
                    description="Update facility information"
                    titleClassName="text-foreground"
                >
                    <Form {...editForm}>
                        <form
                            onSubmit={(e) => {
                                e.preventDefault();
                                void editForm.handleSubmit(handleEditFacility)(
                                    e
                                );
                            }}
                        >
                            <div className="space-y-4 py-4">
                                <FormField
                                    control={editForm.control}
                                    name="name"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Facility Name</FormLabel>
                                            <FormControl>
                                                <Input {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={editForm.control}
                                    name="timezone"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Timezone</FormLabel>
                                            <Select
                                                value={field.value}
                                                onValueChange={field.onChange}
                                            >
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                </FormControl>
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
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                            <DialogFooter>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setShowEditFacility(false)}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="submit"
                                    disabled={editForm.formState.isSubmitting}
                                    variant="brand"
                                >
                                    {editForm.formState.isSubmitting
                                        ? 'Saving...'
                                        : 'Save Changes'}
                                </Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </FormModal>
            </div>
        </div>
    );
}
