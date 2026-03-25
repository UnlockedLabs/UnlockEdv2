import { useState, useRef, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import useSWR, { useSWRConfig } from 'swr';
import { Edit, MoreVertical, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
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
import { SupportTab } from './SupportTab';
import { AuditTab } from './AuditTab';
import { TakeAttendanceModal } from './TakeAttendanceModal';
import { DeleteClassModal } from './DeleteClassModal';
import { EditClassModal } from './EditClassModal';

const TAB_TRIGGER_CLASS =
    'data-[state=active]:bg-[#556830] data-[state=active]:text-white data-[state=active]:shadow-sm data-[state=inactive]:text-gray-600 data-[state=inactive]:hover:text-[#203622] data-[state=inactive]:hover:bg-gray-50 px-4 py-2.5 rounded-lg transition-all duration-200';

function LoadingSkeleton() {
    return (
        <div className="bg-[#E2E7EA]">
            <div className="bg-white border-b border-gray-200">
                <div className="max-w-7xl mx-auto px-6 py-6">
                    <Skeleton className="h-8 w-32 mb-4" />
                    <Skeleton className="h-10 w-80 mb-3" />
                    <Skeleton className="h-5 w-48 mb-4" />
                    <div className="grid grid-cols-5 gap-4">
                        {Array.from({ length: 5 }).map((_, i) => (
                            <Skeleton key={i} className="h-20 rounded-lg" />
                        ))}
                    </div>
                </div>
            </div>
            <div className="max-w-7xl mx-auto px-6 py-6">
                <div className="grid grid-cols-3 gap-6 mb-6">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <Skeleton key={i} className="h-40 rounded-lg" />
                    ))}
                </div>
            </div>
        </div>
    );
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

    const { mutate: mutateEvents } = useSWR<
        ServerResponseMany<{ id: number }>
    >(class_id ? `/api/program-classes/${class_id}/events?all=true` : null);

    const { data: rateResp } = useSWR<ServerResponseOne<{ attendance_rate: number }>>(
        class_id ? `/api/program-classes/${class_id}/attendance-rate` : null
    );

    const { data: flagsResp } = useSWR<ServerResponseMany<AttendanceFlag>>(
        class_id ? `/api/program-classes/${class_id}/attendance-flags?per_page=1` : null
    );

    const cls = classResp?.data;
    const attendanceRate = rateResp?.data?.attendance_rate ?? 0;
    const atRiskCount = flagsResp?.meta?.total ?? 0;

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
        return (
            <div className="bg-[#E2E7EA] flex items-center justify-center">
                <div className="bg-white rounded-lg border border-gray-200 p-8 text-center max-w-md">
                    <h2 className="text-xl font-semibold text-[#203622] mb-2">
                        Class Not Found
                    </h2>
                    <p className="text-gray-500 mb-4">
                        The class you are looking for does not exist or you do
                        not have access to it.
                    </p>
                    <Button
                        onClick={() => navigate('/classes')}
                        className="bg-[#556830] hover:bg-[#203622]"
                    >
                        Back to Classes
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-[#E2E7EA]">
            <div className="bg-white border-b border-gray-200">
                <div className="max-w-7xl mx-auto px-6 py-6">
                    <Breadcrumbs items={breadcrumbItems} />

                    <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                            <ClassHeader
                                cls={cls}
                                onMutate={() => void mutate()}
                            />
                        </div>
                        <div className="flex gap-2 ml-6">
                            <Button
                                variant="outline"
                                className="border-gray-300"
                                onClick={() => { editModalVersion.current++; setShowEditModal(true); }}
                            >
                                <Edit className="size-4 mr-2" />
                                Edit Class
                            </Button>
                            {cls.status === SelectedClassStatus.Active && (
                                <Button
                                    onClick={() =>
                                        setShowAttendanceModal(true)
                                    }
                                    className="bg-[#F1B51C] hover:bg-[#d9a419] text-[#203622]"
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
                                    className="z-[100]"
                                >
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <div>
                                                <DropdownMenuItem
                                                    variant="destructive"
                                                    onClick={() =>
                                                        setShowDeleteModal(true)
                                                    }
                                                    disabled={cls.enrolled > 0}
                                                >
                                                    <Trash2 className="size-4 mr-2" />
                                                    Delete Class
                                                </DropdownMenuItem>
                                            </div>
                                        </TooltipTrigger>
                                        {cls.enrolled > 0 && (
                                            <TooltipContent side="left">
                                                Cannot delete class with
                                                enrolled residents
                                            </TooltipContent>
                                        )}
                                    </Tooltip>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-6 py-6">
                <StatCards
                    cls={cls}
                    attendanceRate={attendanceRate}
                    atRiskCount={atRiskCount}
                />

                <Tabs defaultValue="roster" className="space-y-6">
                    <TabsList className="bg-white border border-gray-200 p-1 h-auto gap-1">
                        <TabsTrigger
                            value="roster"
                            className={TAB_TRIGGER_CLASS}
                        >
                            Roster ({cls.enrolled})
                        </TabsTrigger>
                        <TabsTrigger
                            value="support"
                            className={TAB_TRIGGER_CLASS}
                        >
                            At-Risk ({atRiskCount})
                        </TabsTrigger>
                        <TabsTrigger
                            value="sessions"
                            className={TAB_TRIGGER_CLASS}
                        >
                            Sessions
                        </TabsTrigger>
                        <TabsTrigger
                            value="schedule"
                            className={TAB_TRIGGER_CLASS}
                        >
                            Schedule
                        </TabsTrigger>
                        <TabsTrigger
                            value="enrollment-history"
                            className={TAB_TRIGGER_CLASS}
                        >
                            Enrollment History
                        </TabsTrigger>
                        <TabsTrigger
                            value="audit"
                            className={TAB_TRIGGER_CLASS}
                        >
                            Audit History
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="roster" className="space-y-4">
                        <RosterTab classId={cls.id} classStatus={cls.status} className={cls.name} capacity={cls.capacity} enrolled={cls.enrolled} onClassMutate={() => void mutate()} />
                    </TabsContent>

                    <TabsContent
                        value="enrollment-history"
                        className="space-y-4"
                    >
                        <EnrollmentHistoryTab classId={cls.id} />
                    </TabsContent>

                    <TabsContent value="sessions" className="space-y-4">
                        <SessionsTab cls={cls} onClassMutate={() => void mutate()} />
                    </TabsContent>

                    <TabsContent value="schedule" className="space-y-4">
                        <ScheduleTab cls={cls} onClassMutate={() => void mutate()} />
                    </TabsContent>

                    <TabsContent value="support" className="space-y-4">
                        <SupportTab classId={cls.id} />
                    </TabsContent>

                    <TabsContent value="audit" className="space-y-4">
                        <AuditTab classId={cls.id} />
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
                onDeleted={() =>
                    navigate(`/programs/${cls.program_id}`)
                }
            />

            <EditClassModal
                key={editModalVersion.current}
                open={showEditModal}
                onOpenChange={setShowEditModal}
                cls={cls}
                onUpdated={() => {
                    void mutate();
                    void mutateEvents();
                    void globalMutate(
                        (key: string) => typeof key === 'string' && key.startsWith(`/api/program-classes/${class_id}/history`),
                        undefined,
                        { revalidate: true }
                    );
                }}
            />
        </div>
    );
}
