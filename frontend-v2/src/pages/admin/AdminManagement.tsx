import { useState, startTransition } from 'react';
import useSWR from 'swr';
import { useForm } from 'react-hook-form';
import { useAuth, isSysAdmin, isDeptAdmin, isFacilityAdmin } from '@/auth/useAuth';
import { useUrlPagination } from '@/hooks/useUrlPagination';
import { useCheckResponse } from '@/hooks/useCheckResponse';
import { useToast } from '@/contexts/ToastContext';
import API from '@/api/api';
import {
    User,
    UserRole,
    ServerResponseMany,
    ServerResponseOne,
    ResetPasswordResponse,
    NewUserResponse,
    ToastState
} from '@/types';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTable, Column } from '@/components/shared/DataTable';
import { SearchInput } from '@/components/shared/SearchInput';
import { FormModal } from '@/components/shared/FormModal';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
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
import { Plus, Pencil, RotateCcw, Trash2, MoreHorizontal, Lock, Copy } from 'lucide-react';

type SortOption = 'name_last asc' | 'name_last desc' | 'last_login desc' | 'last_login asc' | 'created_at desc' | 'created_at asc';

interface UserFormData {
    name_first: string;
    name_last: string;
    username: string;
    email: string;
}

function canEdit(currentUser: User, targetUser: User): boolean {
    return (
        isSysAdmin(currentUser) ||
        (isDeptAdmin(currentUser) && isFacilityAdmin(targetUser))
    );
}

function canDelete(currentUser: User, targetUser: User): boolean {
    return (
        (isSysAdmin(currentUser) && !isSysAdmin(targetUser)) ||
        (isDeptAdmin(currentUser) && isFacilityAdmin(targetUser))
    );
}

function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

function formatDateTime(dateStr: string): string {
    const dt = new Date(dateStr);
    const date = dt.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });
    const time = dt.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });
    return `${date} - ${time}`;
}

function getRoleLabel(role: UserRole): string {
    switch (role) {
        case UserRole.SystemAdmin:
            return 'System Admin';
        case UserRole.DepartmentAdmin:
            return 'Department Admin';
        case UserRole.FacilityAdmin:
            return 'Facility Admin';
        case UserRole.Student:
            return 'Student';
        default:
            return 'Unknown';
    }
}

