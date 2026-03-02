import { useCallback, useEffect, useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import useSWR from 'swr';
import { useAuth, isUserDeactivated, isDeptAdmin } from '@/auth/useAuth';
import {
    ServerResponseOne,
    ServerResponseMany,
    ResidentEngagementProfile,
    ResidentProgramOverview,
    EnrollmentStatus
} from '@/types';
import { Skeleton } from '@/components/ui/skeleton';
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator
} from '@/components/ui/breadcrumb';
import { ResidentHeader } from './resident-profile/ResidentHeader';
import { ResidentMetrics } from './resident-profile/ResidentMetrics';

export default function ResidentProfile() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { user_id: residentId } = useParams<{ user_id: string }>();

    const {
        data: profileResp,
        error,
        isLoading
    } = useSWR<ServerResponseOne<ResidentEngagementProfile>, Error>(
        `/api/users/${residentId}/profile`
    );

    const { data: programsResp } = useSWR<
        ServerResponseMany<ResidentProgramOverview>
    >(residentId ? `/api/users/${residentId}/programs` : null);

    const profileData = profileResp?.data;
    const programs = useMemo(() => programsResp?.data ?? [], [programsResp]);

    const { activeEnrollments, completedPrograms, attendanceStats } =
        useMemo(() => {
            const active = programs.filter(
                (p) => p.enrollment_status === EnrollmentStatus.Enrolled
            );
            const completed = programs.filter(
                (p) => p.enrollment_status === EnrollmentStatus.Completed
            );
            const totalAttended = programs.reduce(
                (sum, p) => sum + (p.present_attendance ?? 0),
                0
            );
            const totalAbsent = programs.reduce(
                (sum, p) => sum + (p.absent_attendance ?? 0),
                0
            );
            const totalSessions = totalAttended + totalAbsent;
            const overallPercent =
                totalSessions > 0
                    ? Math.round((totalAttended / totalSessions) * 100)
                    : 0;

            return {
                activeEnrollments: active,
                completedPrograms: completed,
                attendanceStats: {
                    totalAttended,
                    totalSessions,
                    overallPercent
                }
            };
        }, [programs]);

    useEffect(() => {
        if (error?.message === 'Not Found') {
            navigate('/404');
        } else if (error) {
            navigate('/error');
        }
    }, [error, navigate]);

    const noop = useCallback(() => {
        /* PR 4 wires up real dialogs */
    }, []);

    if (error || !user) return null;

    if (isLoading) {
        return (
            <div className="-mx-6 -mt-4 -mb-4 min-h-[calc(100vh-4rem)] bg-[#E2E7EA]">
                <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
                    <Skeleton className="h-5 w-48" />
                    <Skeleton className="h-36 w-full" />
                    <div className="grid grid-cols-3 gap-4">
                        <Skeleton className="h-24" />
                        <Skeleton className="h-24" />
                        <Skeleton className="h-24" />
                    </div>
                </div>
            </div>
        );
    }

    if (!profileData) return null;

    const residentUser = profileData.user;
    const engagement = profileData.activity_engagement;
    const isDeactivated = isUserDeactivated(residentUser);
    const userIsDeptAdmin = isDeptAdmin(user);

    return (
        <div className="-mx-6 -mt-4 -mb-4 min-h-[calc(100vh-4rem)] bg-[#E2E7EA]">
            <div className="max-w-7xl mx-auto px-6 py-8">
                <Breadcrumb className="mb-6">
                    <BreadcrumbList>
                        <BreadcrumbItem>
                            <BreadcrumbLink asChild>
                                <Link to="/residents">Residents</Link>
                            </BreadcrumbLink>
                        </BreadcrumbItem>
                        <BreadcrumbSeparator />
                        <BreadcrumbItem>
                            <BreadcrumbPage>
                                {residentUser.name_first}{' '}
                                {residentUser.name_last}
                            </BreadcrumbPage>
                        </BreadcrumbItem>
                    </BreadcrumbList>
                </Breadcrumb>

                <ResidentHeader
                    user={residentUser}
                    facilityName={residentUser.facility?.name ?? ''}
                    joinedDate={engagement?.joined ?? ''}
                    lastActiveDate={engagement?.last_active_date ?? ''}
                    isDeactivated={isDeactivated}
                    isDeptAdmin={userIsDeptAdmin}
                    onEditProfile={noop}
                    onResetPassword={noop}
                    onDeactivate={noop}
                    onTransfer={noop}
                    onDelete={noop}
                />

                <ResidentMetrics
                    overallAttendancePercent={attendanceStats.overallPercent}
                    sessionsAttended={attendanceStats.totalAttended}
                    totalSessions={attendanceStats.totalSessions}
                    activeEnrollments={activeEnrollments.length}
                    completedPrograms={completedPrograms.length}
                />
            </div>
        </div>
    );
}
