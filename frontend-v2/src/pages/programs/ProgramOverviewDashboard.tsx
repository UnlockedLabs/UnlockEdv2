import { useState, useMemo, startTransition } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import useSWR from 'swr';
import { toast } from 'sonner';
import { Plus, Archive, Search } from 'lucide-react';
import API from '@/api/api';
import { useAuth, canSwitchFacility } from '@/auth/useAuth';
import {
    Class,
    ProgramOverview,
    SelectedClassStatus,
    ServerResponseMany,
    ServerResponseOne
} from '@/types';
import { getStatusColor } from '@/lib/formatters';
import { PageHeader, StatusBadge } from '@/components/shared';
import { ConfirmDialog } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
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

function isArchived(cls: Class): boolean {
    return cls.archived_at !== null && cls.archived_at !== undefined;
}

export function isCompletedCancelledOrArchived(cls: Class): boolean {
    return (
        cls.status === SelectedClassStatus.Completed ||
        cls.status === SelectedClassStatus.Cancelled ||
        isArchived(cls)
    );
}

function StatCard({ label, value, subtitle }: { label: string; value: string | number; subtitle?: string }) {
    return (
        <Card className="bg-white">
            <CardContent className="p-4">
                <p className="text-sm text-gray-600">{label}</p>
                <p className="text-2xl font-bold text-[#203622]">{value}</p>
                {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
            </CardContent>
        </Card>
    );
}

export default function ProgramOverviewDashboard() {
    const navigate = useNavigate();
    const { program_id } = useParams<{ program_id: string }>();
    const { user } = useAuth();

    const [page, setPage] = useState(1);
    const perPage = 20;
    const [searchTerm, setSearchTerm] = useState('');
    const [sortQuery, setSortQuery] = useState('ps.start_dt asc');
    const [includeArchived, setIncludeArchived] = useState(false);
    const [selectedClasses, setSelectedClasses] = useState<number[]>([]);
    const [showArchiveDialog, setShowArchiveDialog] = useState(false);

    const { data: programResp } = useSWR<ServerResponseOne<ProgramOverview>>(
        `/api/programs/${program_id}`
    );
    const program = programResp?.data;

    const {
        data: classesResp,
        isLoading,
        mutate: mutateClasses
    } = useSWR<ServerResponseMany<Class>>(
        `/api/programs/${program_id}/classes?page=${page}&per_page=${perPage}&order_by=${sortQuery}&search=${searchTerm}`
    );

    const classes = useMemo(() => classesResp?.data ?? [], [classesResp?.data]);
    const meta = classesResp?.meta;

    const nonArchivedClasses = useMemo(
        () => classes.filter((c) => !isArchived(c)),
        [classes]
    );

    const filteredClasses = includeArchived ? classes : nonArchivedClasses;

    const canAddClass = program?.is_active && !program?.archived_at;

    const handleSearch = (term: string) => {
        startTransition(() => {
            setSearchTerm(term);
            setPage(1);
        });
    };

    function handleToggleAll(checked: boolean) {
        setSelectedClasses(
            checked ? nonArchivedClasses.map((c) => c.id) : []
        );
    }

    function handleToggleRow(classId: number) {
        setSelectedClasses((prev) =>
            prev.includes(classId)
                ? prev.filter((id) => id !== classId)
                : [...prev, classId]
        );
    }

    const allSelected =
        selectedClasses.length === nonArchivedClasses.length &&
        nonArchivedClasses.length > 0;

    const archivableClasses = useMemo(() => {
        return classes.filter(
            (c) =>
                selectedClasses.includes(c.id) &&
                !(
                    (c.status === SelectedClassStatus.Active ||
                        c.status === SelectedClassStatus.Scheduled) &&
                    c.enrolled >= 1
                )
        );
    }, [selectedClasses, classes]);

    async function archiveClasses() {
        const ids = archivableClasses.map((c) => c.id);
        if (ids.length === 0) return;
        const idString = '?id=' + ids.join('&id=');
        const resp = await API.patch(`program-classes${idString}`, {
            archived_at: new Date().toISOString()
        });
        if (resp.success) {
            toast.success('Classes archived successfully');
            setSelectedClasses([]);
            void mutateClasses();
        } else {
            toast.error('Failed to archive classes');
        }
        setShowArchiveDialog(false);
    }

    function formatEnumList(items: string[] | null | undefined): string {
        if (!Array.isArray(items) || items.length === 0) return '';
        return items.map((e) => String(e).replace(/_/g, ' ')).join(', ');
    }

    if (!program) {
        return (
            <div className="flex items-center justify-center h-64">
                <p className="text-muted-foreground">Loading program...</p>
            </div>
        );
    }

    const totalPages = meta ? meta.last_page : 1;

    return (
        <div className="space-y-6">
            <PageHeader
                title={program.name}
                subtitle={program.description}
                actions={
                    <div className="flex items-center gap-2">
                        {canSwitchFacility(user!) && (
                            <Button
                                variant="outline"
                                className="border-gray-300"
                                onClick={() =>
                                    navigate(`/programs/detail/${program.id}`)
                                }
                            >
                                Edit Program
                            </Button>
                        )}
                    </div>
                }
            />

            <div className="grid grid-cols-2 gap-4">
                <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
                    <div className="flex items-center gap-2">
                        <Badge
                            variant="outline"
                            className={
                                program.is_active
                                    ? 'bg-green-50 text-green-700 border-green-200'
                                    : 'bg-gray-50 text-gray-700 border-gray-200'
                            }
                        >
                            {program.is_active ? 'Available' : 'Inactive'}
                        </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <span className="text-gray-600">Credit Type</span>
                            <p className="text-[#203622]">
                                {formatEnumList(program.credit_types.map((ct) => ct.credit_type))}
                            </p>
                        </div>
                        <div>
                            <span className="text-gray-600">Program Type</span>
                            <p className="text-[#203622]">
                                {formatEnumList(program.program_types.map((pt) => pt.program_type))}
                            </p>
                        </div>
                        <div>
                            <span className="text-gray-600">Funding Type</span>
                            <p className="text-[#203622]">
                                {program.funding_type?.replace(/_/g, ' ')}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <StatCard
                        label="Active Enrollments"
                        value={program.active_enrollments ?? 0}
                    />
                    <StatCard
                        label="Active Residents"
                        value={program.active_residents ?? 0}
                    />
                    <div className="col-span-2">
                        <StatCard
                            label="Completion Rate"
                            value={`${program.completion_rate ?? 0}%`}
                        />
                    </div>
                </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="relative w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
                        <Input
                            placeholder="Search classes..."
                            value={searchTerm}
                            onChange={(e) => handleSearch(e.target.value)}
                            className="pl-9"
                        />
                    </div>
                    <Select value={sortQuery} onValueChange={setSortQuery}>
                        <SelectTrigger className="w-52">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ps.start_dt asc">Start Date (Earliest)</SelectItem>
                            <SelectItem value="ps.start_dt desc">Start Date (Latest)</SelectItem>
                            <SelectItem value="enrolled desc">Enrollment (Most)</SelectItem>
                            <SelectItem value="enrolled asc">Enrollment (Least)</SelectItem>
                        </SelectContent>
                    </Select>
                    <label className="flex items-center gap-2 cursor-pointer text-sm">
                        <Checkbox
                            checked={includeArchived}
                            onCheckedChange={(checked) => setIncludeArchived(checked === true)}
                        />
                        Include Archived
                    </label>
                </div>
                <div className="flex items-center gap-2">
                    {selectedClasses.length > 0 ? (
                        <Button
                            variant="outline"
                            onClick={() => setShowArchiveDialog(true)}
                        >
                            <Archive className="size-4 mr-1" />
                            Archive ({selectedClasses.length})
                        </Button>
                    ) : (
                        <Button
                            disabled={!canAddClass}
                            onClick={() =>
                                navigate(`/programs/${program_id}/classes/new`)
                            }
                            className="bg-[#F1B51C] text-[#203622] hover:bg-[#F1B51C]/90"
                        >
                            <Plus className="size-4" />
                            Add Class
                        </Button>
                    )}
                </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200">
                <Table>
                    <TableHeader>
                        <TableRow className="hover:bg-transparent">
                            <TableHead className="w-10">
                                <Checkbox
                                    checked={allSelected}
                                    onCheckedChange={(checked) =>
                                        handleToggleAll(checked === true)
                                    }
                                />
                            </TableHead>
                            <TableHead>Class Name</TableHead>
                            <TableHead>Instructor</TableHead>
                            <TableHead>Start Date</TableHead>
                            <TableHead>End Date</TableHead>
                            <TableHead>Enrollment</TableHead>
                            <TableHead>Status</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center py-8">
                                    Loading...
                                </TableCell>
                            </TableRow>
                        ) : filteredClasses.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                                    No classes found for this program.
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredClasses.map((cls) => {
                                const isSelected = selectedClasses.includes(cls.id);
                                const archived = isArchived(cls);
                                const enrollPct =
                                    cls.capacity > 0
                                        ? (cls.enrolled / cls.capacity) * 100
                                        : 0;

                                return (
                                    <TableRow
                                        key={cls.id}
                                        className={archived ? 'opacity-60' : ''}
                                    >
                                        <TableCell>
                                            {!archived && (
                                                <Checkbox
                                                    checked={isSelected}
                                                    onCheckedChange={() =>
                                                        handleToggleRow(cls.id)
                                                    }
                                                />
                                            )}
                                        </TableCell>
                                        <TableCell
                                            className="cursor-pointer hover:underline text-[#203622] font-medium"
                                            onClick={() =>
                                                navigate(
                                                    `/program-classes/${cls.id}/dashboard`
                                                )
                                            }
                                        >
                                            {cls.name}
                                        </TableCell>
                                        <TableCell>{cls.instructor_name}</TableCell>
                                        <TableCell>
                                            {new Date(cls.start_dt).toLocaleDateString(
                                                'en-US',
                                                {
                                                    year: 'numeric',
                                                    month: 'short',
                                                    day: 'numeric',
                                                    timeZone: 'UTC'
                                                }
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {cls.end_dt
                                                ? new Date(cls.end_dt).toLocaleDateString(
                                                      'en-US',
                                                      {
                                                          year: 'numeric',
                                                          month: 'short',
                                                          day: 'numeric',
                                                          timeZone: 'UTC'
                                                      }
                                                  )
                                                : 'No end date'}
                                        </TableCell>
                                        <TableCell>
                                            <div className="w-24 space-y-1">
                                                <p className="text-xs text-gray-600">
                                                    {cls.enrolled} / {cls.capacity}
                                                </p>
                                                <Progress
                                                    value={enrollPct}
                                                    className="h-1.5"
                                                    indicatorClassName="bg-[#556830]"
                                                />
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge
                                                variant="outline"
                                                className={getStatusColor(cls.status)}
                                            >
                                                {archived ? 'Archived' : cls.status}
                                            </Badge>
                                        </TableCell>
                                    </TableRow>
                                );
                            })
                        )}
                    </TableBody>
                </Table>

                {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-2 p-4 border-t">
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={page <= 1}
                            onClick={() => setPage(page - 1)}
                        >
                            Previous
                        </Button>
                        <span className="text-sm text-gray-600">
                            Page {page} of {totalPages}
                        </span>
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={page >= totalPages}
                            onClick={() => setPage(page + 1)}
                        >
                            Next
                        </Button>
                    </div>
                )}
            </div>

            <ConfirmDialog
                open={showArchiveDialog}
                onOpenChange={setShowArchiveDialog}
                title={`Archive ${selectedClasses.length > 1 ? 'Classes' : 'Class'}`}
                description={
                    archivableClasses.length === 0
                        ? 'The selected classes cannot be archived because they have enrolled students in an active or scheduled status.'
                        : `Are you sure you want to archive ${archivableClasses.length} ${archivableClasses.length === 1 ? 'class' : 'classes'}? This action cannot be undone.`
                }
                confirmLabel={archivableClasses.length > 0 ? 'Archive' : 'Close'}
                onConfirm={() => {
                    if (archivableClasses.length > 0) {
                        void archiveClasses();
                    } else {
                        setShowArchiveDialog(false);
                    }
                }}
                variant="destructive"
            />
        </div>
    );
}
