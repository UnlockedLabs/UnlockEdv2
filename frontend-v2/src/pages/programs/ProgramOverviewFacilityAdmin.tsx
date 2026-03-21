import { useState, useMemo } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import useSWR from 'swr';
import { toast } from 'sonner';
import {
    Plus,
    ArrowLeft,
    Edit,
    MoreVertical,
    Trash2,
    AlertCircle,
    BookOpen
} from 'lucide-react';
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
    Facility,
    ProgramOverview,
    ProgClassStatus,
    SelectedClassStatus,
    ChangeLogEntry,
    ServerResponseMany,
    ServerResponseOne
} from '@/types';
import { getStatusColor } from '@/lib/formatters';
import {
    programTypeColors,
    TAB_TRIGGER_CLASSES
} from '@/pages/program-detail/constants';
import { cn } from '@/lib/utils';
import { formatHistoryEntry } from '@/components/history/formatHistoryEntry';
import { ClassManagementFormInner } from '@/pages/programs/ClassManagementForm';
import EditProgramDialog from '@/pages/program-detail/EditProgramDialog';
import { isDeptAdmin, useAuth } from '@/auth/useAuth';
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
import { Pagination } from '@/components/Pagination';
import Breadcrumbs from '@/components/navigation/Breadcrumbs';
import {
    ArchiveConfirmDialog,
    CannotArchiveDialog,
    ReactivateDialog
} from '@/components/programs/ProgramDialogs';

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

