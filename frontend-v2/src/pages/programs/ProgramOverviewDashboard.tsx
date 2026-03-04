import { useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import useSWR from 'swr';
import { toast } from 'sonner';
import { Plus, Edit, MoreVertical, Trash2, AlertCircle } from 'lucide-react';
import {
    AcademicCapIcon,
    WrenchScrewdriverIcon,
    HeartIcon,
    SparklesIcon,
    LightBulbIcon,
    HomeModernIcon,
    HandRaisedIcon
} from '@heroicons/react/24/outline';
import API from '@/api/api';
import {
    Class,
    ProgramOverview,
    ProgClassStatus,
    SelectedClassStatus,
    ChangeLogEntry,
    ServerResponseMany,
    ServerResponseOne
} from '@/types';
import { getClassSchedule, getStatusColor } from '@/lib/formatters';
import {
    programTypeColors,
    TAB_TRIGGER_CLASSES
} from '@/pages/program-detail/constants';
import { cn } from '@/lib/utils';
import { formatHistoryEntry } from '@/components/history/formatHistoryEntry';
import { ClassManagementFormInner } from '@/pages/programs/ClassManagementForm';
import EditProgramDialog from '@/pages/program-detail/EditProgramDialog';
import { useAuth } from '@/auth/useAuth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger
} from '@/components/ui/tooltip';

type HeroIcon = React.ForwardRefExoticComponent<
    React.PropsWithoutRef<React.SVGProps<SVGSVGElement>> & {
        title?: string;
        titleId?: string;
    } & React.RefAttributes<SVGSVGElement>
>;

const programTypeIcons: Record<string, HeroIcon> = {
    Educational: AcademicCapIcon,
    Vocational: WrenchScrewdriverIcon,
    Mental_Health_Behavioral: HeartIcon,
    Therapeutic: SparklesIcon,
    Life_Skills: LightBulbIcon,
    'Re-Entry': HomeModernIcon,
    'Religious_Faith-Based': HandRaisedIcon
};

function formatEnum(value: string): string {
    return value.replace(/_/g, ' ');
}

