import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import useSWR from 'swr';
import { useAuth, hasFeature, isUserDeactivated } from '@/auth/useAuth';
import { useToast } from '@/contexts/ToastContext';
import API from '@/api/api';
import {
    User,
    UserRole,
    ServerResponseOne,
    ResidentEngagementProfile,
    FeatureAccess,
    OpenContentResponse,
    ResidentProgramOverview,
    ServerResponseMany,
    ToastState,
    ActivityHistoryResponse
} from '@/types';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTable, Column } from '@/components/shared/DataTable';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import {
    UserCircle,
    MoreHorizontal,
    Trash2,
    Download,
    FileSpreadsheet,
    UserX,
    Calendar,
    Clock,
    Activity
} from 'lucide-react';

function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

function getTimestamp(): string {
    const now = new Date();
    return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
}

function ProfileInfoRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex justify-between py-1.5 text-sm">
            <span className="text-muted-foreground">{label}</span>
            <span className="font-medium text-[#203622]">{value}</span>
        </div>
    );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
    return (
        <Card className="bg-white">
            <CardContent className="flex items-center gap-3 py-4">
                <div className="rounded-lg bg-[#E2E7EA] p-2">{icon}</div>
                <div>
                    <p className="text-2xl font-bold text-[#203622]">{value}</p>
                    <p className="text-xs text-muted-foreground">{label}</p>
                </div>
            </CardContent>
        </Card>
    );
}