export default function ProgramOverviewFacilityAdmin() {
    const navigate = useNavigate();
    const { program_id } = useParams<{ program_id: string }>();
    const [searchParams] = useSearchParams();
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState('classes');
    const [historyPage, setHistoryPage] = useState(1);
    const [historyPerPage, setHistoryPerPage] = useState(20);
    const [statusModalOpen, setStatusModalOpen] = useState(false);
    const [selectedClass, setSelectedClass] = useState<Class | null>(null);
    const [selectedStatus, setSelectedStatus] = useState('');
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [deleteConfirmationText, setDeleteConfirmationText] = useState('');
    const [showEditDialog, setShowEditDialog] = useState(false);
    const [showArchiveDialog, setShowArchiveDialog] = useState(false);
    const [showCannotArchiveDialog, setShowCannotArchiveDialog] = useState(false);
    const [showReactivateDialog, setShowReactivateDialog] = useState(false);
    const [archiveCheckLoading, setArchiveCheckLoading] = useState(false);
    const [archiveBlockingFacilities, setArchiveBlockingFacilities] = useState<string[]>([]);

    const facilityIdParam = searchParams.get('facility_id');
    const facilityId = facilityIdParam ? Number(facilityIdParam) : null;
    const facilityQuery = facilityId ? `&facility_id=${facilityId}` : '';
    const { data: facilityResp } = useSWR<ServerResponseOne<Facility>>(
        facilityId ? `/api/facilities/${facilityId}` : null
    );

    const { data: programResp, mutate: mutateProgram } = useSWR<
        ServerResponseOne<ProgramOverview>
    >(`/api/programs/${program_id}${facilityId ? `?facility_id=${facilityId}` : ''}`);
    const program = programResp?.data;

    const {
        data: classesResp,
        isLoading: classesLoading,
        mutate: mutateClasses
    } = useSWR<ServerResponseMany<Class>>(
        `/api/programs/${program_id}/classes?per_page=100&order_by=ps.start_dt asc${facilityQuery}`
    );
    const classes = useMemo(() => classesResp?.data ?? [], [classesResp?.data]);

    const { data: historyResp } = useSWR<ServerResponseMany<ChangeLogEntry>>(
        activeTab === 'history'
            ? `/api/programs/${program_id}/history?page=${historyPage}&per_page=${historyPerPage}`
            : null
    );
    const history = historyResp?.data ?? [];
    const historyTotal = historyResp?.meta?.total ?? history.length;

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
    const backendCompletionRate = program?.completion_rate ?? 0;

    async function handleArchiveCheck() {
        if (!program || archiveCheckLoading) return;
        setArchiveCheckLoading(true);
        const resp = await API.get<{ facilities: string[] }>(
            `programs/${program.id}/archive-check`
        );
        setArchiveCheckLoading(false);

        if (!resp.success) {
            toast.error(resp.message || 'Unable to check active class status.');
            return;
        }

        const blocking = (resp.data as { facilities: string[] }).facilities ?? [];
        if (blocking.length > 0) {
            setArchiveBlockingFacilities(blocking);
            setShowCannotArchiveDialog(true);
            return;
        }

        setShowArchiveDialog(true);
    }

    async function handleStatusSelectChange(value: string) {
        if (value === 'Archived') {
            void handleArchiveCheck();
            return;
        }
        if (value === 'Reactivate') {
            setShowReactivateDialog(true);
            return;
        }
        void handleProgramStatusChange(value);
    }

    async function handleReactivate(isActive: boolean) {
        if (!program) return;
        const resp = await API.patch<
            { updated: boolean; message: string },
            Record<string, unknown>
        >(`programs/${program.id}/status`, {
            archived_at: null,
            is_active: isActive
        });
        const statusUpdated =
            !Array.isArray(resp.data) && resp.data?.updated !== false;
        if (resp.success && statusUpdated) {
            toast.success(`${program.name} has been reactivated`);
            void mutateProgram();
        } else {
            toast.error(resp.message || 'Failed to reactivate program');
        }
    }

    async function handleProgramStatusChange(newStatus: string) {
        if (!program) return;
        const body: Record<string, unknown> = {};
        if (newStatus === 'Archived') {
            body.archived_at = new Date().toISOString();
            body.is_active = false;
        } else {
            body.is_active = newStatus === 'Available';
            if (program.archived_at) {
                body.archived_at = null;
            }
        }

        const resp = await API.patch<
            { updated: boolean; message: string },
            Record<string, unknown>
        >(`programs/${program.id}/status`, body);
        const statusUpdated =
            !Array.isArray(resp.data) && resp.data?.updated !== false;
        if (resp.success && statusUpdated) {
            const successMessage =
                newStatus === 'Archived'
                    ? `${program.name} has been archived`
                    : 'Program status updated';
            toast.success(successMessage);
            void mutateProgram();
        } else {
            toast.error(resp.message || 'Failed to update program status');
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

    const facilityFromProgram = facilityId
        ? program?.facilities?.find((facility) => facility.id === facilityId)
        : null;
    const facilityName =
        facilityFromProgram?.name ??
        facilityResp?.data?.name ??
        user?.facility?.name;
    const showFacilityContextBanner =
        Boolean(user && isDeptAdmin(user) && facilityId && facilityName);

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
    const breadcrumbs = showFacilityContextBanner
        ? [
              { label: 'Dashboard', href: '/dashboard' },
              { label: 'Programs', href: '/programs' },
              { label: program.name, href: `/programs/${program.id}` },
              { label: facilityName! }
          ]
        : [
              { label: 'Dashboard', href: '/dashboard' },
              { label: 'Programs', href: '/programs' },
              { label: program.name }
          ];

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
            {showFacilityContextBanner && (
                <div className="bg-blue-50 border-b border-blue-200">
                    <div className="max-w-7xl mx-auto px-6 py-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-sm">
                                <span className="text-blue-700 font-medium">
                                    Viewing:
                                </span>
                                <span className="text-blue-900">
                                    {program.name}
                                </span>
                                <span className="text-blue-600">at</span>
                                <span className="text-blue-900 font-medium">
                                    {facilityName}
                                </span>
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                    navigate(`/programs/${program.id}`)
                                }
                                className="text-blue-700 border-blue-300 hover:bg-blue-100"
                            >
                                <ArrowLeft className="size-3 mr-2" />
                                Back to Statewide View
                            </Button>
                        </div>
                    </div>
                </div>
            )}
            <div className="bg-white border-b border-gray-200">
                <div
                    className={`max-w-7xl mx-auto px-6 ${
                        showFacilityContextBanner ? 'pt-4 pb-6' : 'py-6'
                    }`}
                >
                    <Breadcrumbs items={breadcrumbs} className="mb-4" />
                    <div className="flex items-start gap-6 mt-6">
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
                                            onValueChange={(value) =>
                                                void handleStatusSelectChange(
                                                    value
                                                )
                                            }
                                            disabled={archiveCheckLoading}
                                        >
                                            <SelectTrigger className="w-[140px] h-9 focus-visible:border-[#b3b3b3] focus-visible:ring-[3px] focus-visible:ring-[#b3b3b3]/50 focus-visible:ring-offset-0">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {programStatus === 'Archived' ? (
                                                    <>
                                                        <SelectItem
                                                            value="Archived"
                                                            disabled
                                                        >
                                                            Archived
                                                        </SelectItem>
                                                        <SelectItem value="Reactivate">
                                                            Reactivate
                                                        </SelectItem>
                                                    </>
                                                ) : (
                                                    <>
                                                        <SelectItem value="Available">
                                                            Available
                                                        </SelectItem>
                                                        <SelectItem value="Inactive">
                                                            Inactive
                                                        </SelectItem>
                                                        <SelectItem value="Archived">
                                                            Archived
                                                        </SelectItem>
                                                    </>
                                                )}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <Button
                                        variant="outline"
                                        className="border-gray-300 mt-5 focus-visible:border-[#b3b3b3] focus-visible:ring-[3px] focus-visible:ring-[#b3b3b3]/50 focus-visible:ring-offset-0"
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
                        <TabsList className="bg-white border border-gray-200 p-1 h-auto mb-2 gap-1">
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

                        <TabsContent value="details" className="mt-4">
                            <ProgramDetailsTab program={program} />
                        </TabsContent>

                        <TabsContent value="performance" className="mt-4">
                            <PerformanceTab
                                totalEnrolled={totalEnrolled}
                                totalCapacity={totalCapacity}
                                activeClassCount={activeClasses.length}
                                totalClassCount={nonArchivedClasses.length}
                                completionRate={backendCompletionRate}
                            />
                        </TabsContent>

                        <TabsContent value="history" className="mt-4">
                            <AuditHistoryTab
                                entries={history}
                                totalItems={historyTotal}
                                currentPage={historyPage}
                                itemsPerPage={historyPerPage}
                                onPageChange={setHistoryPage}
                                onItemsPerPageChange={(val) => {
                                    setHistoryPerPage(val);
                                    setHistoryPage(1);
                                }}
                            />
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
            <ReactivateDialog
                open={showReactivateDialog}
                onOpenChange={setShowReactivateDialog}
                onConfirm={(isActive) => void handleReactivate(isActive)}
            />

            <ArchiveConfirmDialog
                open={showArchiveDialog}
                onOpenChange={setShowArchiveDialog}
                programName={program.name}
                onConfirm={() => void handleProgramStatusChange('Archived')}
            />

            <CannotArchiveDialog
                open={showCannotArchiveDialog}
                onOpenChange={(open) => {
                    if (!open) setArchiveBlockingFacilities([]);
                    setShowCannotArchiveDialog(open);
                }}
                programName={program.name}
                facilities={archiveBlockingFacilities}
            />
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
        <div className="space-y-4 pb-6">
            <div className="flex items-center justify-between mt-4">
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
                    <Plus className="size-5" />
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
            {showCreateForm && (
                <div className="mt-5 bg-transparent" aria-hidden="true" />
            )}

            {loading ? (
                <p className="text-gray-600 text-center py-8">
                    Loading classes...
                </p>
            ) : classes.length === 0 ? (
                <div className="p-12 text-center text-gray-500 bg-white rounded-lg border border-gray-200">
                    <BookOpen className="size-12 mx-auto mb-3 text-gray-300" />
                    <p>No classes yet</p>
                    <p className="text-sm mt-1">
                        Create the first class for this program
                    </p>
                </div>
            ) : (
                <div className="bg-white rounded-lg border border-gray-200">
                    {activeScheduledClasses.length > 0 && (
                        <div className="divide-y divide-gray-200">
                            <div className="px-6 py-4 bg-gray-50">
                                <h3 className="text-sm font-medium text-gray-700">
                                    Active &amp; Scheduled Classes (
                                    {activeScheduledClasses.length})
                                </h3>
                            </div>
                            {activeScheduledClasses.map((cls) => (
                                <ClassRow
                                    key={cls.id}
                                    cls={cls}
                                    onOpenStatusModal={onOpenStatusModal}
                                    onClick={() =>
                                        navigate(
                                            `/program-classes/${cls.id}/dashboard`
                                        )
                                    }
                                    className="hover:bg-[#E2E7EA]/50"
                                    editableStatus
                                    showEnrollment
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
                                <ClassRow
                                    key={cls.id}
                                    cls={cls}
                                    onOpenStatusModal={onOpenStatusModal}
                                    onClick={() =>
                                        navigate(
                                            `/program-classes/${cls.id}/dashboard`
                                        )
                                    }
                                    className="hover:bg-gray-100 bg-gray-50/50"
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
                                <ClassRow
                                    key={cls.id}
                                    cls={cls}
                                    onOpenStatusModal={onOpenStatusModal}
                                    onClick={() =>
                                        navigate(
                                            `/program-classes/${cls.id}/dashboard`
                                        )
                                    }
                                    className="hover:bg-gray-100 bg-gray-50/50"
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
                                <ClassRow
                                    key={cls.id}
                                    cls={cls}
                                    onOpenStatusModal={onOpenStatusModal}
                                    onClick={() =>
                                        navigate(
                                            `/program-classes/${cls.id}/dashboard`
                                        )
                                    }
                                    className="hover:bg-gray-100 bg-gray-50/50"
                                    editableStatus
                                />
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

function ClassRow({
    cls,
    onOpenStatusModal,
    onClick,
    className,
    editableStatus,
    showEnrollment
}: {
    cls: Class;
    onOpenStatusModal: (cls: Class) => void;
    onClick: () => void;
    className?: string;
    editableStatus?: boolean;
    showEnrollment?: boolean;
}) {
    const enrollPct =
        cls.capacity > 0 ? (cls.enrolled / cls.capacity) * 100 : 0;

    const scheduleText = String(cls.schedule ?? '');
    const roomText = String(cls.room ?? '');
    const metaItems = [cls.instructor_name, scheduleText, roomText].filter(
        (item): item is string => Boolean(item)
    );
    const attendanceRate =
        typeof cls.attendance_rate === 'number'
            ? Math.round(cls.attendance_rate)
            : null;
    const attendanceClass =
        attendanceRate !== null
            ? attendanceRate >= 85
                ? 'text-[#556830]'
                : attendanceRate >= 70
                  ? 'text-[#F1B51C]'
                  : 'text-gray-700'
            : 'text-gray-500';
    const showCompletion = cls.status === SelectedClassStatus.Completed;
    const completionBase = cls.historical_enrollments ?? 0;
    const completionRate =
        showCompletion && completionBase > 0
            ? Math.round((cls.completed / completionBase) * 100)
            : null;
    const completionClass =
        completionRate !== null
            ? completionRate >= 85
                ? 'text-[#556830]'
                : completionRate >= 70
                  ? 'text-[#F1B51C]'
                  : 'text-gray-700'
            : 'text-gray-500';

    return (
        <div
            className={cn(
                'p-6 cursor-pointer transition-colors',
                className ?? ''
            )}
            onClick={onClick}
        >
            <div className="flex items-start justify-between">
                <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                        <h4 className="text-[#203622] hover:text-[#556830] transition-colors">
                            {cls.name}
                        </h4>
                        {editableStatus ? (
                            <Badge
                                variant="outline"
                                className={cn(
                                    getStatusColor(cls.status),
                                    'cursor-pointer hover:opacity-80 transition-opacity flex items-center gap-1.5'
                                )}
                                onClick={(event) => {
                                    event.stopPropagation();
                                    onOpenStatusModal(cls);
                                }}
                            >
                                {cls.status}
                                <Edit className="size-3" />
                            </Badge>
                        ) : (
                            <Badge
                                variant="outline"
                                className={getStatusColor(cls.status)}
                            >
                                {cls.status}
                            </Badge>
                        )}
                    </div>
                    {cls.description && (
                        <p className="text-sm text-gray-600 mb-3">
                            {cls.description}
                        </p>
                    )}
                    {metaItems.length > 0 && (
                        <div className="flex items-center gap-6 text-sm text-gray-600 mb-3">
                            {metaItems.map((item, index) => (
                                <span key={`${item}-${index}`}>{item}</span>
                            ))}
                        </div>
                    )}
                    <div className="flex items-center gap-6 text-sm">
                        <div className="flex items-center gap-2">
                            <span className="text-gray-600">Attendance:</span>
                            <span className={`font-medium ${attendanceClass}`}>
                                {attendanceRate !== null
                                    ? `${attendanceRate}%`
                                    : '—'}
                            </span>
                        </div>
                        {showCompletion && (
                            <div className="flex items-center gap-2">
                                <span className="text-gray-600">
                                    Completion:
                                </span>
                                <span
                                    className={`font-medium ${completionClass}`}
                                >
                                    {completionRate !== null
                                        ? `${completionRate}%`
                                        : '—'}
                                </span>
                            </div>
                        )}
                    </div>
                </div>
                {showEnrollment && (
                    <div className="ml-6 min-w-[200px]">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm text-gray-600">
                                Enrollment
                            </span>
                            <span className="text-sm text-[#203622]">
                                {cls.enrolled} / {cls.capacity}
                            </span>
                        </div>
                        <Progress
                            value={enrollPct}
                            className="h-2"
                            indicatorClassName="bg-[#556830]"
                        />
                    </div>
                )}
            </div>
        </div>
    );
}

function ProgramDetailsTab({ program }: { program: ProgramOverview }) {
    const programStatus = program.archived_at
        ? 'Archived'
        : program.is_active
          ? 'Available'
          : 'Inactive';

    return (
        <Card className="bg-background p-0">
            <CardContent className="p-6 space-y-6">
                <h3 className="text-[#203622] mb-6 font-normal">
                    Program Details
                </h3>

                <div className="space-y-2">
                    <p className="text-sm text-gray-600">Description</p>
                    <p className="text-foreground">
                        {program.description || 'No description provided.'}
                    </p>
                </div>

                <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <p className="text-sm text-gray-600">Program Types</p>
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
                        <p className="text-sm text-gray-600">Credit Types</p>
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
                        <p className="text-sm text-gray-600">Funding Types</p>
                        <p className="text-foreground">
                            {program.funding_type
                                ? formatEnum(String(program.funding_type))
                                : '-'}
                        </p>
                    </div>
                    <div className="space-y-2">
                        <p className="text-sm text-gray-600">Status</p>
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
        <Card className="bg-background p-0">
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
                        <p className="text-xs text-gray-500 mt-2">&nbsp;</p>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

function AuditHistoryTab({
    entries,
    totalItems,
    currentPage,
    itemsPerPage,
    onPageChange,
    onItemsPerPageChange
}: {
    entries: ChangeLogEntry[];
    totalItems: number;
    currentPage: number;
    itemsPerPage: number;
    onPageChange: (page: number) => void;
    onItemsPerPageChange: (itemsPerPage: number) => void;
}) {
    const { user } = useAuth();
    return (
        <Card className="bg-background p-0">
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
            {totalItems > itemsPerPage && (
                <Pagination
                    currentPage={currentPage}
                    totalItems={totalItems}
                    itemsPerPage={itemsPerPage}
                    onPageChange={onPageChange}
                    onItemsPerPageChange={onItemsPerPageChange}
                    itemLabel="entries"
                />
            )}
        </Card>
    );
}
