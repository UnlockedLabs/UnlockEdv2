import { useEffect, useMemo, useState } from 'react';
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
import { useToast } from '@/contexts/ToastContext';
import API from '@/api/api';
import { UserRole } from '@/types/user';
import {
    User,
    Facility,
    ServerResponseMany,
    ServerResponseOne,
    NewUserResponse,
    ResetPasswordResponse,
    ToastState
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
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog';
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

interface AdminFormData {
    name_first: string;
    name_last: string;
    username: string;
    email: string;
    role: UserRole;
    facility_id: number | null;
}

const emptyForm: AdminFormData = {
    name_first: '',
    name_last: '',
    username: '',
    email: '',
    role: UserRole.FacilityAdmin,
    facility_id: null
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
            <Badge className="bg-[#203622] text-white border-[#203622]">
                System Admin
            </Badge>
        );
    }
    if (role === UserRole.DepartmentAdmin) {
        return (
            <Badge className="bg-[#556830] text-white border-[#556830]">
                Department Admin
            </Badge>
        );
    }
    return (
        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300">
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
    const { toaster } = useToast();
    const canManageDeptAdmins = !!user && isSysAdmin(user);
    const canSwitchFac = !!user && canSwitchFacility(user);

    const [searchQuery, setSearchQuery] = useState('');
    const [sortColumn, setSortColumn] = useState<SortColumn>('name');
    const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
    const [facilityFilter, setFacilityFilter] = useState<string>('all');

    const { page, perPage, setPage, setPerPage } = useUrlPagination();

    const [selectedAdmins, setSelectedAdmins] = useState<Map<number, User>>(new Map());

    useEffect(() => {
        setSelectedAdmins(new Map());
    }, [searchQuery, facilityFilter, sortColumn, sortDirection]);

    const [showAddAdmin, setShowAddAdmin] = useState(false);
    const [showEditAdmin, setShowEditAdmin] = useState(false);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [showResetPassword, setShowResetPassword] = useState(false);
    const [selectedAdmin, setSelectedAdmin] = useState<User | null>(null);
    const [tempPassword, setTempPassword] = useState('');
    const [passwordCopied, setPasswordCopied] = useState(false);
    const [passwordModalContext, setPasswordModalContext] = useState<'create' | 'reset'>('reset');

    const [showBulkResetPassword, setShowBulkResetPassword] = useState(false);
    const [showBulkDelete, setShowBulkDelete] = useState(false);

    const [formData, setFormData] = useState<AdminFormData>(emptyForm);
    const [deleteConfirmUsername, setDeleteConfirmUsername] = useState('');

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
    }, [user, searchQuery, page, perPage, sortColumn, sortDirection, canSwitchFac, facilityFilter]);

    const { data, mutate, error, isLoading } = useSWR<ServerResponseMany<User>, Error>(usersUrl);
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
    const { data: statsResp, mutate: mutateStats } = useSWR<ServerResponseMany<User>, Error>(statsUrl);
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
    const facilities = facilitiesResp?.data ?? [];

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
        setFormData({
            ...emptyForm,
            role: canManageDeptAdmins ? UserRole.DepartmentAdmin : UserRole.FacilityAdmin,
            facility_id: user?.facility_id ?? null
        });
        setShowAddAdmin(true);
    };

    const openEditDialog = (admin: User) => {
        setSelectedAdmin(admin);
        setFormData({
            name_first: admin.name_first,
            name_last: admin.name_last,
            username: admin.username,
            email: admin.email,
            role: admin.role,
            facility_id: admin.facility_id ?? null
        });
        setShowEditAdmin(true);
    };

    const handleAddAdmin = async () => {
        if (!formData.name_first.trim() || !formData.name_last.trim() || !formData.username.trim()) {
            toaster('First name, last name, and username are required', ToastState.error);
            return;
        }
        const payload = {
            user: {
                name_first: formData.name_first,
                name_last: formData.name_last,
                username: formData.username,
                email: formData.email,
                role: formData.role,
                facility_id: formData.facility_id ?? 0
            },
            provider_platforms: []
        };
        const response = (await API.post<NewUserResponse, object>(
            'users',
            payload
        )) as ServerResponseOne<NewUserResponse>;
        if (response.success) {
            toaster(
                `Admin ${formData.name_first} ${formData.name_last} added successfully`,
                ToastState.success
            );
            setShowAddAdmin(false);
            setTempPassword(response.data.temp_password);
            setPasswordCopied(false);
            setPasswordModalContext('create');
            setShowResetPassword(true);
            setSelectedAdmin(response.data.user);
            void mutate();
            void mutateStats();
        } else {
            toaster(response.message || 'Failed to create administrator', ToastState.error);
        }
    };

    const handleEditAdmin = async () => {
        if (!selectedAdmin) return;
        const payload = {
            name_first: formData.name_first,
            name_last: formData.name_last,
            username: formData.username,
            email: formData.email,
            ...(canSwitchFac && formData.role === UserRole.FacilityAdmin && formData.facility_id
                ? { facility_id: formData.facility_id }
                : {})
        };
        const response = await API.patch<User, object>(
            `users/${selectedAdmin.id}`,
            payload
        );
        if (response.success) {
            toaster(
                `${selectedAdmin.name_first} ${selectedAdmin.name_last}'s profile updated`,
                ToastState.success
            );
            setShowEditAdmin(false);
            setSelectedAdmin(null);
            void mutate();
            void mutateStats();
        } else {
            toaster(response.message || 'Failed to update administrator', ToastState.error);
        }
    };

    const handleResetPassword = async (admin: User) => {
        setSelectedAdmin(admin);
        const response = (await API.post<ResetPasswordResponse, object>(
            `users/${admin.id}/student-password`,
            {}
        )) as ServerResponseOne<ResetPasswordResponse>;
        if (response.success) {
            setTempPassword(response.data.temp_password);
            setPasswordCopied(false);
            setPasswordModalContext('reset');
            setShowResetPassword(true);
            toaster(
                `Password reset for ${admin.name_first} ${admin.name_last}`,
                ToastState.success
            );
        } else {
            toaster('Failed to reset password', ToastState.error);
        }
    };

    const handleDelete = async () => {
        if (!selectedAdmin) return;
        if (selectedAdmin.role === UserRole.SystemAdmin) {
            toaster('System administrators cannot be deleted', ToastState.error);
            return;
        }
        const response = await API.delete(`users/${selectedAdmin.id}`);
        if (response.success) {
            toaster(
                `${selectedAdmin.name_first} ${selectedAdmin.name_last} deleted`,
                ToastState.success
            );
            setShowDeleteDialog(false);
            setDeleteConfirmUsername('');
            setSelectedAdmin(null);
            void mutate();
            void mutateStats();
        } else {
            toaster(response.message || 'Failed to delete administrator', ToastState.error);
        }
    };

    const copyToClipboard = (text: string) => {
        if (navigator.clipboard?.writeText) {
            navigator.clipboard
                .writeText(text)
                .then(() => {
                    setPasswordCopied(true);
                    setTimeout(() => setPasswordCopied(false), 2000);
                })
                .catch(() => {
                    toaster('Failed to copy password', ToastState.error);
                });
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
                        <h1 className="text-[#203622]">Admin Management</h1>
                        <p className="text-gray-600 mt-1">
                            Manage administrator accounts and permissions
                        </p>
                    </div>
                    <Button
                        onClick={openAddDialog}
                        className="gap-2 bg-[#556830] hover:bg-[#203622] text-white"
                    >
                        <Plus className="size-4" />
                        Add Admin
                    </Button>
                </div>
            </div>

            {/* Filters */}
            <div className="mb-6 flex gap-4">
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 size-5" />
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
                                <SelectItem key={facility.id} value={String(facility.id)}>
                                    {facility.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                )}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-white rounded-lg border border-gray-200 p-4">
                    <div className="text-sm text-gray-600 mb-1">Total Admins</div>
                    <div className="text-2xl font-medium text-[#203622]">{totalAdmins}</div>
                </div>
                <div className="bg-white rounded-lg border border-gray-200 p-4">
                    <div className="text-sm text-gray-600 mb-1">Department Admins</div>
                    <div className="text-2xl font-medium text-[#556830]">{deptAdminCount}</div>
                </div>
                <div className="bg-white rounded-lg border border-gray-200 p-4">
                    <div className="text-sm text-gray-600 mb-1">Facility Admins</div>
                    <div className="text-2xl font-medium text-blue-700">{facilityAdminCount}</div>
                </div>
            </div>

            {/* Bulk action bar */}
            {selectedAdmins.size > 0 && (
                <div className="fixed bottom-6 left-[calc(50%-7px)] -translate-x-1/2 bg-[#E2E7EA] border border-gray-400 rounded-lg shadow-lg px-6 py-4 z-50">
                    <div className="flex items-center gap-6">
                        <div className="text-sm">
                            <span className="font-semibold text-[#203622]">
                                {selectedAdmins.size}
                            </span>
                            <span className="text-gray-600 ml-1">
                                {selectedAdmins.size === 1 ? 'admin' : 'admins'} selected
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
            <div className="bg-white rounded-lg border border-gray-200">
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
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {error ? (
                            <TableRow>
                                <TableCell colSpan={7} className="h-32 text-center text-destructive">
                                    Failed to load administrators.
                                </TableCell>
                            </TableRow>
                        ) : isLoading ? (
                            <TableRow>
                                <TableCell colSpan={7} className="h-32 text-center text-gray-500">
                                    Loading administrators...
                                </TableCell>
                            </TableRow>
                        ) : admins.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="h-32">
                                    <div className="flex flex-col items-center gap-2">
                                        <Users className="size-12 text-gray-300" />
                                        <p className="text-gray-500">No admins found</p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : (
                            admins.map((admin) => (
                                <TableRow key={admin.id} className="hover:bg-gray-50">
                                    <TableCell>
                                        <Checkbox
                                            checked={selectedAdmins.has(admin.id)}
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
                                    <TableCell>{getRoleBadge(admin.role)}</TableCell>
                                    <TableCell className="text-sm text-gray-600">
                                        {facilityNameFor(admin)}
                                    </TableCell>
                                    <TableCell className="text-sm text-gray-600">
                                        {formatLastActive(admin.login_metrics?.last_login)}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => openEditDialog(admin)}
                                                className="h-8 w-8 p-0"
                                                title="Edit admin"
                                            >
                                                <Edit className="size-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => void handleResetPassword(admin)}
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
                                                        <span className="sr-only">More actions</span>
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="w-48">
                                                    <DropdownMenuItem
                                                        onClick={() => {
                                                            setSelectedAdmin(admin);
                                                            setDeleteConfirmUsername('');
                                                            setShowDeleteDialog(true);
                                                        }}
                                                        className="text-red-600"
                                                        disabled={admin.role === UserRole.SystemAdmin}
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
            <Dialog open={showAddAdmin} onOpenChange={setShowAddAdmin}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add New Admin</DialogTitle>
                        <DialogDescription>
                            Create a new administrator account
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="firstName">First Name</Label>
                                <Input
                                    id="firstName"
                                    value={formData.name_first}
                                    onChange={(e) =>
                                        setFormData({ ...formData, name_first: e.target.value })
                                    }
                                    placeholder="John"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="lastName">Last Name</Label>
                                <Input
                                    id="lastName"
                                    value={formData.name_last}
                                    onChange={(e) =>
                                        setFormData({ ...formData, name_last: e.target.value })
                                    }
                                    placeholder="Doe"
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="username">Username</Label>
                            <Input
                                id="username"
                                value={formData.username}
                                onChange={(e) =>
                                    setFormData({ ...formData, username: e.target.value })
                                }
                                placeholder="jdoe"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="role">Role</Label>
                            <Select
                                value={formData.role}
                                onValueChange={(value) =>
                                    setFormData({
                                        ...formData,
                                        role: value as UserRole
                                    })
                                }
                            >
                                <SelectTrigger id="role">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={UserRole.DepartmentAdmin}>
                                        Department Admin
                                    </SelectItem>
                                    <SelectItem value={UserRole.FacilityAdmin}>
                                        Facility Admin
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        {formData.role === UserRole.FacilityAdmin && (
                            <div className="space-y-2">
                                <Label htmlFor="facility">Facility</Label>
                                {canSwitchFac ? (
                                    <Select
                                        value={
                                            formData.facility_id
                                                ? String(formData.facility_id)
                                                : ''
                                        }
                                        onValueChange={(value) =>
                                            setFormData({
                                                ...formData,
                                                facility_id: Number(value)
                                            })
                                        }
                                    >
                                        <SelectTrigger id="facility">
                                            <SelectValue placeholder="Select facility" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {facilities.map((facility) => (
                                                <SelectItem key={facility.id} value={String(facility.id)}>
                                                    {facility.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                ) : (
                                    <div className="border border-gray-300 rounded-md px-3 py-2 bg-gray-50">
                                        {user?.facility?.name ?? '—'}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowAddAdmin(false)}>
                            Cancel
                        </Button>
                        <Button
                            onClick={() => void handleAddAdmin()}
                            className="bg-[#556830] hover:bg-[#203622] text-white"
                        >
                            Add Admin
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit Admin Dialog */}
            <Dialog open={showEditAdmin} onOpenChange={setShowEditAdmin}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit Admin</DialogTitle>
                        <DialogDescription>Update administrator information</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="edit-firstName">First Name</Label>
                                <Input
                                    id="edit-firstName"
                                    value={formData.name_first}
                                    onChange={(e) =>
                                        setFormData({ ...formData, name_first: e.target.value })
                                    }
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="edit-lastName">Last Name</Label>
                                <Input
                                    id="edit-lastName"
                                    value={formData.name_last}
                                    onChange={(e) =>
                                        setFormData({ ...formData, name_last: e.target.value })
                                    }
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="edit-username">Username</Label>
                            <div className="border border-gray-300 rounded-md px-3 py-2 bg-gray-50">
                                {formData.username}
                            </div>
                            <p className="text-xs text-gray-500">
                                Usernames cannot be changed after account creation
                            </p>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="edit-role">Role</Label>
                            <div className="border border-gray-300 rounded-md px-3 py-2 bg-gray-50">
                                {getRoleLabel(formData.role)}
                            </div>
                            <p className="text-xs text-gray-500">
                                Role cannot be changed after account creation
                            </p>
                        </div>
                        {formData.role === UserRole.FacilityAdmin && (
                            <div className="space-y-2">
                                <Label htmlFor="edit-facility">Facility</Label>
                                {canSwitchFac ? (
                                    <Select
                                        value={
                                            formData.facility_id
                                                ? String(formData.facility_id)
                                                : ''
                                        }
                                        onValueChange={(value) =>
                                            setFormData({
                                                ...formData,
                                                facility_id: Number(value)
                                            })
                                        }
                                    >
                                        <SelectTrigger id="edit-facility">
                                            <SelectValue placeholder="Select facility" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {facilities.map((facility) => (
                                                <SelectItem key={facility.id} value={String(facility.id)}>
                                                    {facility.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                ) : (
                                    <div className="border border-gray-300 rounded-md px-3 py-2 bg-gray-50">
                                        {selectedAdmin?.facility?.name ??
                                            facilityById.get(formData.facility_id ?? 0)?.name ??
                                            user?.facility?.name ??
                                            '—'}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowEditAdmin(false)}>
                            Cancel
                        </Button>
                        <Button
                            onClick={() => void handleEditAdmin()}
                            className="bg-[#556830] hover:bg-[#203622] text-white"
                        >
                            Save Changes
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Reset Password / New Password Dialog */}
            <Dialog
                open={showResetPassword}
                onOpenChange={(open) => {
                    setShowResetPassword(open);
                    if (!open) {
                        setTempPassword('');
                        setSelectedAdmin(null);
                    }
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {passwordModalContext === 'create' ? 'New Password' : 'Password Reset'}
                        </DialogTitle>
                        <DialogDescription>
                            New temporary password for {selectedAdmin?.name_first}{' '}
                            {selectedAdmin?.name_last}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <div className="bg-gray-100 rounded-lg p-4 border border-gray-300">
                            <div className="text-sm text-gray-600 mb-2">Temporary Password</div>
                            <div className="flex items-center gap-2">
                                <code className="flex-1 text-lg font-mono font-semibold text-[#203622] select-all">
                                    {tempPassword}
                                </code>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => copyToClipboard(tempPassword)}
                                >
                                    {passwordCopied ? 'Copied!' : 'Copy'}
                                </Button>
                            </div>
                        </div>
                        <p className="text-sm text-gray-600 mt-4">
                            Share this password securely with the administrator. They will be
                            prompted to change it on their next login.
                        </p>
                    </div>
                    <DialogFooter>
                        <Button
                            onClick={() => setShowResetPassword(false)}
                            className="bg-[#556830] hover:bg-[#203622] text-white"
                        >
                            Done
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Dialog */}
            <Dialog
                open={showDeleteDialog}
                onOpenChange={(open) => {
                    setShowDeleteDialog(open);
                    if (!open) setDeleteConfirmUsername('');
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete Admin Account</DialogTitle>
                        <DialogDescription>This action cannot be undone.</DialogDescription>
                    </DialogHeader>
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4 my-4">
                        <p className="text-sm text-red-900 mb-3">
                            Permanently delete {selectedAdmin?.name_first}{' '}
                            {selectedAdmin?.name_last}'s account? All associated data will be
                            removed.
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
                                value={deleteConfirmUsername}
                                onChange={(e) => setDeleteConfirmUsername(e.target.value)}
                                placeholder={selectedAdmin?.username}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
                            Cancel
                        </Button>
                        <Button
                            onClick={() => void handleDelete()}
                            disabled={deleteConfirmUsername !== selectedAdmin?.username}
                            className="bg-red-600 hover:bg-red-700 text-white"
                        >
                            Delete Admin
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

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
