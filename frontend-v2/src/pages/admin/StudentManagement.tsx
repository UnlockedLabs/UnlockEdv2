import { useState, useEffect, startTransition } from 'react';
import useSWR from 'swr';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { useUrlPagination } from '@/hooks/useUrlPagination';
import { useToast } from '@/contexts/ToastContext';
import { useAuth, canSwitchFacility } from '@/auth/useAuth';
import API from '@/api/api';
import {
    User,
    Facility,
    ServerResponseMany,
    ServerResponseOne,
    NewUserResponse,
    ToastState
} from '@/types';
import { formatLastActive } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Pagination } from '@/components/Pagination';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import {
    EditResidentDialog,
    ResetPasswordConfirmDialog,
    ResetPasswordResultDialog,
    DeactivateDialog,
    DeleteDialog,
    TransferDialog
} from '@/components/residents/ResidentModals';
import {
    BulkResetPasswordDialog,
    BulkDeactivateDialog,
    BulkDeleteDialog
} from '@/components/residents/BulkActionDialogs';
import { BulkImportDialog } from '@/components/residents/BulkImportDialog';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger
} from '@/components/ui/tooltip';
import {
    Search,
    Plus,
    Upload,
    ArrowUpDown,
    Users as UsersIcon,
    Edit,
    KeyRound,
    MoreVertical,
    UserX,
    Trash2
} from 'lucide-react';

type SortField = 'name_last' | 'username' | 'doc_id' | 'facility_id' | 'last_login';
type SortDir = 'asc' | 'desc';

interface StudentFormData {
    name_first: string;
    name_last: string;
    username: string;
    doc_id?: string;
    facility_id?: number;
}

interface UserStatsData {
    total: number;
    active: number;
    inactive: number;
}