export default function AdminManagement() {
    const { user } = useAuth();
    const { toaster } = useToast();
    const { page, perPage, setPage } = useUrlPagination(1, 20);

    const [searchTerm, setSearchTerm] = useState('');
    const [sortQuery, setSortQuery] = useState<SortOption>('created_at desc');
    const [addModalOpen, setAddModalOpen] = useState(false);
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [resetDialogOpen, setResetDialogOpen] = useState(false);
    const [passwordModalOpen, setPasswordModalOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [tempPassword, setTempPassword] = useState('');
    const [newAdminRole, setNewAdminRole] = useState<UserRole>(UserRole.FacilityAdmin);

    const { data, mutate, error, isLoading } = useSWR<ServerResponseMany<User>>(
        `/api/users?search=${encodeURIComponent(searchTerm)}&page=${page}&per_page=${perPage}&order_by=${sortQuery}&role=${user?.role}`
    );

    const userData = data?.data ?? [];
    const totalPages = data?.meta?.last_page ?? 1;

    const checkDelete = useCheckResponse<User>({
        mutate,
        closeDialog: () => setDeleteDialogOpen(false)
    });

    const addForm = useForm<UserFormData>();
    const editForm = useForm<UserFormData>();

    const handleSearchChange = (value: string) => {
        startTransition(() => {
            setSearchTerm(value);
            setPage(1);
        });
    };

    const handleAddUser = async (formData: UserFormData) => {
        const response = await API.post<NewUserResponse, object>('users', {
            ...formData,
            role: newAdminRole
        }) as ServerResponseOne<NewUserResponse>;

        if (response.success) {
            setTempPassword(response.data.temp_password);
            setAddModalOpen(false);
            setPasswordModalOpen(true);
            toaster('Administrator created successfully', ToastState.success);
            addForm.reset();
            void mutate();
        } else {
            toaster(response.message || 'Failed to create administrator', ToastState.error);
        }
    };

    const handleEditUser = async (formData: UserFormData) => {
        if (!selectedUser) return;
        const response = await API.patch<User, object>(`users/${selectedUser.id}`, formData);
        if (response.success) {
            toaster('Administrator updated successfully', ToastState.success);
            setEditModalOpen(false);
            editForm.reset();
            setSelectedUser(null);
            void mutate();
        } else {
            toaster(response.message || 'Failed to update administrator', ToastState.error);
        }
    };

    const handleDeleteUser = async () => {
        if (!selectedUser) return;
        if (selectedUser.role === UserRole.SystemAdmin) {
            toaster('This is the primary administrator and cannot be deleted', ToastState.error);
            return;
        }
        const response = await API.delete('users/' + selectedUser.id);
        checkDelete(
            response.success,
            'Failed to delete administrator',
            'Administrator deleted successfully'
        );
        setSelectedUser(null);
    };

    const handleResetPassword = async () => {
        if (!selectedUser) return;
        const response = await API.post<ResetPasswordResponse, object>(
            `users/${selectedUser.id}/student-password`,
            {}
        ) as ServerResponseOne<ResetPasswordResponse>;
        if (response.success) {
            setTempPassword(response.data.temp_password);
            setResetDialogOpen(false);
            setPasswordModalOpen(true);
            toaster('Password reset successfully', ToastState.success);
        } else {
            toaster('Failed to reset password', ToastState.error);
        }
    };

    const openEdit = (targetUser: User) => {
        setSelectedUser(targetUser);
        editForm.reset({
            name_first: targetUser.name_first,
            name_last: targetUser.name_last,
            username: targetUser.username,
            email: targetUser.email
        });
        setEditModalOpen(true);
    };

    const openReset = (targetUser: User) => {
        setSelectedUser(targetUser);
        setResetDialogOpen(true);
    };

    const openDelete = (targetUser: User) => {
        setSelectedUser(targetUser);
        setDeleteDialogOpen(true);
    };

    const columns: Column<User>[] = [
        {
            key: 'name',
            header: 'Name',
            render: (u) => (
                <span className="font-medium text-[#203622]">
                    {u.name_last}, {u.name_first}
                </span>
            )
        },
        {
            key: 'username',
            header: 'Username',
            render: (u) => u.username
        },
        {
            key: 'last_active',
            header: 'Last Active',
            render: (u) =>
                u.login_metrics?.last_login
                    ? formatDateTime(u.login_metrics.last_login)
                    : '\u2014'
        },
        {
            key: 'role',
            header: 'Role',
            render: (u) => (
                <span className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full border bg-gray-50 text-gray-700 border-gray-200">
                    {getRoleLabel(u.role)}
                </span>
            )
        },
        {
            key: 'updated_at',
            header: 'Last Updated',
            render: (u) => formatDate(u.updated_at)
        },
        {
            key: 'created_at',
            header: 'Created At',
            render: (u) => formatDate(u.created_at)
        },
        {
            key: 'actions',
            header: 'Actions',
            headerClassName: 'text-right',
            className: 'text-right',
            render: (targetUser) => {
                if (!user) return null;
                const editable = canEdit(user, targetUser);
                const deletable = canDelete(user, targetUser);
                return (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                                <MoreHorizontal className="size-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            {editable ? (
                                <DropdownMenuItem onClick={() => openEdit(targetUser)}>
                                    <Pencil className="size-4 mr-2" />
                                    Edit
                                </DropdownMenuItem>
                            ) : (
                                <DropdownMenuItem disabled>
                                    <Pencil className="size-4 mr-2 text-gray-300" />
                                    Edit not allowed
                                </DropdownMenuItem>
                            )}
                            {editable ? (
                                <DropdownMenuItem onClick={() => openReset(targetUser)}>
                                    <RotateCcw className="size-4 mr-2" />
                                    Reset Password
                                </DropdownMenuItem>
                            ) : (
                                <DropdownMenuItem disabled>
                                    <RotateCcw className="size-4 mr-2 text-gray-300" />
                                    Reset not allowed
                                </DropdownMenuItem>
                            )}
                            {deletable ? (
                                <DropdownMenuItem
                                    onClick={() => openDelete(targetUser)}
                                    className="text-destructive"
                                >
                                    <Trash2 className="size-4 mr-2" />
                                    Delete
                                </DropdownMenuItem>
                            ) : targetUser.role === UserRole.SystemAdmin ? (
                                <DropdownMenuItem disabled>
                                    <Lock className="size-4 mr-2 text-gray-300" />
                                    Cannot Delete
                                </DropdownMenuItem>
                            ) : (
                                <DropdownMenuItem disabled>
                                    <Trash2 className="size-4 mr-2 text-gray-300" />
                                    Delete not allowed
                                </DropdownMenuItem>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                );
            }
        }
    ];

    const addButtons = isSysAdmin(user!) ? (
        <div className="flex gap-2">
            <Button
                className="bg-[#F1B51C] text-[#203622] hover:bg-[#F1B51C]/90 font-medium"
                onClick={() => {
                    setNewAdminRole(UserRole.DepartmentAdmin);
                    addForm.reset();
                    setAddModalOpen(true);
                }}
            >
                <Plus className="size-4" />
                Add Department Admin
            </Button>
            <Button
                className="bg-[#F1B51C] text-[#203622] hover:bg-[#F1B51C]/90 font-medium"
                onClick={() => {
                    setNewAdminRole(UserRole.FacilityAdmin);
                    addForm.reset();
                    setAddModalOpen(true);
                }}
            >
                <Plus className="size-4" />
                Add Facility Admin
            </Button>
        </div>
    ) : (
        <Button
            className="bg-[#F1B51C] text-[#203622] hover:bg-[#F1B51C]/90 font-medium"
            onClick={() => {
                setNewAdminRole(UserRole.FacilityAdmin);
                addForm.reset();
                setAddModalOpen(true);
            }}
        >
            <Plus className="size-4" />
            Add Facility Admin
        </Button>
    );

    return (
        <div className="space-y-6">
            <PageHeader title="Admin Management" subtitle="Manage administrator accounts" actions={addButtons} />

            <div className="flex items-center gap-3">
                <SearchInput
                    value={searchTerm}
                    onChange={handleSearchChange}
                    placeholder="Search admins..."
                    className="w-72"
                />
                <Select value={sortQuery} onValueChange={(v) => setSortQuery(v as SortOption)}>
                    <SelectTrigger className="w-52">
                        <SelectValue placeholder="Sort by" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="name_last asc">Name (A-Z)</SelectItem>
                        <SelectItem value="name_last desc">Name (Z-A)</SelectItem>
                        <SelectItem value="last_login desc">Last Active (Newest)</SelectItem>
                        <SelectItem value="last_login asc">Last Active (Oldest)</SelectItem>
                        <SelectItem value="created_at desc">Created (Newest)</SelectItem>
                        <SelectItem value="created_at asc">Created (Oldest)</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {error ? (
                <div className="text-center py-8 text-destructive">Failed to load administrators.</div>
            ) : (
                <DataTable
                    columns={columns}
                    data={userData}
                    keyExtractor={(u) => u.id}
                    isLoading={isLoading}
                    emptyMessage="No administrators found."
                    page={page}
                    totalPages={totalPages}
                    onPageChange={setPage}
                />
            )}

            <FormModal
                open={addModalOpen}
                onOpenChange={setAddModalOpen}
                title={`Add ${getRoleLabel(newAdminRole)}`}
            >
                <form onSubmit={addForm.handleSubmit((d) => void handleAddUser(d))} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="add-first">First Name</Label>
                            <Input id="add-first" {...addForm.register('name_first', { required: true })} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="add-last">Last Name</Label>
                            <Input id="add-last" {...addForm.register('name_last', { required: true })} />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="add-username">Username</Label>
                        <Input id="add-username" {...addForm.register('username', { required: true })} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="add-email">Email</Label>
                        <Input id="add-email" type="email" {...addForm.register('email', { required: true })} />
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
                title="Edit Administrator"
            >
                <form onSubmit={editForm.handleSubmit((d) => void handleEditUser(d))} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="edit-first">First Name</Label>
                            <Input id="edit-first" {...editForm.register('name_first', { required: true })} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="edit-last">Last Name</Label>
                            <Input id="edit-last" {...editForm.register('name_last', { required: true })} />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="edit-username">Username</Label>
                        <Input id="edit-username" {...editForm.register('username', { required: true })} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="edit-email">Email</Label>
                        <Input id="edit-email" type="email" {...editForm.register('email', { required: true })} />
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
                title="Delete Administrator"
                description="Are you sure you would like to delete this admin? This action cannot be undone."
                confirmLabel="Delete"
                onConfirm={() => void handleDeleteUser()}
                variant="destructive"
            />

            <ConfirmDialog
                open={resetDialogOpen}
                onOpenChange={setResetDialogOpen}
                title="Reset Password"
                description={`Are you sure you would like to reset ${selectedUser?.name_first ?? ''} ${selectedUser?.name_last ?? ''}'s password?`}
                confirmLabel="Reset Password"
                onConfirm={() => void handleResetPassword()}
            />

            <FormModal
                open={passwordModalOpen}
                onOpenChange={(open) => {
                    setPasswordModalOpen(open);
                    if (!open) {
                        setTempPassword('');
                        setSelectedUser(null);
                    }
                }}
                title="New Password"
                description="Copy the password below and share it with the admin. If it's lost, you'll need to reset it again."
            >
                <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 text-center">
                    <p className="text-sm text-muted-foreground mb-1">Temporary Password</p>
                    <p className="text-2xl font-bold text-[#203622] select-all">{tempPassword}</p>
                </div>
                <div className="flex justify-end gap-2 pt-4">
                    <Button
                        variant="outline"
                        onClick={() => {
                            void navigator.clipboard.writeText(tempPassword);
                            toaster('Password copied to clipboard', ToastState.success);
                        }}
                    >
                        <Copy className="size-4 mr-2" />
                        Copy
                    </Button>
                    <Button
                        className="bg-[#203622] text-white hover:bg-[#203622]/90"
                        onClick={() => {
                            setPasswordModalOpen(false);
                            setTempPassword('');
                            setSelectedUser(null);
                        }}
                    >
                        Done
                    </Button>
                </div>
            </FormModal>
        </div>
    );
}