export default function ProgramOverviewDashboard() {
    const navigate = useNavigate();
    const { program_id } = useParams<{ program_id: string }>();
    const [activeTab, setActiveTab] = useState('classes');
    const [historyPage] = useState(1);
    const [statusModalOpen, setStatusModalOpen] = useState(false);
    const [selectedClass, setSelectedClass] = useState<Class | null>(null);
    const [selectedStatus, setSelectedStatus] = useState('');
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [deleteConfirmationText, setDeleteConfirmationText] = useState('');
    const [showEditDialog, setShowEditDialog] = useState(false);

    const { data: programResp, mutate: mutateProgram } = useSWR<
        ServerResponseOne<ProgramOverview>
    >(`/api/programs/${program_id}`);
    const program = programResp?.data;

    const {
        data: classesResp,
        isLoading: classesLoading,
        mutate: mutateClasses
    } = useSWR<ServerResponseMany<Class>>(
        `/api/programs/${program_id}/classes?per_page=100&order_by=ps.start_dt asc`
    );
    const classes = useMemo(() => classesResp?.data ?? [], [classesResp?.data]);

    const { data: historyResp } = useSWR<ServerResponseMany<ChangeLogEntry>>(
        activeTab === 'history'
            ? `/api/programs/${program_id}/history?page=${historyPage}&per_page=100`
            : null
    );
    const history = historyResp?.data ?? [];

    const nonArchivedClasses = useMemo(
        () => classes.filter((c) => !c.archived_at),
        [classes]
    );

    const activeClasses = useMemo(
        () =>
            nonArchivedClasses.filter(
                (c) => c.status === SelectedClassStatus.Active
            ),
        [nonArchivedClasses]
    );

    const totalCapacity = useMemo(
        () => activeClasses.reduce((sum, c) => sum + c.capacity, 0),
        [activeClasses]
    );

    const totalEnrolled = useMemo(
        () => activeClasses.reduce((sum, c) => sum + c.enrolled, 0),
        [activeClasses]
    );

    const utilization =
        totalCapacity > 0
            ? Math.round((totalEnrolled / totalCapacity) * 100)
            : 0;

    async function handleProgramStatusChange(newStatus: string) {
        if (!program) return;
        const body: Record<string, unknown> =
            newStatus === 'Available'
                ? { is_active: true }
                : { is_active: false };

        const resp = await API.patch<
            { updated: boolean; message: string },
            Record<string, unknown>
        >(`programs/${program.id}/status`, body);
        if (resp.success) {
            toast.success('Program status updated');
            void mutateProgram();
        } else {
            toast.error('Failed to update program status');
        }
    }

    async function handleClassStatusChange(cls: Class, newStatus: string) {
        const resp = await API.patch(`program-classes?id=${cls.id}`, {
            status: newStatus
        });
        if (resp.success) {
            toast.success(`Class status updated to ${newStatus}`);
            void mutateClasses();
            void mutateProgram();
        } else {
            toast.error('Failed to update class status');
        }
    }

    if (!program) {
        return (
            <div className="flex items-center justify-center h-64">
                <p className="text-muted-foreground">Loading program...</p>
            </div>
        );
    }

    const programStatus = program.archived_at
        ? 'Archived'
        : program.is_active
          ? 'Available'
          : 'Inactive';

    const fundingDisplay = program.funding_type
        ? formatEnum(String(program.funding_type))
        : '';

    const primaryType = program.program_types[0]?.program_type;
    const Icon = primaryType
        ? programTypeIcons[primaryType] || LightBulbIcon
        : LightBulbIcon;
    const deleteDisabled = classes.length > 0;

    function handleOpenStatusModal(cls: Class) {
        setSelectedClass(cls);
        setSelectedStatus(cls.status);
        setStatusModalOpen(true);
    }

    function handleCloseStatusModal(open: boolean) {
        setStatusModalOpen(open);
        if (!open) {
            setSelectedClass(null);
        }
    }

    function handleSaveStatus() {
        if (!selectedClass) return;
        void handleClassStatusChange(selectedClass, selectedStatus);
        setStatusModalOpen(false);
        setSelectedClass(null);
    }

    async function handleDeleteProgram() {
        if (!program) return;
        const resp = await API.delete(`programs/${program.id}`);
        if (resp.success) {
            toast.success(`Program "${program.name}" has been deleted`);
            navigate('/programs');
        } else {
            toast.error(resp.message || 'Failed to delete program');
        }
        setDeleteModalOpen(false);
        setDeleteConfirmationText('');
    }

    function getStatusDescription(status: string) {
        switch (status) {
            case 'Active':
                return 'Class is currently running and accepting attendance.';
            case 'Scheduled':
                return 'Class is scheduled to begin in the future.';
            case 'Completed':
                return 'Class has finished and is now archived.';
            case 'Cancelled':
                return 'Class has been cancelled and will not take place.';
            case 'Paused':
                return 'Class is temporarily paused and not meeting.';
            default:
                return '';
        }
    }

    return (
        <div className="-mx-6 -my-4 bg-[#E2E7EA] min-h-screen overflow-x-hidden">
            <div className="bg-white border-b border-gray-200">
                <div className="max-w-7xl mx-auto px-6 pt-4 pb-6">
                    <div className="flex items-start gap-6">
                        <div className="bg-[#556830] p-4 rounded-lg flex items-center justify-center shrink-0">
                            <Icon className="size-10 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between mb-2">
                                <div>
                                    <h1 className="text-[#203622] mb-2">
                                        {program.name}
                                    </h1>
                                    {program.program_types?.length > 0 && (
                                        <div className="flex flex-wrap gap-2 mb-3">
                                            {program.program_types.map((pt) => (
                                                <Badge
                                                    key={pt.program_type}
                                                    variant="outline"
                                                    className={
                                                        programTypeColors[
                                                            pt.program_type
                                                        ] ??
                                                        'bg-gray-100 text-gray-700 border-gray-200'
                                                    }
                                                >
                                                    {formatEnum(
                                                        pt.program_type
                                                    )}
                                                </Badge>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <div className="flex gap-3 items-start">
                                    <div className="flex flex-col gap-1">
                                        <p className="text-xs text-gray-600 font-medium">
                                            Program Status
                                        </p>
                                        <Select
                                            value={programStatus}
                                            onValueChange={(value) => {
                                                void handleProgramStatusChange(
                                                    value
                                                );
                                            }}
                                            disabled={!!program.archived_at}
                                        >
                                            <SelectTrigger className="w-[140px] h-9">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="Available">
                                                    Available
                                                </SelectItem>
                                                <SelectItem value="Inactive">
                                                    Inactive
                                                </SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <Button
                                        variant="outline"
                                        className="border-gray-300 mt-5"
                                        onClick={() => setShowEditDialog(true)}
                                    >
                                        <Edit className="size-4 mr-2" />
                                        Edit Program
                                    </Button>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-9 w-9 text-gray-500 mt-5"
                                            >
                                                <MoreVertical className="size-4" />
                                                <span className="sr-only">
                                                    More options
                                                </span>
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <div>
                                                        <DropdownMenuItem
                                                            variant="destructive"
                                                            onClick={() =>
                                                                setDeleteModalOpen(
                                                                    true
                                                                )
                                                            }
                                                            disabled={
                                                                deleteDisabled
                                                            }
                                                        >
                                                            <Trash2 className="size-4" />
                                                            Delete Program
                                                        </DropdownMenuItem>
                                                    </div>
                                                </TooltipTrigger>
                                                {deleteDisabled && (
                                                    <TooltipContent side="left">
                                                        Cannot delete program
                                                        with existing classes
                                                    </TooltipContent>
                                                )}
                                            </Tooltip>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            </div>

                            {program.description && (
                                <p className="text-gray-600 mb-4 max-w-3xl mt-1">
                                    {program.description}
                                </p>
                            )}

                            <div className="grid grid-cols-4 gap-4">
                                <MetricBox
                                    label="Classes"
                                    value={nonArchivedClasses.length}
                                    subtitle={`${nonArchivedClasses.length} total`}
                                />
                                <MetricBox
                                    label="Enrollment"
                                    value={totalEnrolled}
                                    subtitle={`${totalCapacity} capacity`}
                                />
                                <MetricBox
                                    label="Utilization"
                                    value={`${utilization}%`}
                                    subtitle="Capacity filled"
                                />
                                <MetricBox
                                    label="Funding"
                                    value={fundingDisplay || '-'}
                                    valueClassName="text-sm text-[#203622]"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="py-6">
                <div className="max-w-7xl mx-auto px-6">
                    <Tabs value={activeTab} onValueChange={setActiveTab}>
                        <TabsList className="bg-white border border-gray-200 px-1 py-1 h-auto mb-7 rounded-xl shadow-sm gap-1.5">
                            <TabsTrigger
                                value="classes"
                                className={TAB_TRIGGER_CLASSES}
                            >
                                Classes ({nonArchivedClasses.length})
                            </TabsTrigger>
                            <TabsTrigger
                                value="details"
                                className={TAB_TRIGGER_CLASSES}
                            >
                                Program Details
                            </TabsTrigger>
                            <TabsTrigger
                                value="performance"
                                className={TAB_TRIGGER_CLASSES}
                            >
                                Performance
                            </TabsTrigger>
                            <TabsTrigger
                                value="history"
                                className={TAB_TRIGGER_CLASSES}
                            >
                                Audit History
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="classes">
                            <ClassesTab
                                classes={nonArchivedClasses}
                                loading={classesLoading}
                                programId={program_id!}
                                canAddClass={
                                    !!program.is_active && !program.archived_at
                                }
                                onOpenStatusModal={handleOpenStatusModal}
                                onCreated={() => void mutateClasses()}
                            />
                        </TabsContent>

                        <TabsContent value="details">
                            <ProgramDetailsTab program={program} />
                        </TabsContent>

                        <TabsContent value="performance">
                            <PerformanceTab
                                totalEnrolled={totalEnrolled}
                                totalCapacity={totalCapacity}
                                activeClassCount={activeClasses.length}
                                totalClassCount={nonArchivedClasses.length}
                                completionRate={program.completion_rate ?? 0}
                            />
                        </TabsContent>

                        <TabsContent value="history">
                            <AuditHistoryTab entries={history} />
                        </TabsContent>
                    </Tabs>
                </div>
            </div>

            <Dialog
                open={statusModalOpen}
                onOpenChange={handleCloseStatusModal}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Change Class Status</DialogTitle>
                        <DialogDescription>
                            Update the status for {selectedClass?.name}.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-0">
                        <Label htmlFor="classStatus" className="mb-0">
                            New Status
                        </Label>
                        <Select
                            value={selectedStatus}
                            onValueChange={(value) => {
                                setSelectedStatus(value);
                            }}
                        >
                            <SelectTrigger
                                id="classStatus"
                                className="h-9 bg-[#f3f3f5] border-[#d0d5dd] focus-visible:border-[#b3b3b3] focus-visible:ring-[3px] focus-visible:ring-[#b3b3b3]/50 focus-visible:ring-offset-0"
                            >
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {Object.values(ProgClassStatus).map((s) => (
                                    <SelectItem key={s} value={s}>
                                        {s}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <div className="h-2" />
                        <p className="text-xs text-gray-500">
                            {getStatusDescription(selectedStatus)}
                        </p>
                    </div>
                    <DialogFooter className="mt-6 gap-3">
                        <Button
                            variant="outline"
                            onClick={() => handleCloseStatusModal(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleSaveStatus}
                            className="bg-[#556830] hover:bg-[#203622] text-white"
                        >
                            Update Status
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete Program</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete{' '}
                            <strong>{program.name}</strong>? This action cannot
                            be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4 my-4">
                        <div className="flex gap-3">
                            <AlertCircle className="size-5 text-red-600 shrink-0 mt-0.5" />
                            <div>
                                <p className="text-sm text-red-900 font-medium mb-1">
                                    Warning
                                </p>
                                <p className="text-sm text-red-700">
                                    This will permanently delete the program and
                                    all associated data from the system. This
                                    operation is irreversible.
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="space-y-4 mb-2">
                        <div>
                            <Label htmlFor="deleteConfirmation">
                                To confirm, type the program name:{' '}
                                <strong>{program.name}</strong>
                            </Label>
                            <Input
                                id="deleteConfirmation"
                                placeholder="Type program name to confirm"
                                value={deleteConfirmationText}
                                onChange={(event) =>
                                    setDeleteConfirmationText(
                                        event.target.value
                                    )
                                }
                                className="mt-2 focus-visible:border-[#b3b3b3] focus-visible:ring-[#b3b3b3]/50"
                            />
                        </div>
                    </div>
                    <DialogFooter className="pt-4">
                        <Button
                            variant="outline"
                            onClick={() => {
                                setDeleteModalOpen(false);
                                setDeleteConfirmationText('');
                            }}
                            className="px-4 border-[#c9cfd6] focus-visible:border-[#b3b3b3] focus-visible:ring-[#b3b3b3]/50"
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={void handleDeleteProgram}
                            disabled={deleteConfirmationText !== program.name}
                            className="px-7 sm:ml-1 focus-visible:border-[#b3b3b3] focus-visible:ring-[#b3b3b3]/50"
                        >
                            <Trash2 className="size-4 mr-2" />
                            Delete Program
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <EditProgramDialog
                open={showEditDialog}
                onOpenChange={setShowEditDialog}
                program={program}
            />
        </div>
    );
}

function MetricBox({
    label,
    value,
    subtitle,
    valueClassName
}: {
    label: string;
    value: string | number;
    subtitle?: string;
    valueClassName?: string;
}) {
    return (
        <div className="rounded-lg p-3 bg-[#E2E7EA]">
            <p className="text-sm text-gray-600 mb-1">{label}</p>
            <p className={valueClassName ?? 'text-2xl text-[#203622]'}>
                {value}
            </p>
            {subtitle && (
                <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>
            )}
        </div>
    );
}

function ClassesTab({
    classes,
    loading,
    programId,
    canAddClass,
    onOpenStatusModal,
    onCreated
}: {
    classes: Class[];
    loading: boolean;
    programId: string;
    canAddClass: boolean;
    onOpenStatusModal: (cls: Class) => void;
    onCreated?: () => void;
}) {
    const navigate = useNavigate();
    const [showCreateForm, setShowCreateForm] = useState(false);
    const activeScheduledClasses = classes.filter(
        (cls) =>
            cls.status === SelectedClassStatus.Active ||
            cls.status === SelectedClassStatus.Scheduled
    );
    const completedClasses = classes.filter(
        (cls) => cls.status === SelectedClassStatus.Completed
    );
    const cancelledClasses = classes.filter(
        (cls) => cls.status === SelectedClassStatus.Cancelled
    );
    const pausedClasses = classes.filter(
        (cls) => cls.status === SelectedClassStatus.Paused
    );

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-[#203622]">Classes</h2>
                    <p className="text-sm text-gray-600 mt-1">
                        All classes offered under this program
                    </p>
                </div>
                <Button
                    disabled={!canAddClass}
                    onClick={() => {
                        if (!canAddClass) return;
                        setShowCreateForm((prev) => !prev);
                    }}
                    className="bg-[#F1B51C] text-[#203622] hover:bg-[#F1B51C]/90"
                >
                    <Plus className="size-4" />
                    {showCreateForm ? 'Cancel' : 'Create New Class'}
                </Button>
            </div>

            {showCreateForm && (
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <h3 className="text-[#203622] mb-4">Create New Class</h3>
                    <ClassManagementFormInner
                        programId={programId}
                        onCancel={() => setShowCreateForm(false)}
                        onCreated={() => {
                            setShowCreateForm(false);
                            onCreated?.();
                        }}
                        embedded
                    />
                </div>
            )}

            {loading ? (
                <p className="text-gray-600 text-center py-8">
                    Loading classes...
                </p>
            ) : classes.length === 0 ? (
                <p className="text-gray-600 text-center py-8">
                    No classes found for this program.
                </p>
            ) : (
                <div className="bg-white rounded-lg border border-gray-200">
                    {activeScheduledClasses.length > 0 && (
                        <div className="divide-y divide-gray-200">
                            <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                                <h3 className="text-sm font-medium text-gray-700">
                                    Active &amp; Scheduled Classes (
                                    {activeScheduledClasses.length})
                                </h3>
                            </div>
                            {activeScheduledClasses.map((cls) => (
                                <ClassCard
                                    key={cls.id}
                                    cls={cls}
                                    onOpenStatusModal={onOpenStatusModal}
                                    onClick={() =>
                                        navigate(
                                            `/program-classes/${cls.id}/dashboard`
                                        )
                                    }
                                    className="rounded-none border-0 shadow-none hover:shadow-none"
                                />
                            ))}
                        </div>
                    )}

                    {completedClasses.length > 0 && (
                        <div className="divide-y divide-gray-200">
                            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
                                <h3 className="text-sm font-medium text-gray-700">
                                    Completed Classes ({completedClasses.length}
                                    )
                                </h3>
                            </div>
                            {completedClasses.map((cls) => (
                                <ClassCard
                                    key={cls.id}
                                    cls={cls}
                                    onOpenStatusModal={onOpenStatusModal}
                                    onClick={() =>
                                        navigate(
                                            `/program-classes/${cls.id}/dashboard`
                                        )
                                    }
                                    className="rounded-none border-0 shadow-none hover:shadow-none bg-gray-50/50"
                                />
                            ))}
                        </div>
                    )}

                    {cancelledClasses.length > 0 && (
                        <div className="divide-y divide-gray-200">
                            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
                                <h3 className="text-sm font-medium text-gray-700">
                                    Cancelled Classes ({cancelledClasses.length}
                                    )
                                </h3>
                            </div>
                            {cancelledClasses.map((cls) => (
                                <ClassCard
                                    key={cls.id}
                                    cls={cls}
                                    onOpenStatusModal={onOpenStatusModal}
                                    onClick={() =>
                                        navigate(
                                            `/program-classes/${cls.id}/dashboard`
                                        )
                                    }
                                    className="rounded-none border-0 shadow-none hover:shadow-none bg-gray-50/50"
                                />
                            ))}
                        </div>
                    )}

                    {pausedClasses.length > 0 && (
                        <div className="divide-y divide-gray-200">
                            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
                                <h3 className="text-sm font-medium text-gray-700">
                                    Paused Classes ({pausedClasses.length})
                                </h3>
                            </div>
                            {pausedClasses.map((cls) => (
                                <ClassCard
                                    key={cls.id}
                                    cls={cls}
                                    onOpenStatusModal={onOpenStatusModal}
                                    onClick={() =>
                                        navigate(
                                            `/program-classes/${cls.id}/dashboard`
                                        )
                                    }
                                    className="rounded-none border-0 shadow-none hover:shadow-none bg-gray-50/50"
                                />
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

function ClassCard({
    cls,
    onOpenStatusModal,
    onClick,
    className
}: {
    cls: Class;
    onOpenStatusModal: (cls: Class) => void;
    onClick: () => void;
    className?: string;
}) {
    const schedule = getClassSchedule(cls);
    const enrollPct =
        cls.capacity > 0 ? (cls.enrolled / cls.capacity) * 100 : 0;
    const isTerminal =
        cls.status === SelectedClassStatus.Completed ||
        cls.status === SelectedClassStatus.Cancelled;

    const scheduleText = [
        schedule.days.join(', '),
        schedule.startTime && schedule.endTime
            ? `${schedule.startTime} - ${schedule.endTime}`
            : ''
    ]
        .filter(Boolean)
        .join('  ');

    return (
        <Card
            className={cn(
                'cursor-pointer transition-colors bg-white hover:bg-[#E2E7EA]/50',
                className
            )}
            onClick={onClick}
        >
            <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-foreground">
                                {cls.name}
                            </h3>
                            {isTerminal ? (
                                <Badge
                                    variant="outline"
                                    className={getStatusColor(cls.status)}
                                >
                                    {cls.status}
                                </Badge>
                            ) : (
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onOpenStatusModal(cls);
                                    }}
                                    className="inline-flex"
                                >
                                    <Badge
                                        variant="outline"
                                        className={cn(
                                            getStatusColor(cls.status),
                                            'cursor-pointer hover:opacity-80 transition-opacity flex items-center gap-1.5'
                                        )}
                                    >
                                        {cls.status}
                                        <Edit className="size-3" />
                                    </Badge>
                                </button>
                            )}
                        </div>
                        {cls.description && (
                            <p className="text-sm text-muted-foreground line-clamp-1">
                                {cls.description}
                            </p>
                        )}
                        <div className="flex items-center gap-6 text-sm text-muted-foreground">
                            {cls.instructor_name && (
                                <span>{cls.instructor_name}</span>
                            )}
                            {scheduleText && <span>{scheduleText}</span>}
                            {schedule.room && <span>{schedule.room}</span>}
                        </div>
                    </div>
                    <div className="shrink-0 w-40 text-right space-y-1">
                        <div className="flex items-baseline justify-between">
                            <span className="text-xs text-muted-foreground">
                                Enrollment
                            </span>
                            <span className="text-sm font-semibold text-foreground">
                                {cls.enrolled} / {cls.capacity}
                            </span>
                        </div>
                        <Progress
                            value={enrollPct}
                            className="h-2"
                            indicatorClassName="bg-[#556830]"
                        />
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

function ProgramDetailsTab({ program }: { program: ProgramOverview }) {
    const programStatus = program.archived_at
        ? 'Archived'
        : program.is_active
          ? 'Available'
          : 'Inactive';

    return (
        <Card className="bg-background">
            <CardContent className="p-6 space-y-6">
                <h3 className="text-[#203622] mb-6 font-normal">
                    Program Details
                </h3>

                <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Description</p>
                    <p className="text-foreground">
                        {program.description || 'No description provided.'}
                    </p>
                </div>

                <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">
                            Program Types
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                            {program.program_types?.map((pt) => (
                                <span
                                    key={pt.program_type}
                                    className={cn(
                                        'text-xs px-2.5 py-0.5 rounded-full border font-medium',
                                        programTypeColors[pt.program_type] ??
                                            'bg-muted text-foreground border-border'
                                    )}
                                >
                                    {formatEnum(pt.program_type)}
                                </span>
                            ))}
                        </div>
                    </div>
                    <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">
                            Credit Types
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {program.credit_types?.map((ct) => (
                                <span
                                    key={ct.credit_type}
                                    className="text-xs px-2.5 py-0.5 rounded-full border bg-gray-100 text-gray-700 border-gray-200 font-medium"
                                >
                                    {formatEnum(ct.credit_type)}
                                </span>
                            ))}
                        </div>
                    </div>
                    <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">
                            Funding Types
                        </p>
                        <p className="text-foreground">
                            {program.funding_type
                                ? formatEnum(String(program.funding_type))
                                : '-'}
                        </p>
                    </div>
                    <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">Status</p>
                        <Badge
                            variant="outline"
                            className={
                                programStatus === 'Available'
                                    ? 'bg-green-50 text-green-700 border-green-200'
                                    : programStatus === 'Archived'
                                      ? 'bg-red-50 text-red-700 border-red-200'
                                      : 'bg-muted text-foreground border-border'
                            }
                        >
                            {programStatus}
                        </Badge>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

function PerformanceTab({
    totalEnrolled,
    totalCapacity,
    activeClassCount,
    totalClassCount,
    completionRate
}: {
    totalEnrolled: number;
    totalCapacity: number;
    activeClassCount: number;
    totalClassCount: number;
    completionRate: number;
}) {
    const capacityPct =
        totalCapacity > 0
            ? Math.round((totalEnrolled / totalCapacity) * 100)
            : 0;
    const avgClassSize =
        activeClassCount > 0 ? Math.round(totalEnrolled / activeClassCount) : 0;

    return (
        <Card className="bg-background">
            <CardContent className="p-6 space-y-4">
                <h3 className="text-[#203622] mb-6 font-normal">
                    Performance Metrics
                </h3>
                <div className="grid grid-cols-2 gap-6">
                    <div className="bg-[#E2E7EA] rounded-lg p-4">
                        <p className="text-sm text-gray-600 mb-2">
                            Total Enrollment
                        </p>
                        <p className="text-3xl text-[#203622] mb-2">
                            {totalEnrolled}
                        </p>
                        <Progress
                            value={capacityPct}
                            className="h-2"
                            indicatorClassName="bg-[#556830]"
                        />
                        <p className="text-xs text-gray-500 mt-2">
                            {capacityPct}% of capacity
                        </p>
                    </div>
                    <div className="bg-[#E2E7EA] rounded-lg p-4">
                        <p className="text-sm text-gray-600 mb-2">
                            Average Class Size
                        </p>
                        <p className="text-3xl text-[#203622] mb-2">
                            {avgClassSize}
                        </p>
                        <p className="text-xs text-gray-500 mt-2">
                            residents per class
                        </p>
                    </div>
                    <div className="bg-[#E2E7EA] rounded-lg p-4">
                        <p className="text-sm text-gray-600 mb-2">
                            Active Classes
                        </p>
                        <p className="text-3xl text-[#203622] mb-2">
                            {activeClassCount}
                        </p>
                        <p className="text-xs text-gray-500 mt-2">
                            out of {totalClassCount} total
                        </p>
                    </div>
                    <div className="bg-[#E2E7EA] rounded-lg p-4">
                        <p className="text-sm text-gray-600 mb-2">
                            Completion Rate
                        </p>
                        <p className="text-3xl text-[#203622] mb-2">
                            {Math.round(completionRate)}%
                        </p>
                        <Progress
                            value={completionRate}
                            className="h-2"
                            indicatorClassName="bg-[#556830]"
                        />
                        <p className="text-xs text-gray-500 mt-2"></p>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

function AuditHistoryTab({ entries }: { entries: ChangeLogEntry[] }) {
    const { user } = useAuth();
    return (
        <Card className="bg-background">
            <CardContent className="p-6 space-y-4">
                <h3 className="text-[#203622] mb-6 font-normal">
                    Audit History
                </h3>
                {entries.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                        No history entries found.
                    </p>
                ) : (
                    <div className="space-y-3">
                        {entries.map((entry) => (
                            <div
                                key={entry.id}
                                className="flex items-baseline gap-6"
                            >
                                <span className="text-sm text-muted-foreground shrink-0 w-24">
                                    {new Date(
                                        entry.created_at
                                    ).toLocaleDateString('en-US', {
                                        month: 'numeric',
                                        day: 'numeric',
                                        year: 'numeric'
                                    })}
                                </span>
                                <p className="text-sm text-foreground">
                                    {formatHistoryEntry(entry, user?.timezone)}
                                </p>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