export default function StudentManagement() {
    const navigate = useNavigate();
    const { toaster } = useToast();
    const { user } = useAuth();
    const { page, perPage, setPage, setPerPage } = useUrlPagination(1, 20);

    const showFacilityColumn = user ? canSwitchFacility(user) : false;

    const [searchTerm, setSearchTerm] = useState('');
    const [facilityFilter, setFacilityFilter] = useState<string>('all');
    const [sortField, setSortField] = useState<SortField>('name_last');
    const [sortDir, setSortDir] = useState<SortDir>('asc');
    const [addDialogOpen, setAddDialogOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [editOpen, setEditOpen] = useState(false);
    const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
    const [resetResultOpen, setResetResultOpen] = useState(false);
    const [tempPassword, setTempPassword] = useState('');
    const [deactivateOpen, setDeactivateOpen] = useState(false);
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [transferOpen, setTransferOpen] = useState(false);

    const [selectedResidents, setSelectedResidents] = useState<Set<number>>(new Set());
    const [bulkResetOpen, setBulkResetOpen] = useState(false);
    const [bulkDeactivateOpen, setBulkDeactivateOpen] = useState(false);
    const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
    const [bulkImportOpen, setBulkImportOpen] = useState(false);

    useEffect(() => {
        setSelectedResidents(new Set());
    }, [searchTerm, facilityFilter, sortField, sortDir]);

    const facilityParam =
        showFacilityColumn && facilityFilter !== 'all'
            ? `&facility_id=${facilityFilter}`
            : '';

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const { data, mutate, error, isLoading } = useSWR<ServerResponseMany<User>>(
        `/api/users?search=${encodeURIComponent(searchTerm)}&page=${page}&per_page=${perPage}&order_by=${sortField} ${sortDir}&role=student&include_deactivated=true${facilityParam}`
    );

    const statsParam =
        showFacilityColumn && facilityFilter !== 'all'
            ? `?facility_id=${facilityFilter}`
            : '';
    const { data: statsResp } = useSWR<ServerResponseOne<UserStatsData>>(
        `/api/users/stats${statsParam}`
    );
    const stats = statsResp?.data;

    const { data: facilitiesResp } = useSWR<ServerResponseMany<Facility>>(
        showFacilityColumn ? '/api/facilities' : null
    );
    const facilities = [...(facilitiesResp?.data ?? [])].sort((a, b) =>
        a.name.localeCompare(b.name)
    );

    const userData = data?.data ?? [];
    const totalItems = data?.meta?.total ?? 0;

    const addForm = useForm<StudentFormData>();

    const handleSearchChange = (value: string) => {
        startTransition(() => {
            setSearchTerm(value);
            setPage(1);
        });
    };

    const toggleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        } else {
            setSortField(field);
            setSortDir('asc');
        }
        setPage(1);
    };

    const handleAddUser = async (formData: StudentFormData) => {
        const user = {
            name_first: formData.name_first,
            name_last: formData.name_last,
            username: formData.username,
            doc_id: formData.doc_id,
            role: 'student' as const,
            ...(formData.facility_id
                ? { facility_id: formData.facility_id }
                : {})
        };
        const response = (await API.post<NewUserResponse, object>('users', {
            user
        })) as ServerResponseOne<NewUserResponse>;

        if (response.success) {
            setAddDialogOpen(false);
            toaster(`Resident ${formData.name_first} ${formData.name_last} added successfully`, ToastState.success);
            addForm.reset();
            void mutate();
        } else {
            toaster(
                response.message || 'Failed to create resident',
                ToastState.error
            );
        }
    };

    const handleMutate = () => {
        void mutate();
    };

    const activeResidents = userData.filter((r) => !r.deactivated_at);

    const allPageSelected =
        activeResidents.length > 0 &&
        activeResidents.every((r) => selectedResidents.has(r.id));

    const toggleSelectAll = () => {
        setSelectedResidents((prev) => {
            const next = new Set(prev);
            if (allPageSelected) {
                activeResidents.forEach((r) => next.delete(r.id));
            } else {
                activeResidents.forEach((r) => next.add(r.id));
            }
            return next;
        });
    };

    const toggleSelectResident = (id: number) => {
        setSelectedResidents((prev) => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    const getSelectedUsers = () =>
        userData.filter((r) => selectedResidents.has(r.id));

    const handleBulkSuccess = () => {
        setSelectedResidents(new Set());
        void mutate();
    };

    const openAction = (
        targetUser: User,
        setter: (open: boolean) => void
    ) => {
        setSelectedUser(targetUser);
        setter(true);
    };

    const handleResetSuccess = (password: string) => {
        setTempPassword(password);
        setResetResultOpen(true);
    };

    const SortableHeader = ({
        field,
        children
    }: {
        field: SortField;
        children: React.ReactNode;
    }) => (
        <TableHead
            className="cursor-pointer hover:bg-gray-50"
            onClick={() => toggleSort(field)}
        >
            <div className="flex items-center gap-2">
                {children}
                <ArrowUpDown
                    className={cn(
                        'size-4',
                        sortField === field
                            ? 'text-foreground'
                            : 'text-muted-foreground'
                    )}
                />
            </div>
        </TableHead>
    );

    const isFormValid = addForm.watch('name_first') && addForm.watch('name_last') && addForm.watch('username');

    return (
        <div className="max-w-7xl mx-auto px-6 py-8">
                {/* Header */}
                <div className="mb-8">
                    {user && !showFacilityColumn && (
                        <div className="text-sm text-gray-600 mb-2">
                            {user.facility.name}
                        </div>
                    )}
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-[#203622]">
                                Residents
                            </h1>
                            <p className="text-gray-600 mt-1">
                                Manage resident profiles and account information
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                onClick={() => setBulkImportOpen(true)}
                                variant="outline"
                                className="gap-2"
                            >
                                <Upload className="size-4" />
                                Bulk Import
                            </Button>
                            <Button
                                onClick={() => {
                                    addForm.reset();
                                    if (showFacilityColumn && user) {
                                        addForm.setValue(
                                            'facility_id',
                                            user.facility_id
                                        );
                                    }
                                    setAddDialogOpen(true);
                                }}
                                className="gap-2 bg-[#556830] hover:bg-[#203622]"
                            >
                                <Plus className="size-4" />
                                Add Resident
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Search + Filter */}
                <div className="mb-6 flex gap-4">
                    <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 size-5" />
                        <Input
                            placeholder="Search by name, username, or ID..."
                            value={searchTerm}
                            onChange={(e) => handleSearchChange(e.target.value)}
                            className="pl-10"
                        />
                    </div>
                    {showFacilityColumn && (
                        <Select
                            value={facilityFilter}
                            onValueChange={(v) => {
                                setFacilityFilter(v);
                                setPage(1);
                            }}
                        >
                            <SelectTrigger className="w-64">
                                <SelectValue placeholder="Filter by facility" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">
                                    All Facilities
                                </SelectItem>
                                {facilities.map((f) => (
                                    <SelectItem
                                        key={f.id}
                                        value={String(f.id)}
                                    >
                                        {f.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="bg-white rounded-lg border border-gray-200 p-4">
                        <div className="text-sm text-gray-600 mb-1">
                            Total Residents
                        </div>
                        <div className="text-2xl font-medium text-[#203622]">
                            {stats?.total ?? '\u2014'}
                        </div>
                    </div>
                    <div className="bg-white rounded-lg border border-gray-200 p-4">
                        <div className="text-sm text-gray-600 mb-1">
                            Active Accounts
                        </div>
                        <div className="text-2xl font-medium text-green-700">
                            {stats?.active ?? '\u2014'}
                        </div>
                    </div>
                    <div className="bg-white rounded-lg border border-gray-200 p-4">
                        <div className="text-sm text-gray-600 mb-1">
                            Inactive Accounts
                        </div>
                        <div className="text-2xl font-medium text-gray-500">
                            {stats?.inactive ?? '\u2014'}
                        </div>
                    </div>
                </div>

                {/* Table */}
                {error ? (
                    <div className="text-center py-8 text-destructive">
                        Failed to load residents.
                    </div>
                ) : isLoading ? (
                    <div className="bg-white rounded-lg p-4 space-y-3">
                        {Array.from({ length: 5 }).map((_, i) => (
                            <Skeleton key={i} className="h-10 w-full" />
                        ))}
                    </div>
                ) : (
                    <div className="bg-white rounded-lg border border-gray-200">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-12">
                                        <Checkbox
                                            checked={allPageSelected}
                                            onCheckedChange={toggleSelectAll}
                                        />
                                    </TableHead>
                                    <SortableHeader field="name_last">
                                        Name
                                    </SortableHeader>
                                    <SortableHeader field="username">
                                        Username
                                    </SortableHeader>
                                    <SortableHeader field="doc_id">
                                        Resident ID
                                    </SortableHeader>
                                    {showFacilityColumn && (
                                        <SortableHeader field="facility_id">
                                            Facility
                                        </SortableHeader>
                                    )}
                                    <SortableHeader field="last_login">
                                        Last Active
                                    </SortableHeader>
                                    <TableHead className="text-right">
                                        Actions
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {userData.length === 0 ? (
                                    <TableRow>
                                        <TableCell
                                            colSpan={
                                                showFacilityColumn ? 7 : 6
                                            }
                                            className="text-center py-12"
                                        >
                                            <div className="flex flex-col items-center gap-2">
                                                <UsersIcon className="size-12 text-gray-300" />
                                                <p className="text-gray-500">
                                                    No residents found
                                                </p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    userData.map((resident) => (
                                        <TableRow
                                            key={resident.id}
                                            className="hover:bg-gray-50 cursor-pointer"
                                            onClick={() =>
                                                navigate(
                                                    `/residents/${resident.id}`
                                                )
                                            }
                                        >
                                            <TableCell
                                                onClick={(e) =>
                                                    e.stopPropagation()
                                                }
                                            >
                                                {!resident.deactivated_at && (
                                                    <Checkbox
                                                        checked={selectedResidents.has(
                                                            resident.id
                                                        )}
                                                        onCheckedChange={() =>
                                                            toggleSelectResident(
                                                                resident.id
                                                            )
                                                        }
                                                    />
                                                )}
                                            </TableCell>
                                            <TableCell className="font-medium">
                                                <div className="flex items-center gap-2">
                                                    {resident.name_last},{' '}
                                                    {resident.name_first}
                                                    {resident.deactivated_at && (
                                                        <Badge
                                                            variant="outline"
                                                            className="bg-gray-100 text-gray-600 border-gray-300"
                                                        >
                                                            Deactivated
                                                        </Badge>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-sm text-gray-600">
                                                {resident.username}
                                            </TableCell>
                                            <TableCell className="text-sm text-gray-600">
                                                {resident.doc_id ?? '\u2014'}
                                            </TableCell>
                                            {showFacilityColumn && (
                                                <TableCell className="text-sm text-gray-600">
                                                    {resident.facility?.name ??
                                                        '\u2014'}
                                                </TableCell>
                                            )}
                                            <TableCell className="text-sm text-gray-600">
                                                {formatLastActive(
                                                    resident.login_metrics
                                                        ?.last_login
                                                )}
                                            </TableCell>
                                            <TableCell
                                                className="text-right"
                                                onClick={(e) =>
                                                    e.stopPropagation()
                                                }
                                            >
                                                {resident.deactivated_at ? (
                                                    <span className="text-sm text-gray-500 italic">
                                                        No actions available
                                                    </span>
                                                ) : (
                                                    <div className="flex items-center justify-end gap-1">
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="h-8 w-8 p-0"
                                                                    onClick={() =>
                                                                        openAction(
                                                                            resident,
                                                                            setEditOpen
                                                                        )
                                                                    }
                                                                >
                                                                    <Edit className="size-4" />
                                                                </Button>
                                                            </TooltipTrigger>
                                                            <TooltipContent>Edit resident</TooltipContent>
                                                        </Tooltip>
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="h-8 w-8 p-0"
                                                                    onClick={() =>
                                                                        openAction(
                                                                            resident,
                                                                            setResetConfirmOpen
                                                                        )
                                                                    }
                                                                >
                                                                    <KeyRound className="size-4" />
                                                                </Button>
                                                            </TooltipTrigger>
                                                            <TooltipContent>Reset password</TooltipContent>
                                                        </Tooltip>
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger
                                                                asChild
                                                            >
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="h-8 w-8 p-0"
                                                                >
                                                                    <MoreVertical className="size-4" />
                                                                    <span className="sr-only">More actions</span>
                                                                </Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end">
                                                                <DropdownMenuItem
                                                                    onClick={() =>
                                                                        openAction(
                                                                            resident,
                                                                            setDeactivateOpen
                                                                        )
                                                                    }
                                                                    className="text-orange-600"
                                                                >
                                                                    <UserX className="size-4 mr-2" />
                                                                    Deactivate
                                                                    Account
                                                                </DropdownMenuItem>
                                                                {showFacilityColumn && (
                                                                    <>
                                                                        <DropdownMenuSeparator />
                                                                        <DropdownMenuItem
                                                                            onClick={() =>
                                                                                openAction(
                                                                                    resident,
                                                                                    setTransferOpen
                                                                                )
                                                                            }
                                                                        >
                                                                            <UsersIcon className="size-4 mr-2" />
                                                                            Transfer
                                                                            Resident
                                                                        </DropdownMenuItem>
                                                                    </>
                                                                )}
                                                                <DropdownMenuSeparator />
                                                                <DropdownMenuItem
                                                                    onClick={() =>
                                                                        openAction(
                                                                            resident,
                                                                            setDeleteOpen
                                                                        )
                                                                    }
                                                                    className="text-red-600"
                                                                >
                                                                    <Trash2 className="size-4 mr-2" />
                                                                    Delete
                                                                    Resident
                                                                </DropdownMenuItem>
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    </div>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>

                        <Pagination
                            currentPage={page}
                            totalItems={totalItems}
                            itemsPerPage={perPage}
                            onPageChange={setPage}
                            onItemsPerPageChange={setPerPage}
                            itemLabel="residents"
                        />
                    </div>
                )}

                {/* Add Resident Dialog */}
                <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Add New Resident</DialogTitle>
                            <DialogDescription>
                                Create a new resident profile in the system
                            </DialogDescription>
                        </DialogHeader>
                        <form
                            onSubmit={(e) => {
                                e.preventDefault();
                                void addForm.handleSubmit(
                                    (d) => void handleAddUser(d)
                                )(e);
                            }}
                        >
                            <div className="space-y-4 py-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <Label htmlFor="add-first">
                                            First Name
                                        </Label>
                                        <Input
                                            id="add-first"
                                            placeholder="First name"
                                            {...addForm.register('name_first', {
                                                required: true
                                            })}
                                            className="mt-2"
                                        />
                                    </div>
                                    <div>
                                        <Label htmlFor="add-last">
                                            Last Name
                                        </Label>
                                        <Input
                                            id="add-last"
                                            placeholder="Last name"
                                            {...addForm.register('name_last', {
                                                required: true
                                            })}
                                            className="mt-2"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <Label htmlFor="add-username">
                                        Username
                                    </Label>
                                    <Input
                                        id="add-username"
                                        placeholder="Enter username for login"
                                        {...addForm.register('username', {
                                            required: true
                                        })}
                                        className="mt-2"
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="add-doc-id">
                                        Resident ID
                                    </Label>
                                    <Input
                                        id="add-doc-id"
                                        placeholder="e.g., R001"
                                        {...addForm.register('doc_id')}
                                        className="mt-2"
                                    />
                                </div>
                                {showFacilityColumn && (
                                    <div>
                                        <Label htmlFor="add-facility">
                                            Facility
                                        </Label>
                                        <Select
                                            value={
                                                addForm.watch('facility_id')
                                                    ? String(
                                                          addForm.watch(
                                                              'facility_id'
                                                          )
                                                      )
                                                    : undefined
                                            }
                                            onValueChange={(v) =>
                                                addForm.setValue(
                                                    'facility_id',
                                                    Number(v)
                                                )
                                            }
                                        >
                                            <SelectTrigger className="mt-2">
                                                <SelectValue placeholder="Select facility" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {facilities.map((f) => (
                                                    <SelectItem
                                                        key={f.id}
                                                        value={String(f.id)}
                                                    >
                                                        {f.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}
                            </div>
                            <DialogFooter className="pt-4">
                                <Button
                                    variant="outline"
                                    type="button"
                                    onClick={() => setAddDialogOpen(false)}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="submit"
                                    disabled={!isFormValid}
                                    className="bg-[#556830] hover:bg-[#203622]"
                                >
                                    Add Resident
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>

                {/* Action Dialogs */}
                {selectedUser && (
                    <>
                        <EditResidentDialog
                            open={editOpen}
                            onOpenChange={setEditOpen}
                            resident={selectedUser}
                            onSuccess={handleMutate}
                        />
                        <ResetPasswordConfirmDialog
                            open={resetConfirmOpen}
                            onOpenChange={setResetConfirmOpen}
                            resident={selectedUser}
                            onSuccess={handleResetSuccess}
                        />
                        <ResetPasswordResultDialog
                            open={resetResultOpen}
                            onOpenChange={setResetResultOpen}
                            residentName={`${selectedUser.name_first} ${selectedUser.name_last}`}
                            tempPassword={tempPassword}
                        />
                        <DeactivateDialog
                            open={deactivateOpen}
                            onOpenChange={setDeactivateOpen}
                            resident={selectedUser}
                            onSuccess={handleMutate}
                        />
                        <DeleteDialog
                            open={deleteOpen}
                            onOpenChange={setDeleteOpen}
                            resident={selectedUser}
                            onSuccess={handleMutate}
                        />
                        {showFacilityColumn && (
                            <TransferDialog
                                open={transferOpen}
                                onOpenChange={setTransferOpen}
                                resident={selectedUser}
                                facilities={facilities}
                                onSuccess={handleMutate}
                            />
                        )}
                    </>
                )}

                {/* Bulk Action Dialogs */}
                <BulkResetPasswordDialog
                    open={bulkResetOpen}
                    onOpenChange={setBulkResetOpen}
                    residents={getSelectedUsers()}
                    onSuccess={handleBulkSuccess}
                />
                <BulkDeactivateDialog
                    open={bulkDeactivateOpen}
                    onOpenChange={setBulkDeactivateOpen}
                    residents={getSelectedUsers()}
                    onSuccess={handleBulkSuccess}
                />
                <BulkDeleteDialog
                    open={bulkDeleteOpen}
                    onOpenChange={setBulkDeleteOpen}
                    residents={getSelectedUsers()}
                    onSuccess={handleBulkSuccess}
                />
                <BulkImportDialog
                    open={bulkImportOpen}
                    onOpenChange={setBulkImportOpen}
                    onSuccess={() => void mutate()}
                />

                {/* Bulk Action Bar */}
                {selectedResidents.size > 0 && (
                    <div className="fixed bottom-6 left-0 right-0 z-50 flex justify-center pointer-events-none">
                    <div className="bg-[#E2E7EA] border border-gray-400 rounded-lg shadow-lg px-6 py-4 pointer-events-auto">
                        <div className="flex items-center gap-6">
                            <div className="text-sm">
                                <span className="font-semibold text-[#203622]">
                                    {selectedResidents.size}
                                </span>
                                <span className="text-gray-600 ml-1">
                                    {selectedResidents.size === 1
                                        ? 'resident'
                                        : 'residents'}{' '}
                                    selected
                                </span>
                            </div>
                            <div className="flex gap-3">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                        setSelectedResidents(new Set())
                                    }
                                >
                                    Clear Selection
                                </Button>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setBulkResetOpen(true)}
                                >
                                    <KeyRound className="size-4 mr-2" />
                                    Reset Passwords
                                </Button>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() =>
                                        setBulkDeactivateOpen(true)
                                    }
                                    className="text-orange-600 border-orange-300 hover:bg-orange-50"
                                >
                                    <UserX className="size-4 mr-2" />
                                    Deactivate
                                </Button>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setBulkDeleteOpen(true)}
                                    className="text-red-600 border-red-300 hover:bg-red-50"
                                >
                                    <UsersIcon className="size-4 mr-2" />
                                    Delete
                                </Button>
                            </div>
                        </div>
                    </div>
                    </div>
                )}
        </div>
    );
}
