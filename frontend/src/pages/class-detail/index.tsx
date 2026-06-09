import { useState, useRef, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import useSWR, { useSWRConfig } from 'swr';
import { BookOpen, Edit, MoreVertical, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger
} from '@/components/ui/tooltip';
import Breadcrumbs from '@/components/navigation/Breadcrumbs';
import { Class } from '@/types/program';
import { SelectedClassStatus, AttendanceFlag } from '@/types/attendance';
import { ServerResponseOne, ServerResponseMany } from '@/types/server';
import { BreadcrumbItem } from '@/types';
import { ClassHeader, StatCards } from './ClassHeader';
import { RosterTab } from './RosterTab';
import { EnrollmentHistoryTab } from './EnrollmentHistoryTab';
import { SessionsTab } from './SessionsTab';
import { ScheduleTab } from './ScheduleTab';
import { CanvasScheduleTab } from './CanvasScheduleTab';
import { CanvasSessionsTab } from './CanvasSessionsTab';
import { SupportTab } from './SupportTab';
import { AuditTab } from './AuditTab';
import { TakeAttendanceModal } from './TakeAttendanceModal';
import { DeleteClassModal } from './DeleteClassModal';
import { EditClassModal } from './EditClassModal';
import { LoadingSkeleton } from './LoadingSkeleton';
import { ClassNotFoundCard } from './ClassNotFoundCard';

interface DeleteBlockers {
    enrollments?: number;
    completions?: number;
    attendance_flags?: number;
    non_deletable_status?: string;
}

function getDeleteBlockerReason(blockers: DeleteBlockers | undefined): string {
    if (blockers?.non_deletable_status)
        return `Only Scheduled classes can be deleted (this class is ${blockers.non_deletable_status})`;
    if ((blockers?.enrollments ?? 0) > 0)
        return 'Cannot delete class with enrollment records';
    if ((blockers?.completions ?? 0) > 0)
        return 'Cannot delete class with program completions';
    if ((blockers?.attendance_flags ?? 0) > 0)
        return 'Cannot delete class with attendance records';
    return 'Cannot delete class';
}

export default function ClassDetailPage() {
    const { class_id } = useParams<{ class_id: string }>();
    const navigate = useNavigate();
    const { mutate: globalMutate } = useSWRConfig();
    const [showAttendanceModal, setShowAttendanceModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const editModalVersion = useRef(0);

    const {
        data: classResp,
        isLoading,
        mutate
    } = useSWR<ServerResponseOne<Class>>(
        class_id ? `/api/program-classes/${class_id}` : null
    );

    const cls = classResp?.data;
    const isCanvasClass = !!cls?.is_canvas;

    const { mutate: mutateEvents } = useSWR<ServerResponseMany<{ id: number }>>(
        class_id ? `/api/program-classes/${class_id}/events?all=true` : null
    );

    const { data: rateResp } = useSWR<
        ServerResponseOne<{ attendance_rate: number }>
    >(
        !isCanvasClass && class_id
            ? `/api/program-classes/${class_id}/attendance-rate`
            : null
    );

    const { data: flagsResp } = useSWR<ServerResponseMany<AttendanceFlag>>(
        class_id ? `/api/program-classes/${class_id}/attendance-flags` : null
    );

    const { data: deleteCheckResp, mutate: mutateDeleteCheck } = useSWR<
        ServerResponseOne<{
            can_delete: boolean;
            blockers: {
                enrollments?: number;
                completions?: number;
                attendance_flags?: number;
                non_deletable_status?: string;
            };
        }>
    >(class_id ? `/api/program-classes/${class_id}/delete-check` : null);
    const isDeleteCheckReady = deleteCheckResp !== undefined;
    const canDelete = deleteCheckResp?.data?.can_delete ?? false;
    const deleteBlockers = deleteCheckResp?.data?.blockers;
    const deleteBlockerReason = getDeleteBlockerReason(deleteBlockers);
    const attendanceRate = rateResp?.data?.attendance_rate ?? 0;
    const atRiskCount = flagsResp?.meta?.total ?? 0;
    const flaggedUserIds = useMemo(() => {
        const ids = new Set<number>();
        for (const f of flagsResp?.data ?? []) ids.add(f.user_id);
        return ids;
    }, [flagsResp?.data]);

    const breadcrumbItems: BreadcrumbItem[] = useMemo(() => {
        if (!cls) return [];
        return [
            { label: 'Dashboard', href: '/dashboard' },
            { label: 'Programs', href: '/programs' },
            {
                label: cls.program?.name ?? 'Program',
                href: `/programs/${cls.program_id}`
            },
            { label: cls.name }
        ];
    }, [cls]);

    if (isLoading) return <LoadingSkeleton />;

    if (!cls) {
        return <ClassNotFoundCard onBack={() => navigate('/classes')} />;
    }

    return (
        <div className="bg-[#E2E7EA]">
            {isCanvasClass && (
                <div className="bg-blue-50 border-b border-blue-200">
                    <div className="max-w-7xl mx-auto px-6 py-3 flex items-center gap-2 text-sm text-blue-700">
                        <BookOpen className="size-4 shrink-0" />
                        <span>
                            This class is managed externally in Canvas. Data is
                            read-only.
                        </span>
                    </div>
                </div>
            )}
            <div className="bg-white border-b border-gray-200">
                <div className="max-w-7xl mx-auto px-6 py-6">
                    <Breadcrumbs items={breadcrumbItems} />

                    <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                            <ClassHeader
                                cls={cls}
                                onMutate={() => {
                                    void mutate();
                                    void mutateDeleteCheck();
                                }}
                            />
                        </div>
                        {!isCanvasClass && (
                        <div className="flex gap-2 ml-6">
                            <Button
                                variant="outline"
                                className="border-gray-300"
                                onClick={() => {
                                    editModalVersion.current++;
                                    setShowEditModal(true);
                                }}
                            >
                                <Edit className="size-4 mr-2" />
                                Edit Class
                            </Button>
                            {cls.status === SelectedClassStatus.Active && (
                                <Button
                                    onClick={() => setShowAttendanceModal(true)}
                                    className="bg-brand-gold hover:bg-brand-gold-dark text-brand-dark"
                                >
                                    Take Attendance
                                </Button>
                            )}
                            <DropdownMenu>
                                <DropdownMenuTrigger className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-gray-100 h-9 w-9 p-0 border border-gray-300">
                                    <MoreVertical className="size-4" />
                                    <span className="sr-only">
                                        More options
                                    </span>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent
                                    align="end"
                                    className="z-100"
                                >
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <div>
                                                <DropdownMenuItem
                                                    variant="destructive"
                                                    onClick={() =>
                                                        setShowDeleteModal(true)
                                                    }
                                                    disabled={!canDelete}
                                                >
                                                    <Trash2 className="size-4 mr-2" />
                                                    Delete Class
                                                </DropdownMenuItem>
                                            </div>
                                        </TooltipTrigger>
                                        {isDeleteCheckReady && !canDelete && (
                                            <TooltipContent side="left">
                                                {deleteBlockerReason}
                                            </TooltipContent>
                                        )}
                                    </Tooltip>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-6 py-6">
                <StatCards
                    cls={cls}
                    attendanceRate={attendanceRate}
                    atRiskCount={atRiskCount}
                    isCanvasClass={isCanvasClass}
                />

                <Tabs defaultValue="roster" className="space-y-6">
                    <TabsList className="bg-white border border-gray-200 p-1 h-auto gap-1">
                        <TabsTrigger
                            value="roster"
                            className="tab-trigger-brand"
                        >
                            Roster ({cls.enrolled})
                        </TabsTrigger>
                        <TabsTrigger
                            value="support"
                            className="tab-trigger-brand"
                        >
                            At-Risk ({atRiskCount})
                        </TabsTrigger>
                        <TabsTrigger
                            value="sessions"
                            className="tab-trigger-brand"
                        >
                            Sessions
                        </TabsTrigger>
                        <TabsTrigger
                            value="schedule"
                            className="tab-trigger-brand"
                        >
                            Schedule
                        </TabsTrigger>
                        <TabsTrigger
                            value="enrollment-history"
                            className="tab-trigger-brand"
                        >
                            Enrollment History
                        </TabsTrigger>
                        <TabsTrigger
                            value="audit"
                            className="tab-trigger-brand"
                        >
                            Audit History
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="roster" className="space-y-4">
                        <RosterTab
                            classId={cls.id}
                            classFacilityId={cls.facility_id}
                            classStatus={cls.status}
                            classStartDt={cls.start_dt}
                            className={cls.name}
                            capacity={cls.capacity}
                            enrolled={cls.enrolled}
                            flaggedUserIds={flaggedUserIds}
                            isCanvasClass={isCanvasClass}
                            onClassMutate={() => {
                                void mutate();
                                void mutateDeleteCheck();
                            }}
                        />
                    </TabsContent>

                    <TabsContent
                        value="enrollment-history"
                        className="space-y-4"
                    >
                        {isCanvasClass ? (
                            <div className="bg-white rounded-lg border border-gray-200 p-12 text-center text-gray-500">
                                Enrollment history is managed in Canvas.
                            </div>
                        ) : (
                            <EnrollmentHistoryTab classId={cls.id} />
                        )}
                    </TabsContent>

                    <TabsContent value="sessions" className="space-y-4">
                        {isCanvasClass ? (
                            <CanvasSessionsTab classId={cls.id} />
                        ) : (
                            <SessionsTab cls={cls} onClassMutate={() => void mutate()} />
                        )}
                    </TabsContent>

                    <TabsContent value="schedule" className="space-y-4">
                        {isCanvasClass ? (
                            <CanvasScheduleTab classId={cls.id} />
                        ) : (
                            <ScheduleTab cls={cls} onClassMutate={() => void mutate()} />
                        )}
                    </TabsContent>

                    <TabsContent value="support" className="space-y-4">
                        <SupportTab classId={cls.id} isCanvasClass={isCanvasClass} />
                    </TabsContent>

                    <TabsContent value="audit" className="space-y-4">
                        {isCanvasClass ? (
                            <div className="bg-white rounded-lg border border-gray-200 p-12 text-center text-gray-500">
                                Audit history is not available for Canvas classes.
                            </div>
                        ) : (
                            <AuditTab classId={cls.id} />
                        )}
                    </TabsContent>
                </Tabs>
            </div>

            <TakeAttendanceModal
                open={showAttendanceModal}
                onOpenChange={setShowAttendanceModal}
                classId={cls.id}
                className={cls.name}
            />

            <DeleteClassModal
                open={showDeleteModal}
                onClose={() => setShowDeleteModal(false)}
                classId={cls.id}
                className={cls.name}
                onDeleted={() => navigate(`/programs/${cls.program_id}`)}
            />

            <EditClassModal
                key={editModalVersion.current}
                open={showEditModal}
                onOpenChange={setShowEditModal}
                cls={cls}
                onUpdated={() => {
                    void mutate();
                    void mutateEvents();
                    void mutateDeleteCheck();
                    void globalMutate(
                        (key: string) =>
                            typeof key === 'string' &&
                            key.startsWith(
                                `/api/program-classes/${class_id}/history`
                            ),
                        undefined,
                        { revalidate: true }
                    );
                }}
            />
        </div>
    );
}
