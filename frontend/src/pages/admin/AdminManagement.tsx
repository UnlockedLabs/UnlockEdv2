import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useUrlPagination } from '@/hooks/useUrlPagination';
import useSWR from 'swr';
import {
    Search,
    Plus,
    Edit,
    MoreVertical,
    Users,
    ArrowUpDown,
    KeyRound
} from 'lucide-react';
import { useAuth, isSysAdmin, canSwitchFacility } from '@/auth/useAuth';
import { toast } from 'sonner';
import API from '@/api/api';
import { UserRole } from '@/types/user';
import {
    User,
    Facility,
    ServerResponseMany,
    ServerResponseOne,
    NewUserResponse
} from '@/types';
import {
    BulkResetPasswordDialog,
    BulkDeleteDialog
} from '@/components/residents/BulkActionDialogs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@/components/ui/table';
import { DialogFooter } from '@/components/ui/dialog';
import { FormModal, TonedPanel, ResetPasswordModal } from '@/components/shared';
import { useTypeToConfirm } from '@/components/shared/useTypeToConfirm';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage
} from '@/components/ui/form';
import {
    buildAdminAddSchema,
    buildAdminEditSchema,
    AdminAddInput,
    AdminEditInput
} from '@/lib/validation';
import { Pagination } from '@/components/Pagination';

type SortColumn = 'name' | 'username' | 'role' | 'facility' | 'lastActive';
type SortDirection = 'asc' | 'desc';

const SORT_FIELD: Record<SortColumn, string> = {
    name: 'name_last',
    username: 'username',
    role: 'role',
    facility: 'facility_name',
    lastActive: 'last_login'
};

function formatLastActive(dateString?: string | null) {
    if (!dateString) return '—';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return '1 day ago';
    if (diffDays < 7) return `${diffDays} days ago`;

    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });
}

function getRoleBadge(role: UserRole) {
    if (role === UserRole.SystemAdmin) {
        return (
            <Badge className="bg-brand-dark text-white border-brand-dark">
                System Admin
            </Badge>
        );
    }
    if (role === UserRole.DepartmentAdmin) {
        return (
            <Badge className="bg-brand text-white border-brand">
                Department Admin
            </Badge>
        );
    }
    return (
        <Badge
            variant="outline"
            className="bg-blue-50 text-blue-700 border-blue-300"
        >
            Facility Admin
        </Badge>
    );
}

function getRoleLabel(role: UserRole) {
    switch (role) {
        case UserRole.SystemAdmin:
            return 'System Admin';
        case UserRole.DepartmentAdmin:
            return 'Department Admin';
        case UserRole.FacilityAdmin:
            return 'Facility Admin';
        default:
            return 'Admin';
    }
}

