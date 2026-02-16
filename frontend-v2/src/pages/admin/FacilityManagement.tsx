import { useState } from 'react';
import useSWR from 'swr';
import { useForm, Controller } from 'react-hook-form';
import { useAuth, isSysAdmin } from '@/auth/useAuth';
import { useUrlPagination } from '@/hooks/useUrlPagination';
import { useCheckResponse } from '@/hooks/useCheckResponse';
import { useToast } from '@/contexts/ToastContext';
import API from '@/api/api';
import { Facility, Timezones, ServerResponseMany, ToastState } from '@/types';
import { PageHeader } from '@/components/shared/PageHeader';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { FormModal } from '@/components/shared/FormModal';
import { DataTable, Column } from '@/components/shared/DataTable';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Plus, Pencil, Trash2, MoreHorizontal, Building2 } from 'lucide-react';

interface FacilityFormData {
    name: string;
    timezone: string;
}

function getTimezoneLabel(tz: string): string {
    const entry = Object.entries(Timezones).find(([, value]) => value === tz);
    return entry ? `${entry[0]} (${entry[1]})` : tz;
}

export default function FacilityManagement() {
    const { user } = useAuth();
    const { toaster } = useToast();
    const { page, perPage, setPage } = useUrlPagination(1, 20);

    const [addModalOpen, setAddModalOpen] = useState(false);
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [selectedFacility, setSelectedFacility] = useState<Facility | null>(null);

    const isSysAdminUser = user ? isSysAdmin(user) : false;

    const { data, mutate, error, isLoading } = useSWR<ServerResponseMany<Facility>>(
        `/api/facilities?page=${page}&per_page=${perPage}`
    );

    const facilityData = data?.data ?? [];
    const totalPages = data?.meta?.last_page ?? 1;

    const checkDelete = useCheckResponse<Facility>({
        mutate,
        closeDialog: () => setDeleteDialogOpen(false)
    });

    const addForm = useForm<FacilityFormData>({
        defaultValues: { name: '', timezone: Timezones.CST }
    });
    const editForm = useForm<FacilityFormData>();

    const handleAddFacility = async (formData: FacilityFormData) => {
        const response = await API.post<Facility, object>('facilities', formData);
        if (response.success) {
            toaster('Facility created successfully', ToastState.success);
            setAddModalOpen(false);
            addForm.reset();
            void mutate();
        } else {
            toaster(response.message || 'Failed to create facility', ToastState.error);
        }
    };

    const handleEditFacility = async (formData: FacilityFormData) => {
        if (!selectedFacility) return;
        const response = await API.patch<Facility, object>(
            `facilities/${selectedFacility.id}`,
            formData
        );
        if (response.success) {
            toaster('Facility updated successfully', ToastState.success);
            setEditModalOpen(false);
            editForm.reset();
            setSelectedFacility(null);
            void mutate();
        } else {
            toaster(response.message || 'Failed to update facility', ToastState.error);
        }
    };

    const handleDeleteFacility = async () => {
        if (!user || !isSysAdmin(user)) {
            toaster('Only System Admins may delete a facility', ToastState.error);
            setDeleteDialogOpen(false);
            return;
        }
        if (selectedFacility?.id === 1) {
            toaster('Cannot delete default facility', ToastState.error);
            setDeleteDialogOpen(false);
            return;
        }
        const response = await API.delete('facilities/' + selectedFacility?.id);
        checkDelete(
            response.success,
            'Error deleting facility',
            'Facility successfully deleted'
        );
        setSelectedFacility(null);
    };

    const openEdit = (facility: Facility) => {
        setSelectedFacility(facility);
        editForm.reset({
            name: facility.name,
            timezone: facility.timezone
        });
        setEditModalOpen(true);
    };

    const columns: Column<Facility>[] = [
        {
            key: 'name',
            header: 'Name',
            render: (f) => (
                <div className="flex items-center gap-2">
                    <Building2 className="size-4 text-[#556830]" />
                    <span className="font-medium text-foreground">{f.name}</span>
                </div>
            )
        },
        {
            key: 'timezone',
            header: 'Timezone',
            render: (f) => getTimezoneLabel(f.timezone)
        },
        {
            key: 'actions',
            header: 'Actions',
            headerClassName: 'text-right',
            className: 'text-right',
            render: (facility) => (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                            <MoreHorizontal className="size-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(facility)}>
                            <Pencil className="size-4 mr-2" />
                            Edit
                        </DropdownMenuItem>
                        {isSysAdminUser && (
                            <DropdownMenuItem
                                onClick={() => {
                                    setSelectedFacility(facility);
                                    setDeleteDialogOpen(true);
                                }}
                                className="text-destructive"
                            >
                                <Trash2 className="size-4 mr-2" />
                                Delete
                            </DropdownMenuItem>
                        )}
                    </DropdownMenuContent>
                </DropdownMenu>
            )
        }
    ];

    const addButton = (
        <Button
            className="bg-[#F1B51C] text-foreground hover:bg-[#F1B51C]/90 font-medium"
            disabled={!isSysAdminUser}
            onClick={() => {
                addForm.reset({ name: '', timezone: Timezones.CST });
                setAddModalOpen(true);
            }}
            title={!isSysAdminUser ? 'Only System Admins can add new facilities.' : undefined}
        >
            <Plus className="size-4" />
            Add Facility
        </Button>
    );

    return (
        <div className="space-y-6">
            <PageHeader
                title="Facility Management"
                subtitle="Manage your facilities"
                actions={addButton}
            />

            {error ? (
                <div className="text-center py-8 text-destructive">Failed to load facilities.</div>
            ) : (
                <DataTable
                    columns={columns}
                    data={facilityData}
                    keyExtractor={(f) => f.id}
                    isLoading={isLoading}
                    emptyMessage="No facilities found."
                    page={page}
                    totalPages={totalPages}
                    onPageChange={setPage}
                />
            )}

            <FormModal
                open={addModalOpen}
                onOpenChange={setAddModalOpen}
                title="Add Facility"
            >
                <form onSubmit={addForm.handleSubmit((d) => void handleAddFacility(d))} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="add-name">Facility Name</Label>
                        <Input id="add-name" {...addForm.register('name', { required: true })} />
                    </div>
                    <div className="space-y-2">
                        <Label>Timezone</Label>
                        <Controller
                            control={addForm.control}
                            name="timezone"
                            rules={{ required: true }}
                            render={({ field }) => (
                                <Select value={field.value} onValueChange={field.onChange}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select timezone" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {Object.entries(Timezones).map(([label, value]) => (
                                            <SelectItem key={value} value={value}>
                                                {label} ({value})
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                        />
                    </div>
                    <div className="flex justify-end gap-2 pt-4">
                        <Button variant="outline" type="button" onClick={() => setAddModalOpen(false)}>Cancel</Button>
                        <Button type="submit" className="bg-[#203622] text-white hover:bg-[#203622]/90">Save</Button>
                    </div>
                </form>
            </FormModal>

            <FormModal
                open={editModalOpen}
                onOpenChange={setEditModalOpen}
                title="Edit Facility"
            >
                <form onSubmit={editForm.handleSubmit((d) => void handleEditFacility(d))} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="edit-name">Facility Name</Label>
                        <Input id="edit-name" {...editForm.register('name', { required: true })} />
                    </div>
                    <div className="space-y-2">
                        <Label>Timezone</Label>
                        <Controller
                            control={editForm.control}
                            name="timezone"
                            rules={{ required: true }}
                            render={({ field }) => (
                                <Select value={field.value} onValueChange={field.onChange}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select timezone" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {Object.entries(Timezones).map(([label, value]) => (
                                            <SelectItem key={value} value={value}>
                                                {label} ({value})
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                        />
                    </div>
                    <div className="flex justify-end gap-2 pt-4">
                        <Button variant="outline" type="button" onClick={() => setEditModalOpen(false)}>Cancel</Button>
                        <Button type="submit" className="bg-[#203622] text-white hover:bg-[#203622]/90">Save</Button>
                    </div>
                </form>
            </FormModal>

            <ConfirmDialog
                open={deleteDialogOpen}
                onOpenChange={setDeleteDialogOpen}
                title="Delete Facility"
                description="Are you sure you would like to delete this facility? This action cannot be undone."
                confirmLabel="Delete"
                onConfirm={() => void handleDeleteFacility()}
                variant="destructive"
            />
        </div>
    );
}
