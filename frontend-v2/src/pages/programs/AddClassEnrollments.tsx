import { useState, useEffect } from 'react';
import { useNavigate, useParams, useLoaderData } from 'react-router-dom';
import useSWR from 'swr';
import { toast } from 'sonner';
import { useDebounceValue } from 'usehooks-ts';
import { Search, Users, CheckCircle, UserPlus } from 'lucide-react';
import API from '@/api/api';
import {
    Class,
    ClassLoaderData,
    EnrollmentStatus,
    SelectedClassStatus,
    ServerResponseMany,
    User,
    FilterResidentNames,
    ConflictDetail
} from '@/types';
import { PageHeader, ConfirmDialog } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@/components/ui/table';

function StatItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
    return (
        <div className="flex items-center gap-3">
            <div className="rounded-lg bg-muted p-2">{icon}</div>
            <div>
                <p className="text-sm text-muted-foreground">{label}</p>
                <p className="text-lg font-bold text-foreground">{value}</p>
            </div>
        </div>
    );
}

export default function AddClassEnrollments() {
    const navigate = useNavigate();
    const { class_id } = useParams<{ class_id: string }>();
    const loaderData = useLoaderData() as ClassLoaderData;
    const classInfo = loaderData?.class;

    const [selectedUsers, setSelectedUsers] = useState<number[]>([]);
    const [errorMessage, setErrorMessage] = useState('');
    const [page, setPage] = useState(1);
    const perPage = 20;
    const [searchTerm, setSearchTerm] = useState('');
    const [searchQuery] = useDebounceValue(searchTerm, 500);
    const [sortQuery, setSortQuery] = useState(FilterResidentNames['Resident Name (A-Z)']);

    const [conflicts, setConflicts] = useState<ConflictDetail[]>([]);
    const [showConflictDialog, setShowConflictDialog] = useState(false);

    const encodedSearch = encodeURIComponent(searchQuery);

    const { data, isLoading } = useSWR<ServerResponseMany<User>>(
        `/api/users?search=${encodedSearch}&page=${page}&per_page=${perPage}&order_by=${sortQuery}&role=student&class_id=${class_id}&include=only_unenrolled`
    );

    const users = data?.data ?? [];
    const meta = data?.meta;
    const totalPages = meta ? meta.last_page : 1;

    const enrolledCount =
        classInfo?.enrollments?.filter(
            (e) => e.enrollment_status === EnrollmentStatus.Enrolled
        ).length ?? 0;

    const remainingCapacity = (classInfo?.capacity ?? 0) - enrolledCount - selectedUsers.length;

    useEffect(() => {
        if (remainingCapacity < 0) {
            setErrorMessage('Class is full');
            setSelectedUsers((prev) => prev.slice(0, prev.length + remainingCapacity));
        } else if (remainingCapacity > 0 && errorMessage === 'Class is full') {
            setErrorMessage('');
        }
    }, [remainingCapacity, errorMessage]);

    function handleToggleRow(userId: number) {
        setSelectedUsers((prev) =>
            prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
        );
    }

    function handleSelectAll() {
        setSelectedUsers(
            selectedUsers.length === users.length ? [] : users.map((u) => u.id)
        );
    }

    const allSelected = users.length > 0 && users.every((u) => selectedUsers.includes(u.id));

    async function submitEnrollment(confirm = false) {
        setErrorMessage('');
        interface EnrollmentResponse {
            conflicts?: ConflictDetail[];
        }
        const resp = await API.post<EnrollmentResponse, { user_ids: number[]; confirm: boolean }>(
            `program-classes/${class_id}/enrollments`,
            { user_ids: selectedUsers, confirm }
        );

        if (!resp.success) {
            const responseData = resp.data as EnrollmentResponse;
            if (resp.status === 409 && responseData?.conflicts) {
                setConflicts(responseData.conflicts);
                setShowConflictDialog(true);
            } else {
                setErrorMessage(resp.message || 'Failed to enroll users. Please try again.');
            }
            return;
        }

        toast.success('Residents enrolled successfully');
        setSelectedUsers([]);
        navigate(`/program-classes/${class_id}/enrollments`);
    }

    async function handleSubmit() {
        if (
            classInfo?.status === SelectedClassStatus.Completed ||
            classInfo?.status === SelectedClassStatus.Cancelled
        ) {
            setErrorMessage('Cannot add users to a class that is completed or cancelled.');
            return;
        }
        if (selectedUsers.length === 0) {
            setErrorMessage('Please select at least one user.');
            setTimeout(() => setErrorMessage(''), 8000);
            return;
        }
        await submitEnrollment(false);
    }

    return (
        <div className="space-y-6">
            <PageHeader
                title="Add Residents"
                subtitle={`Add residents to ${classInfo?.name ?? 'class'}`}
            />

            <Card className="bg-card">
                <CardContent className="p-4">
                    <h2 className="text-lg font-semibold text-foreground mb-3">
                        {classInfo?.name}
                    </h2>
                    <div className="grid grid-cols-3 gap-6">
                        <StatItem
                            icon={<Users className="size-5 text-[#556830]" />}
                            label="Current Enrollment"
                            value={enrolledCount}
                        />
                        <StatItem
                            icon={<CheckCircle className="size-5 text-[#556830]" />}
                            label="Maximum Capacity"
                            value={classInfo?.capacity ?? 0}
                        />
                        <StatItem
                            icon={<UserPlus className="size-5 text-[#556830]" />}
                            label="Available Spots"
                            value={remainingCapacity}
                        />
                    </div>
                </CardContent>
            </Card>

            <div className="flex items-center gap-3">
                <div className="relative w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <Input
                        placeholder="Search residents..."
                        value={searchTerm}
                        onChange={(e) => {
                            setSearchTerm(e.target.value);
                            setPage(1);
                        }}
                        className="pl-9"
                    />
                </div>
                <Select value={sortQuery} onValueChange={setSortQuery}>
                    <SelectTrigger className="w-44">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="name_last asc">Name (A-Z)</SelectItem>
                        <SelectItem value="name_last desc">Name (Z-A)</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    void handleSubmit();
                }}
            >
                <div className="bg-card rounded-lg border border-border">
                    <Table>
                        <TableHeader>
                            <TableRow className="hover:bg-transparent">
                                <TableHead className="w-10">
                                    <Checkbox
                                        checked={allSelected}
                                        onCheckedChange={handleSelectAll}
                                    />
                                </TableHead>
                                <TableHead>Name</TableHead>
                                <TableHead>Resident ID</TableHead>
                                <TableHead>Username</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center py-8">
                                        Loading...
                                    </TableCell>
                                </TableRow>
                            ) : users.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                                        No eligible residents available at this facility.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                users.map((user) => {
                                    const isSelected = selectedUsers.includes(user.id);
                                    return (
                                        <TableRow
                                            key={user.id}
                                            className={`cursor-pointer ${isSelected ? 'bg-muted/30' : ''}`}
                                            onClick={() => handleToggleRow(user.id)}
                                        >
                                            <TableCell onClick={(e) => e.stopPropagation()}>
                                                <Checkbox
                                                    checked={isSelected}
                                                    onCheckedChange={() => handleToggleRow(user.id)}
                                                />
                                            </TableCell>
                                            <TableCell className="font-medium text-foreground">
                                                {user.name_last}, {user.name_first}
                                            </TableCell>
                                            <TableCell>{user.doc_id}</TableCell>
                                            <TableCell>{user.username}</TableCell>
                                        </TableRow>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>

                    {totalPages > 1 && (
                        <div className="flex items-center justify-center gap-2 p-4 border-t">
                            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                                Previous
                            </Button>
                            <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
                            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                                Next
                            </Button>
                        </div>
                    )}
                </div>

                {errorMessage && (
                    <div className="text-sm text-red-600 mt-2">{errorMessage}</div>
                )}

                <div className="flex items-center justify-between py-4 border-t mt-4 sticky bottom-0 bg-card">
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>
                            {selectedUsers.length} resident{selectedUsers.length === 1 ? '' : 's'} selected
                        </span>
                        <span>
                            {remainingCapacity} spot{remainingCapacity === 1 ? '' : 's'} remaining
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => navigate(`/program-classes/${class_id}/enrollments`)}
                            className="border-gray-300"
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            className="bg-[#F1B51C] text-foreground hover:bg-[#F1B51C]/90"
                        >
                            Enroll Residents
                        </Button>
                    </div>
                </div>
            </form>

            <ConfirmDialog
                open={showConflictDialog}
                onOpenChange={setShowConflictDialog}
                title="Scheduling Conflict"
                description={`${conflicts.length} resident(s) have scheduling conflicts. Do you want to proceed with enrollment anyway?`}
                confirmLabel="Enroll Anyway"
                cancelLabel="Cancel"
                onConfirm={() => {
                    setShowConflictDialog(false);
                    void submitEnrollment(true);
                }}
                variant="destructive"
            />
        </div>
    );
}