export default function AdminManagement() {
    const { user } = useAuth();
    const canManageDeptAdmins = !!user && isSysAdmin(user);
    const canSwitchFac = !!user && canSwitchFacility(user);

    const [searchQuery, setSearchQuery] = useState('');
    const [sortColumn, setSortColumn] = useState<SortColumn>('name');
    const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
    const [facilityFilter, setFacilityFilter] = useState<string>('all');

    const { page, perPage, setPage, setPerPage } = useUrlPagination();

    const [selectedAdmins, setSelectedAdmins] = useState<Map<number, User>>(
        new Map()
    );

    useEffect(() => {
        setSelectedAdmins(new Map());
    }, [searchQuery, facilityFilter, sortColumn, sortDirection]);

    const [showAddAdmin, setShowAddAdmin] = useState(false);
    const [showEditAdmin, setShowEditAdmin] = useState(false);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [showResetPassword, setShowResetPassword] = useState(false);
    const [selectedAdmin, setSelectedAdmin] = useState<User | null>(null);
    const [tempPassword, setTempPassword] = useState('');
    const [passwordModalContext, setPasswordModalContext] = useState<
        'create' | 'reset'
    >('reset');

    const [showBulkResetPassword, setShowBulkResetPassword] = useState(false);
    const [showBulkDelete, setShowBulkDelete] = useState(false);

    const addResolver = useMemo(
        () => zodResolver(buildAdminAddSchema(canSwitchFac)),
        [canSwitchFac]
    );
    const addForm = useForm<AdminAddInput>({
        resolver: addResolver,
        defaultValues: {
            name_first: '',
            name_last: '',
            username: '',
            role: UserRole.FacilityAdmin,
            facility_id: ''
        }
    });
    const addRole = addForm.watch('role');

    const editRequireFacility =
        canSwitchFac && selectedAdmin?.role === UserRole.FacilityAdmin;
    const editResolver = useMemo(
        () => zodResolver(buildAdminEditSchema(editRequireFacility)),
        [editRequireFacility]
    );
    const editForm = useForm<AdminEditInput>({
        resolver: editResolver,
        defaultValues: { name_first: '', name_last: '', facility_id: '' }
    });

    const deleteConfirm = useTypeToConfirm({
        open: showDeleteDialog,
        expected: selectedAdmin?.username ?? ''
    });

    const usersUrl = useMemo(() => {
        if (!user) return null;
        const params = new URLSearchParams({
            search: searchQuery,
            page: String(page),
            per_page: String(perPage),
            order_by: `${SORT_FIELD[sortColumn]} ${sortDirection}`,
            role: user.role
        });
        if (canSwitchFac && facilityFilter !== 'all') {
            params.set('facility_id', facilityFilter);
        }
        return `/api/users?${params.toString()}`;
    }, [
        user,
        searchQuery,
        page,
        perPage,
        sortColumn,
        sortDirection,
        canSwitchFac,
        facilityFilter
    ]);

    const { data, mutate, error, isLoading } = useSWR<
        ServerResponseMany<User>,
        Error
    >(usersUrl);
    const admins = data?.data ?? [];
    const totalItems = data?.meta?.total ?? 0;

    // Per-role counts can't come from the paginated fetch, and the API doesn't
    // filter by a target role server-side. Fetch the full admin set just for the
    // stat cards. Admin counts are small in practice.
    // TODO: per_page=500 is a hard ceiling; deptAdminCount/facilityAdminCount
    // will undercount past 500 admins. Replace with a dedicated
    // /api/users/admin-stats endpoint (mirrors /api/users/stats for residents).
    const statsUrl = useMemo(() => {
        if (!user) return null;
        const params = new URLSearchParams({
            role: user.role,
            per_page: '500'
        });
        if (canSwitchFac && facilityFilter !== 'all') {
            params.set('facility_id', facilityFilter);
        }
        return `/api/users?${params.toString()}`;
    }, [user, canSwitchFac, facilityFilter]);
    const { data: statsResp, mutate: mutateStats } = useSWR<
        ServerResponseMany<User>,
        Error
    >(statsUrl);
    const allAdmins = statsResp?.data ?? [];
    const totalAdmins = statsResp?.meta?.total ?? allAdmins.length;
    const deptAdminCount = allAdmins.filter(
        (a) => a.role === UserRole.DepartmentAdmin
    ).length;
    const facilityAdminCount = allAdmins.filter(
        (a) => a.role === UserRole.FacilityAdmin
    ).length;

    const { data: facilitiesResp } = useSWR<ServerResponseMany<Facility>>(
        canSwitchFac ? '/api/facilities' : null
    );
    const facilities = useMemo(
        () => facilitiesResp?.data ?? [],
        [facilitiesResp]
    );

    const facilityById = useMemo(() => {
        const map = new Map<number, Facility>();
        for (const f of facilities) map.set(f.id, f);
        if (user?.facility) map.set(user.facility.id, user.facility);
        return map;
    }, [facilities, user]);

    const toggleSort = (column: SortColumn) => {
        if (sortColumn === column) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortColumn(column);
            setSortDirection('asc');
        }
        setPage(1);
    };

    const allOnPageSelected =
        admins.length > 0 && admins.every((a) => selectedAdmins.has(a.id));

    const toggleSelectAll = () => {
        setSelectedAdmins((prev) => {
            const next = new Map(prev);
            if (allOnPageSelected) {
                admins.forEach((a) => next.delete(a.id));
            } else {
                admins.forEach((a) => next.set(a.id, a));
            }
            return next;
        });
    };

    const toggleSelectAdmin = (admin: User) => {
        setSelectedAdmins((prev) => {
            const next = new Map(prev);
            if (next.has(admin.id)) next.delete(admin.id);
            else next.set(admin.id, admin);
            return next;
        });
    };

    const openAddDialog = () => {
        addForm.reset({
            name_first: '',
            name_last: '',
            username: '',
            role: canManageDeptAdmins
                ? UserRole.DepartmentAdmin
                : UserRole.FacilityAdmin,
            facility_id: user?.facility_id ? String(user.facility_id) : ''
        });
        setShowAddAdmin(true);
    };

    const openEditDialog = (admin: User) => {
        setSelectedAdmin(admin);
        editForm.reset({
            name_first: admin.name_first,
            name_last: admin.name_last,
            facility_id: admin.facility_id ? String(admin.facility_id) : ''
        });
        setShowEditAdmin(true);
    };

    const handleAddAdmin = async (data: AdminAddInput) => {
        const payload = {
            user: {
                name_first: data.name_first,
                name_last: data.name_last,
                username: data.username,
                email: '',
                role: data.role,
                facility_id: data.facility_id ? Number(data.facility_id) : 0
            },
            provider_platforms: []
        };
        const response = (await API.post<NewUserResponse, object>(
            'users',
            payload
        )) as ServerResponseOne<NewUserResponse>;
        if (response.success) {
            toast.success(
                `Admin ${data.name_first} ${data.name_last} added successfully`
            );
            setShowAddAdmin(false);
            setTempPassword(response.data.temp_password);
            setPasswordModalContext('create');
            setShowResetPassword(true);
            setSelectedAdmin(response.data.user);
            void mutate();
            void mutateStats();
        } else {
            toast.error(response.message || 'Failed to create administrator');
        }
    };

    const handleEditAdmin = async (data: AdminEditInput) => {
        if (!selectedAdmin) return;
        const payload = {
            name_first: data.name_first,
            name_last: data.name_last,
            username: selectedAdmin.username,
            email: selectedAdmin.email,
            ...(canSwitchFac &&
            selectedAdmin.role === UserRole.FacilityAdmin &&
            data.facility_id
                ? { facility_id: Number(data.facility_id) }
                : {})
        };
        const response = await API.patch<User, object>(
            `users/${selectedAdmin.id}`,
            payload
        );
        if (response.success) {
            toast.success(
                `${selectedAdmin.name_first} ${selectedAdmin.name_last}'s profile updated`
            );
            setShowEditAdmin(false);
            setSelectedAdmin(null);
            void mutate();
            void mutateStats();
        } else {
            toast.error(response.message || 'Failed to update administrator');
        }
    };

    const handleResetPassword = (admin: User) => {
        setSelectedAdmin(admin);
        setTempPassword('');
        setPasswordModalContext('reset');
        setShowResetPassword(true);
    };

    const handleDelete = async () => {
        if (!selectedAdmin) return;
        if (selectedAdmin.role === UserRole.SystemAdmin) {
            toast.error('System administrators cannot be deleted');
            return;
        }
        const response = await API.delete(`users/${selectedAdmin.id}`);
        if (response.success) {
            toast.success(
                `${selectedAdmin.name_first} ${selectedAdmin.name_last} deleted`
            );
            setShowDeleteDialog(false);
            setSelectedAdmin(null);
            void mutate();
            void mutateStats();
        } else {
            toast.error(response.message || 'Failed to delete administrator');
        }
    };

    const facilityNameFor = (admin: User) => {
        if (admin.facility?.name) return admin.facility.name;
        const f = facilityById.get(admin.facility_id);
        return f?.name ?? '—';
    };

    return (
        <div className="max-w-7xl mx-auto px-6 py-8">
            {/* Header */}
            <div className="mb-8">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-brand-dark">Admin Management</h1>
                        <p className="text-gray-600 mt-1">
                            Manage administrator accounts and permissions
                        </p>
                    </div>
                    <Button
                        onClick={openAddDialog}
                        className="gap-2 bg-brand hover:bg-brand-dark text-white"
                    >
                        <Plus className="size-4" />
                        Add Admin
                    </Button>
                </div>
            </div>

            {/* Filters */}
            <div className="mb-6 flex gap-4">
                <div className="flex-1 relative">
                    <Search className="input-icon-left size-5" />
                    <Input
                        placeholder="Search by name or username..."
                        value={searchQuery}
                        onChange={(e) => {
                            setSearchQuery(e.target.value);
                            setPage(1);
                        }}
                        className="pl-10"
                    />
                </div>
                {canSwitchFac && (
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
                            <SelectItem value="all">All Facilities</SelectItem>
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
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="card-block p-4">
                    <div className="text-sm text-gray-600 mb-1">
                        Total Admins
                    </div>
                    <div className="text-2xl font-medium text-brand-dark">
                        {totalAdmins}
                    </div>
                </div>
                <div className="card-block p-4">
                    <div className="text-sm text-gray-600 mb-1">
                        Department Admins
                    </div>
                    <div className="text-2xl font-medium text-brand">
                        {deptAdminCount}
                    </div>
                </div>
                <div className="card-block p-4">
                    <div className="text-sm text-gray-600 mb-1">
                        Facility Admins
                    </div>
                    <div className="text-2xl font-medium text-blue-700">
                        {facilityAdminCount}
                    </div>
                </div>
            </div>

            {/* Bulk action bar */}
            {selectedAdmins.size > 0 && (
                <div className="fixed bottom-6 left-[calc(50%-7px)] -translate-x-1/2 bg-surface-hover border border-gray-400 rounded-lg shadow-lg px-6 py-4 z-50">
                    <div className="flex items-center gap-6">
                        <div className="text-sm">
                            <span className="font-semibold text-brand-dark">
                                {selectedAdmins.size}
                            </span>
                            <span className="text-gray-600 ml-1">
                                {selectedAdmins.size === 1 ? 'admin' : 'admins'}{' '}
                                selected
                            </span>
                        </div>
                        <div className="flex gap-3">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setSelectedAdmins(new Map())}
                            >
                                Clear Selection
                            </Button>
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setShowBulkResetPassword(true)}
                            >
                                <KeyRound className="size-4 mr-2" />
                                Reset Passwords
                            </Button>
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setShowBulkDelete(true)}
                                className="text-red-600 border-red-300 hover:bg-red-50"
                            >
                                Delete
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Table */}
            <div className="card-block">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-12">
                                <Checkbox
                                    checked={allOnPageSelected}
                                    onCheckedChange={toggleSelectAll}
                                    aria-label="Select all admins"
                                />
                            </TableHead>
                            <TableHead
                                className="cursor-pointer"
                                onClick={() => toggleSort('name')}
                            >
                                <div className="flex items-center gap-1">
                                    Name
                                    <ArrowUpDown className="size-4" />
                                </div>
                            </TableHead>
                            <TableHead
                                className="cursor-pointer"
                                onClick={() => toggleSort('username')}
                            >
                                <div className="flex items-center gap-1">
                                    Username
                                    <ArrowUpDown className="size-4" />
                                </div>
                            </TableHead>
                            <TableHead
                                className="cursor-pointer"
                                onClick={() => toggleSort('role')}
                            >
                                <div className="flex items-center gap-1">
                                    Role
                                    <ArrowUpDown className="size-4" />
                                </div>
                            </TableHead>
                            <TableHead
                                className="cursor-pointer"
                                onClick={() => toggleSort('facility')}
                            >
                                <div className="flex items-center gap-1">
                                    Facility
                                    <ArrowUpDown className="size-4" />
                                </div>
                            </TableHead>
                            <TableHead
                                className="cursor-pointer"
                                onClick={() => toggleSort('lastActive')}
                            >
                                <div className="flex items-center gap-1">
                                    Last Active
                                    <ArrowUpDown className="size-4" />
                                </div>
                            </TableHead>
                            <TableHead className="text-right">
                                Actions
                            </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {error ? (
                            <TableRow>
                                <TableCell
                                    colSpan={7}
                                    className="h-32 text-center text-destructive"
                                >
                                    Failed to load administrators.
                                </TableCell>
                            </TableRow>
                        ) : isLoading ? (
                            <TableRow>
                                <TableCell
                                    colSpan={7}
                                    className="h-32 text-center text-gray-500"
                                >
                                    Loading administrators...
                                </TableCell>
                            </TableRow>
                        ) : admins.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="h-32">
                                    <div className="flex flex-col items-center gap-2">
                                        <Users className="size-12 text-gray-300" />
                                        <p className="text-gray-500">
                                            No admins found
                                        </p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : (
                            admins.map((admin) => (
                                <TableRow
                                    key={admin.id}
                                    className="hover:bg-gray-50"
                                >
                                    <TableCell>
                                        <Checkbox
                                            checked={selectedAdmins.has(
                                                admin.id
                                            )}
                                            onCheckedChange={() =>
                                                toggleSelectAdmin(admin)
                                            }
                                            aria-label={`Select ${admin.username}`}
                                        />
                                    </TableCell>
                                    <TableCell className="font-medium">
                                        {admin.name_last}, {admin.name_first}
                                    </TableCell>
                                    <TableCell className="text-sm text-gray-600">
                                        {admin.username}
                                    </TableCell>
                                    <TableCell>
                                        {getRoleBadge(admin.role)}
                                    </TableCell>
                                    <TableCell className="text-sm text-gray-600">
                                        {facilityNameFor(admin)}
                                    </TableCell>
                                    <TableCell className="text-sm text-gray-600">
                                        {formatLastActive(
                                            admin.login_metrics?.last_login
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() =>
                                                    openEditDialog(admin)
                                                }
                                                className="h-8 w-8 p-0"
                                                title="Edit admin"
                                            >
                                                <Edit className="size-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() =>
                                                    handleResetPassword(admin)
                                                }
                                                className="h-8 w-8 p-0"
                                                title="Reset password"
                                            >
                                                <KeyRound className="size-4" />
                                            </Button>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-8 w-8 p-0"
                                                    >
                                                        <MoreVertical className="size-4" />
                                                        <span className="sr-only">
                                                            More actions
                                                        </span>
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent
                                                    align="end"
                                                    className="w-48"
                                                >
                                                    <DropdownMenuItem
                                                        onClick={() => {
                                                            setSelectedAdmin(
                                                                admin
                                                            );
                                                            setShowDeleteDialog(
                                                                true
                                                            );
                                                        }}
                                                        className="text-red-600"
                                                        disabled={
                                                            admin.role ===
                                                            UserRole.SystemAdmin
                                                        }
                                                    >
                                                        Delete Admin
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>

                <Pagination
                    totalItems={totalItems}
                    itemsPerPage={perPage}
                    currentPage={page}
                    onPageChange={setPage}
                    onItemsPerPageChange={setPerPage}
                    itemLabel="admins"
                />
            </div>

            {/* Add Admin Dialog */}
            <FormModal
                open={showAddAdmin}
                onOpenChange={setShowAddAdmin}
                title="Add New Admin"
                description="Create a new administrator account"
                titleClassName="text-foreground"
            >
                <Form {...addForm}>
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            void addForm.handleSubmit(handleAddAdmin)(e);
                        }}
                    >
                        <div className="space-y-4 py-4">
                            <div className="grid grid-cols-2 gap-4">
                                <FormField
                                    control={addForm.control}
                                    name="name_first"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>First Name</FormLabel>
                                            <FormControl>
                                                <Input
                                                    placeholder="John"
                                                    {...field}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={addForm.control}
                                    name="name_last"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Last Name</FormLabel>
                                            <FormControl>
                                                <Input
                                                    placeholder="Doe"
                                                    {...field}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                            <FormField
                                control={addForm.control}
                                name="username"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Username</FormLabel>
                                        <FormControl>
                                            <Input
                                                placeholder="jdoe"
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={addForm.control}
                                name="role"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Role</FormLabel>
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
                                                <SelectItem
                                                    value={
                                                        UserRole.DepartmentAdmin
                                                    }
                                                >
                                                    Department Admin
                                                </SelectItem>
                                                <SelectItem
                                                    value={
                                                        UserRole.FacilityAdmin
                                                    }
                                                >
                                                    Facility Admin
                                                </SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            {addRole === UserRole.FacilityAdmin && (
                                <FormField
                                    control={addForm.control}
                                    name="facility_id"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Facility</FormLabel>
                                            {canSwitchFac ? (
                                                <>
                                                    <Select
                                                        value={field.value}
                                                        onValueChange={
                                                            field.onChange
                                                        }
                                                    >
                                                        <FormControl>
                                                            <SelectTrigger>
                                                                <SelectValue placeholder="Select facility" />
                                                            </SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent>
                                                            {facilities.map(
                                                                (facility) => (
                                                                    <SelectItem
                                                                        key={
                                                                            facility.id
                                                                        }
                                                                        value={String(
                                                                            facility.id
                                                                        )}
                                                                    >
                                                                        {
                                                                            facility.name
                                                                        }
                                                                    </SelectItem>
                                                                )
                                                            )}
                                                        </SelectContent>
                                                    </Select>
                                                    <FormMessage />
                                                </>
                                            ) : (
                                                <div className="field-readonly">
                                                    {user?.facility?.name ??
                                                        '—'}
                                                </div>
                                            )}
                                        </FormItem>
                                    )}
                                />
                            )}
                        </div>
                        <DialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setShowAddAdmin(false)}
                            >
                                Cancel
                            </Button>
                            <Button type="submit" variant="brand">
                                Add Admin
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </FormModal>

            {/* Edit Admin Dialog */}
            <FormModal
                open={showEditAdmin}
                onOpenChange={setShowEditAdmin}
                title="Edit Admin"
                description="Update administrator information"
                titleClassName="text-foreground"
            >
                <Form {...editForm}>
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            void editForm.handleSubmit(handleEditAdmin)(e);
                        }}
                    >
                        <div className="space-y-4 py-4">
                            <div className="grid grid-cols-2 gap-4">
                                <FormField
                                    control={editForm.control}
                                    name="name_first"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>First Name</FormLabel>
                                            <FormControl>
                                                <Input {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={editForm.control}
                                    name="name_last"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Last Name</FormLabel>
                                            <FormControl>
                                                <Input {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Username</Label>
                                <div className="field-readonly">
                                    {selectedAdmin?.username}
                                </div>
                                <p className="text-xs text-gray-500">
                                    Usernames cannot be changed after account
                                    creation
                                </p>
                            </div>
                            <div className="space-y-2">
                                <Label>Role</Label>
                                <div className="field-readonly">
                                    {selectedAdmin
                                        ? getRoleLabel(selectedAdmin.role)
                                        : ''}
                                </div>
                                <p className="text-xs text-gray-500">
                                    Role cannot be changed after account
                                    creation
                                </p>
                            </div>
                            {selectedAdmin?.role === UserRole.FacilityAdmin && (
                                <FormField
                                    control={editForm.control}
                                    name="facility_id"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Facility</FormLabel>
                                            {canSwitchFac ? (
                                                <>
                                                    <Select
                                                        value={field.value}
                                                        onValueChange={
                                                            field.onChange
                                                        }
                                                    >
                                                        <FormControl>
                                                            <SelectTrigger>
                                                                <SelectValue placeholder="Select facility" />
                                                            </SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent>
                                                            {facilities.map(
                                                                (facility) => (
                                                                    <SelectItem
                                                                        key={
                                                                            facility.id
                                                                        }
                                                                        value={String(
                                                                            facility.id
                                                                        )}
                                                                    >
                                                                        {
                                                                            facility.name
                                                                        }
                                                                    </SelectItem>
                                                                )
                                                            )}
                                                        </SelectContent>
                                                    </Select>
                                                    <FormMessage />
                                                </>
                                            ) : (
                                                <div className="field-readonly">
                                                    {selectedAdmin?.facility
                                                        ?.name ??
                                                        facilityById.get(
                                                            selectedAdmin?.facility_id ??
                                                                0
                                                        )?.name ??
                                                        user?.facility?.name ??
                                                        '—'}
                                                </div>
                                            )}
                                        </FormItem>
                                    )}
                                />
                            )}
                        </div>
                        <DialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setShowEditAdmin(false)}
                            >
                                Cancel
                            </Button>
                            <Button type="submit" variant="brand">
                                Save Changes
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </FormModal>

            {/* Reset Password / New Password Dialog */}
            <ResetPasswordModal
                open={showResetPassword}
                onOpenChange={(open) => {
                    setShowResetPassword(open);
                    if (!open) {
                        setTempPassword('');
                        setSelectedAdmin(null);
                    }
                }}
                name={`${selectedAdmin?.name_first ?? ''} ${selectedAdmin?.name_last ?? ''}`}
                subject="administrator"
                userId={
                    passwordModalContext === 'reset'
                        ? selectedAdmin?.id
                        : undefined
                }
                presetPassword={
                    passwordModalContext === 'create' ? tempPassword : undefined
                }
                resultTitle={
                    passwordModalContext === 'create'
                        ? 'New Password'
                        : 'Password Reset'
                }
            />

            {/* Delete Dialog */}
            <FormModal
                open={showDeleteDialog}
                onOpenChange={setShowDeleteDialog}
                title="Delete Admin Account"
                description="This action cannot be undone."
                titleClassName="text-foreground"
            >
                <TonedPanel tone="red" className="my-4">
                    <p className="text-sm text-red-900 mb-3">
                        Permanently delete {selectedAdmin?.name_first}{' '}
                        {selectedAdmin?.name_last}'s account? All associated
                        data will be removed.
                    </p>
                    <div className="space-y-2">
                        <Label htmlFor="delete-confirm">
                            Type{' '}
                            <span className="font-mono font-semibold">
                                {selectedAdmin?.username}
                            </span>{' '}
                            to confirm
                        </Label>
                        <Input
                            id="delete-confirm"
                            {...deleteConfirm.inputProps}
                            placeholder={selectedAdmin?.username}
                        />
                    </div>
                </TonedPanel>
                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => setShowDeleteDialog(false)}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={() => void handleDelete()}
                        disabled={!deleteConfirm.matches}
                        className="bg-red-600 hover:bg-red-700 text-white"
                    >
                        Delete Admin
                    </Button>
                </DialogFooter>
            </FormModal>

            {/* Bulk Reset Password Dialog */}
            <BulkResetPasswordDialog
                open={showBulkResetPassword}
                onOpenChange={setShowBulkResetPassword}
                kind="admin"
                users={Array.from(selectedAdmins.values())}
                onSuccess={() => {
                    setSelectedAdmins(new Map());
                    void mutate();
                    void mutateStats();
                }}
            />

            {/* Bulk Delete Dialog */}
            <BulkDeleteDialog
                open={showBulkDelete}
                onOpenChange={setShowBulkDelete}
                kind="admin"
                users={Array.from(selectedAdmins.values())}
                onSuccess={() => {
                    setSelectedAdmins(new Map());
                    void mutate();
                    void mutateStats();
                }}
            />
        </div>
    );
}