export default function ResidentProfile() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { toaster } = useToast();
    const { user_id: residentId } = useParams<{ user_id: string }>();

    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [deactivateDialogOpen, setDeactivateDialogOpen] = useState(false);

    const {
        data: profileResp,
        error,
        mutate: mutateProfile,
        isLoading
    } = useSWR<ServerResponseOne<ResidentEngagementProfile>>(
        `/api/users/${residentId}/profile`
    );

    const { data: programsResp } = useSWR<ServerResponseMany<ResidentProgramOverview>>(
        residentId ? `/api/users/${residentId}/programs` : null
    );

    const { data: activityResp } = useSWR<ServerResponseMany<ActivityHistoryResponse>>(
        residentId ? `/api/users/${residentId}/activity-history?per_page=10` : null
    );

    if (error?.message === 'Not Found') {
        navigate('/404');
        return null;
    }
    if (error) {
        navigate('/error');
        return null;
    }
    if (!user) return null;

    const metrics = profileResp?.data;
    const programs = programsResp?.data ?? [];
    const activityHistory = activityResp?.data ?? [];

    const handleDeleteUser = async () => {
        if (!metrics?.user) return;
        if (metrics.user.role === UserRole.SystemAdmin) {
            toaster('This is the primary administrator and cannot be deleted', ToastState.error);
            return;
        }
        const response = await API.delete('users/' + metrics.user.id);
        if (response.success) {
            toaster('Resident deleted successfully', ToastState.success);
            navigate('/residents');
        } else {
            toaster('Failed to delete resident', ToastState.error);
        }
        setDeleteDialogOpen(false);
    };

    const handleDeactivateUser = async () => {
        if (!metrics?.user?.id) return;
        const response = await API.post(`users/${metrics.user.id}/deactivate`, {});
        if (response.success) {
            toaster('Resident deactivated successfully', ToastState.success);
            void mutateProfile();
        } else {
            toaster('Failed to deactivate resident', ToastState.error);
        }
        setDeactivateDialogOpen(false);
    };

    async function downloadUsageReport() {
        try {
            const response = await fetch(`/api/users/${residentId}/usage-report`);
            if (!response.ok) {
                toaster('Failed to generate resident usage report', ToastState.error);
                return;
            }
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const id = metrics?.user?.doc_id ?? residentId;
            const filename = `usage-report-${id}-${getTimestamp()}.pdf`;
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = filename;
            document.body.appendChild(anchor);
            anchor.click();
            anchor.remove();
            window.URL.revokeObjectURL(url);
        } catch {
            toaster('Failed to download resident usage report', ToastState.error);
        }
    }

    function downloadAttendanceExport() {
        API.downloadFile(`users/${residentId}/attendance-export`)
            .then(({ blob, headers }) => {
                const disposition = headers.get('Content-Disposition') ?? '';
                const match = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(disposition);
                const filename = match?.[1]?.replace(/['"]/g, '') ?? `Attendance-${residentId}-${getTimestamp()}.csv`;
                const url = window.URL.createObjectURL(blob);
                const anchor = document.createElement('a');
                anchor.href = url;
                anchor.download = filename;
                document.body.appendChild(anchor);
                anchor.click();
                anchor.remove();
                window.URL.revokeObjectURL(url);
            })
            .catch(() => {
                toaster('Failed to download attendance export', ToastState.error);
            });
    }

    const engagementMetrics = metrics?.activity_engagement;
    const avgHoursWeekly = engagementMetrics ? engagementMetrics.total_hours_active_monthly / 4 : 0;
    const weeklyHours = engagementMetrics?.total_hours_active_weekly ?? 0;
    const weeklyMinutes = engagementMetrics?.total_minutes_active_weekly ?? 0;

    const weekValue = weeklyHours >= 1 ? weeklyHours.toFixed(1) : weeklyMinutes > 0 ? `${weeklyMinutes}` : '0';
    const weekUnit = weeklyHours >= 1 ? 'hours' : 'min';
    const avgValue = avgHoursWeekly >= 1 ? avgHoursWeekly.toFixed(1) : avgHoursWeekly > 0 ? '<1' : '0';
    const avgUnit = avgHoursWeekly >= 1 ? 'hours' : 'min';

    const programColumns: Column<ResidentProgramOverview>[] = [
        {
            key: 'program',
            header: 'Program',
            render: (p) => <span className="font-medium text-[#203622]">{p.program_name}</span>
        },
        {
            key: 'class',
            header: 'Class',
            render: (p) => p.class_name
        },
        {
            key: 'status',
            header: 'Status',
            render: (p) => <StatusBadge status={p.status} variant="progClass" />
        },
        {
            key: 'enrollment',
            header: 'Enrollment',
            render: (p) => p.enrollment_status ? <StatusBadge status={p.enrollment_status} variant="enrollment" /> : '\u2014'
        },
        {
            key: 'attendance',
            header: 'Attendance',
            render: (p) => p.attendance_percentage != null ? `${Math.round(p.attendance_percentage)}%` : '\u2014'
        },
        {
            key: 'start_date',
            header: 'Start Date',
            render: (p) => p.start_date ? formatDate(p.start_date) : '\u2014'
        }
    ];

    const libraryColumns: Column<OpenContentResponse>[] = [
        {
            key: 'title',
            header: 'Library Name',
            render: (item) => (
                <span>
                    {item.is_featured ? `${item.title ?? 'Untitled'} *` : item.title ?? 'Untitled'}
                </span>
            )
        },
        {
            key: 'hours',
            header: 'Hours',
            className: 'text-right',
            headerClassName: 'text-right',
            render: (item) => item.total_hours.toFixed(2)
        }
    ];

    const activityColumns: Column<ActivityHistoryResponse>[] = [
        {
            key: 'action',
            header: 'Action',
            render: (a) => (
                <span className="capitalize">{a.action.replace(/_/g, ' ')}</span>
            )
        },
        {
            key: 'detail',
            header: 'Detail',
            render: (a) => a.new_value || a.class_name || '\u2014'
        },
        {
            key: 'date',
            header: 'Date',
            render: (a) => formatDate(new Date(a.created_at).toISOString())
        }
    ];

    if (isLoading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-8 w-64" />
                <div className="grid grid-cols-3 gap-6">
                    <Skeleton className="h-48" />
                    <Skeleton className="h-48 col-span-2" />
                </div>
            </div>
        );
    }

    if (!metrics) return null;

    const isDeactivated = isUserDeactivated(metrics.user);

    return (
        <div className="space-y-6">
            <PageHeader
                title={`${metrics.user.name_first} ${metrics.user.name_last}`}
                subtitle="Resident Profile"
                actions={
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline">
                                <MoreHorizontal className="size-4 mr-2" />
                                Actions
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => void downloadUsageReport()}>
                                <Download className="size-4 mr-2" />
                                Download Usage Report (PDF)
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => downloadAttendanceExport()}>
                                <FileSpreadsheet className="size-4 mr-2" />
                                Export Attendance
                            </DropdownMenuItem>
                            {!isDeactivated && (
                                <DropdownMenuItem onClick={() => setDeactivateDialogOpen(true)}>
                                    <UserX className="size-4 mr-2" />
                                    Deactivate Resident
                                </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                                onClick={() => setDeleteDialogOpen(true)}
                                className="text-destructive"
                            >
                                <Trash2 className="size-4 mr-2" />
                                Delete Resident
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                }
            />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="bg-white">
                    <CardContent className="pt-6 space-y-3">
                        <div className="flex flex-col items-center mb-4">
                            <UserCircle className="size-20 text-[#556830]" />
                            <h2 className="text-xl font-bold text-[#203622] mt-2">
                                {metrics.user.name_first} {metrics.user.name_last}
                            </h2>
                            {isDeactivated && (
                                <span className="mt-1 inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full border bg-amber-50 text-amber-700 border-amber-200">
                                    Deactivated
                                </span>
                            )}
                        </div>
                        <ProfileInfoRow label="Username" value={metrics.user.username} />
                        <ProfileInfoRow label="Resident ID" value={metrics.user.doc_id ?? 'N/A'} />
                        <ProfileInfoRow
                            label="Joined"
                            value={
                                engagementMetrics?.joined
                                    ? formatDate(engagementMetrics.joined)
                                    : 'No Date Available'
                            }
                        />
                        <ProfileInfoRow
                            label="Last Active"
                            value={
                                engagementMetrics?.last_active_date
                                    ? formatDate(engagementMetrics.last_active_date)
                                    : 'N/A'
                            }
                        />
                        {metrics.user.deactivated_at && (
                            <ProfileInfoRow
                                label="Date Deactivated"
                                value={formatDate(metrics.user.deactivated_at)}
                            />
                        )}
                    </CardContent>
                </Card>

                <div className="lg:col-span-2 grid grid-cols-3 gap-4">
                    <StatCard
                        icon={<Calendar className="size-5 text-[#556830]" />}
                        label="Days Active"
                        value={engagementMetrics?.total_active_days_monthly.toFixed(0) ?? '0'}
                    />
                    <StatCard
                        icon={<Clock className="size-5 text-[#556830]" />}
                        label="Avg Time Per Week"
                        value={`${avgValue} ${avgUnit}`}
                    />
                    <StatCard
                        icon={<Activity className="size-5 text-[#556830]" />}
                        label="Total Time This Week"
                        value={`${weekValue} ${weekUnit}`}
                    />
                </div>
            </div>

            <Tabs defaultValue="programs">
                <TabsList>
                    {hasFeature(user, FeatureAccess.ProgramAccess) && (
                        <TabsTrigger value="programs">Programs</TabsTrigger>
                    )}
                    <TabsTrigger value="libraries">Top Libraries</TabsTrigger>
                    <TabsTrigger value="activity">Activity History</TabsTrigger>
                </TabsList>

                {hasFeature(user, FeatureAccess.ProgramAccess) && (
                    <TabsContent value="programs">
                        <DataTable
                            columns={programColumns}
                            data={programs}
                            keyExtractor={(p) => `${p.program_id}-${p.class_id}`}
                            emptyMessage="No program enrollments found."
                            onRowClick={(p) => navigate(`/program-classes/${p.class_id}/dashboard`)}
                        />
                    </TabsContent>
                )}

                <TabsContent value="libraries">
                    <DataTable
                        columns={libraryColumns}
                        data={metrics.top_libraries ?? []}
                        keyExtractor={(item) => item.content_id}
                        emptyMessage="No library activity found."
                        onRowClick={(item) => navigate(`/viewer/libraries/${item.content_id}`)}
                    />
                    {(metrics.top_libraries ?? []).some((l) => l.is_featured) && (
                        <p className="text-xs text-muted-foreground italic mt-2">
                            * Featured library
                        </p>
                    )}
                </TabsContent>

                <TabsContent value="activity">
                    <DataTable
                        columns={activityColumns}
                        data={activityHistory}
                        keyExtractor={(a) => `${a.action}-${new Date(a.created_at).getTime()}-${a.field_name}`}
                        emptyMessage="No activity history found."
                    />
                </TabsContent>
            </Tabs>

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
                open={deactivateDialogOpen}
                onOpenChange={setDeactivateDialogOpen}
                title="Deactivate Resident"
                description={`Are you sure you want to deactivate ${metrics.user.name_first} ${metrics.user.name_last}? They will no longer be able to log in.`}
                confirmLabel="Deactivate"
                onConfirm={() => void handleDeactivateUser()}
                variant="destructive"
            />
        </div>
    );
}
