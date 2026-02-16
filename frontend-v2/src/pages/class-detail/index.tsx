import { useNavigate, useParams } from 'react-router-dom';
import useSWR from 'swr';
import { ArrowLeft, Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Class } from '@/types/program';
import { EnrollmentAttendance } from '@/types/attendance';
import { ServerResponseOne, ServerResponseMany } from '@/types/server';
import { ClassHeader } from './ClassHeader';
import { RosterTab } from './RosterTab';
import { SupportTab } from './SupportTab';
import { ScheduleTab } from './ScheduleTab';
import { SessionsTab } from './SessionsTab';
import { EnrollmentHistoryTab } from './EnrollmentHistoryTab';
import { AuditTab } from './AuditTab';

const TAB_TRIGGER_CLASS =
    'data-[state=active]:bg-[#556830] data-[state=active]:text-white data-[state=active]:shadow-xs data-[state=inactive]:text-gray-500 data-[state=inactive]:hover:text-[#203622] data-[state=inactive]:hover:bg-[#E2E7EA] px-4 py-2.5 rounded-lg transition-all duration-200';

function LoadingSkeleton() {
    return (
        <div className="-mx-6 -mt-4 -mb-4 min-h-[calc(100vh-4rem)] bg-[#E2E7EA]">
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

    const { data: classResp, isLoading } = useSWR<ServerResponseOne<Class>>(
        class_id ? `/api/program-classes/${class_id}` : null
    );

    const { data: attendanceResp } = useSWR<
        ServerResponseMany<EnrollmentAttendance>
    >(class_id ? `/api/program-classes/${class_id}/enrollments` : null);

    if (isLoading) return <LoadingSkeleton />;

    const cls = classResp?.data;

    if (!cls) {
        return (
            <div className="-mx-6 -mt-4 -mb-4 min-h-[calc(100vh-4rem)] bg-[#E2E7EA] flex items-center justify-center">
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

    const attendanceRecords = attendanceResp?.data ?? [];

    return (
        <div className="-mx-6 -mt-4 -mb-4 min-h-[calc(100vh-4rem)] bg-[#E2E7EA]">
            <div className="bg-white border-b border-gray-200">
                <div className="max-w-7xl mx-auto px-6 py-6">
                    <Button
                        variant="ghost"
                        onClick={() => navigate('/classes')}
                        className="mb-4 -ml-2 text-gray-500 hover:text-[#203622]"
                    >
                        <ArrowLeft className="size-4 mr-2" />
                        Back to Classes
                    </Button>

                    <div className="flex items-start justify-between">
                        <div className="flex-1">
                            <ClassHeader
                                cls={cls}
                                attendanceRecords={attendanceRecords}
                            />
                        </div>
                        <div className="flex gap-2 ml-6 mt-1">
                            <Button
                                variant="outline"
                                className="border-gray-300"
                                onClick={() =>
                                    navigate(
                                        `/program-classes/${cls.id}/dashboard`
                                    )
                                }
                            >
                                <Edit className="size-4 mr-2" />
                                Edit Class
                            </Button>
                            {cls.status === 'Active' && (
                                <Button
                                    onClick={() => {
                                        const event = cls.events?.find(
                                            (e) => !e.is_cancelled
                                        );
                                        if (event) {
                                            const today = new Date()
                                                .toISOString()
                                                .split('T')[0];
                                            navigate(
                                                `/program-classes/${cls.id}/events/${event.id}/attendance/${today}`
                                            );
                                        }
                                    }}
                                    className="bg-[#F1B51C] hover:bg-[#d9a419] text-[#203622]"
                                >
                                    Take Attendance
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-6 py-6">
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
                            At-Risk
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
                        <RosterTab classId={cls.id} />
                    </TabsContent>

                    <TabsContent value="support" className="space-y-4">
                        <SupportTab classId={cls.id} />
                    </TabsContent>

                    <TabsContent value="sessions">
                        <SessionsTab cls={cls} />
                    </TabsContent>

                    <TabsContent value="schedule">
                        <ScheduleTab cls={cls} />
                    </TabsContent>

                    <TabsContent
                        value="enrollment-history"
                        className="space-y-4"
                    >
                        <EnrollmentHistoryTab classId={cls.id} />
                    </TabsContent>

                    <TabsContent value="audit">
                        <AuditTab classId={cls.id} />
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}
