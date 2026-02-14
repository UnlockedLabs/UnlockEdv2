import { useState, startTransition } from 'react';
import useSWR from 'swr';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
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
import { Checkbox } from '@/components/ui/checkbox';
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
import { Plus, Pencil, RotateCcw, Trash2, MoreHorizontal, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';

type SortOption = 'name_last asc' | 'name_last desc' | 'last_login desc' | 'last_login asc' | 'created_at desc' | 'created_at asc';

interface StudentFormData {
    name_first: string;
    name_last: string;
    username: string;
    email: string;
    doc_id?: string;
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

export default function StudentManagement() {
    const navigate = useNavigate();
    const { toaster } = useToast();
    const { page, perPage, setPage } = useUrlPagination(1, 20);

    const [searchTerm, setSearchTerm] = useState('');
    const [sortQuery, setSortQuery] = useState<SortOption>('name_last asc');
    const [includeDeactivated, setIncludeDeactivated] = useState(false);
    const [addModalOpen, setAddModalOpen] = useState(false);
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [resetDialogOpen, setResetDialogOpen] = useState(false);
    const [passwordModalOpen, setPasswordModalOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [tempPassword, setTempPassword] = useState('');

    const { data, mutate, error, isLoading } = useSWR<ServerResponseMany<User>>(
        `/api/users?search=${encodeURIComponent(searchTerm)}&page=${page}&per_page=${perPage}&order_by=${sortQuery}&role=student&include_deactivated=${includeDeactivated}`
    );

    const userData = data?.data ?? [];
    const totalPages = data?.meta?.last_page ?? 1;

    const checkDelete = useCheckResponse<User>({
        mutate,
        closeDialog: () => setDeleteDialogOpen(false)
    });

    const addForm = useForm<StudentFormData>();
    const editForm = useForm<StudentFormData>();

    const handleSearchChange = (value: string) => {
        startTransition(() => {
            setSearchTerm(value);
            setPage(1);
        });
    };

    const handleAddUser = async (formData: StudentFormData) => {
        const response = await API.post<NewUserResponse, object>('users', {
            ...formData,
            role: UserRole.Student
        }) as ServerResponseOne<NewUserResponse>;

        if (response.success) {
            setTempPassword(response.data.temp_password);
            setAddModalOpen(false);
            setPasswordModalOpen(true);
            toaster('Resident created successfully', ToastState.success);
            addForm.reset();
            void mutate();
        } else {
            toaster(response.message || 'Failed to create resident', ToastState.error);
        }
    };

    const handleEditUser = async (formData: StudentFormData) => {
        if (!selectedUser) return;
        const response = await API.patch<User, object>(`users/${selectedUser.id}`, formData);
        if (response.success) {
            toaster('Resident updated successfully', ToastState.success);
            setEditModalOpen(false);
            editForm.reset();
            setSelectedUser(null);
            void mutate();
        } else {
            toaster(response.message || 'Failed to update resident', ToastState.error);
        }
    };

    const handleDeleteUser = async () => {
        if (!selectedUser) return;
        const response = await API.delete('users/' + selectedUser.id);
        checkDelete(
            response.success,
            'Failed to delete resident',
            'Resident deleted successfully'
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
            email: targetUser.email,
            doc_id: targetUser.doc_id ?? ''
        });
        setEditModalOpen(true);
    };

    const columns: Column<User>[] = [
        {
            key: 'name',
            header: 'Name',
            render: (u) => (
                <span className={cn(
                    'font-medium text-[#203622]',
                    u.deactivated_at && 'opacity-50'
                )}>
                    {u.name_last}, {u.name_first}
                </span>
            )
        },
        {
            key: 'username',
            header: 'Username',
            render: (u) => <span className={cn(u.deactivated_at && 'opacity-50')}>{u.username}</span>
        },
        {
            key: 'last_active',
            header: 'Last Active',
            render: (u) => (
                <span className={cn(u.deactivated_at && 'opacity-50')}>
                    {u.login_metrics?.last_login ? formatDateTime(u.login_metrics.last_login) : '\u2014'}
                </span>
            )
        },
        {
            key: 'doc_id',
            header: 'Resident ID',
            render: (u) => <span className={cn(u.deactivated_at && 'opacity-50')}>{u.doc_id ?? '\u2014'}</span>
        },
        {
            key: 'updated_at',
            header: 'Last Updated',
            render: (u) => <span className={cn(u.deactivated_at && 'opacity-50')}>{formatDate(u.updated_at)}</span>
        },
        {
            key: 'created_at',
            header: 'Created At',
            render: (u) => <span className={cn(u.deactivated_at && 'opacity-50')}>{formatDate(u.created_at)}</span>
        },
        {
            key: 'actions',
            header: 'Actions',
            headerClassName: 'text-right',
            className: 'text-right',
            render: (targetUser) => (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="sm">
                            <MoreHorizontal className="size-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        {!targetUser.deactivated_at && (
                            <>
                                <DropdownMenuItem onClick={(e) => {
                                    e.stopPropagation();
                                    openEdit(targetUser);
                                }}>
                                    <Pencil className="size-4 mr-2" />
                                    Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedUser(targetUser);
                                    setResetDialogOpen(true);
                                }}>
                                    <RotateCcw className="size-4 mr-2" />
                                    Reset Password
                                </DropdownMenuItem>
                            </>
                        )}
                        <DropdownMenuItem
                            onClick={(e) => {
                                e.stopPropagation();
                                setSelectedUser(targetUser);
                                setDeleteDialogOpen(true);
                            }}
                            className="text-destructive"
                        >
                            <Trash2 className="size-4 mr-2" />
                            Delete
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            )
        }
    ];

    return (
        <div className="space-y-6">
            <PageHeader
                title="Resident Management"
                subtitle="Manage resident accounts"
                actions={
                    <div className="flex gap-2">
                        <Button
                            className="bg-[#F1B51C] text-[#203622] hover:bg-[#F1B51C]/90 font-medium"
                            onClick={() => {
                                addForm.reset();
                                setAddModalOpen(true);
                            }}
                        >
                            <Plus className="size-4" />
                            Add Resident
                        </Button>
                    </div>
                }
            />

            <div className="flex items-center gap-3">
                <SearchInput
                    value={searchTerm}
                    onChange={handleSearchChange}
                    placeholder="Search residents..."
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
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                    <Checkbox
                        checked={includeDeactivated}
                        onCheckedChange={(checked) => setIncludeDeactivated(checked === true)}
                    />
                    Include Deactivated
                </label>
            </div>

            {error ? (
                <div className="text-center py-8 text-destructive">Failed to load residents.</div>
            ) : (
                <DataTable
                    columns={columns}
                    data={userData}
                    keyExtractor={(u) => u.id}
                    isLoading={isLoading}
                    emptyMessage="No residents found."
                    onRowClick={(u) => navigate(`/residents/${u.id}`)}
                    page={page}
                    totalPages={totalPages}
                    onPageChange={setPage}
                />
            )}

            <FormModal
                open={addModalOpen}
                onOpenChange={setAddModalOpen}
                title="Add Resident"
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
                    <div className="space-y-2">
                        <Label htmlFor="add-doc-id">Resident ID</Label>
                        <Input id="add-doc-id" {...addForm.register('doc_id')} />
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
                title="Edit Resident"
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
                    <div className="space-y-2">
                        <Label htmlFor="edit-doc-id">Resident ID</Label>
                        <Input id="edit-doc-id" {...editForm.register('doc_id')} />
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
                title="Delete Resident"
                description="Are you sure you would like to delete this resident? This action cannot be undone."
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
                description="Copy the password below and share it with the resident. If it's lost, you'll need to reset it again."
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
