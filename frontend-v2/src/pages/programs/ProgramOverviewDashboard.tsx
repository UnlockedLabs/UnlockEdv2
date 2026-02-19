import { useState, useMemo } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import useSWR from 'swr';
import { toast } from 'sonner';
import { ArrowLeft, Plus, Lightbulb, Pencil } from 'lucide-react';
import API from '@/api/api';
import { useAuth, canSwitchFacility } from '@/auth/useAuth';
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
import { programTypeColors, TAB_TRIGGER_CLASSES } from '@/pages/program-detail/constants';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export function isCompletedCancelledOrArchived(cls: Class): boolean {
    return (
        cls.status === SelectedClassStatus.Completed ||
        cls.status === SelectedClassStatus.Cancelled ||
        !!cls.archived_at
    );
}

function formatEnum(value: string): string {
    return value.replace(/_/g, ' ').replace(/-/g, ' ');
}

export default function ProgramOverviewDashboard() {
    const navigate = useNavigate();
    const { program_id } = useParams<{ program_id: string }>();
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState('classes');

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
            ? `/api/programs/${program_id}/history?per_page=50`
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
        () => nonArchivedClasses.reduce((sum, c) => sum + c.capacity, 0),
        [nonArchivedClasses]
    );

    const totalEnrolled = useMemo(
        () => nonArchivedClasses.reduce((sum, c) => sum + c.enrolled, 0),
        [nonArchivedClasses]
    );

    const utilization =
        totalCapacity > 0 ? Math.round((totalEnrolled / totalCapacity) * 100) : 0;

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
        const resp = await API.patch(
            `programs/${program_id}/classes/${cls.id}`,
            { status: newStatus }
        );
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

    return (
        <div className="-mx-6 -my-4">
            <div className="px-6 pt-4 pb-6 bg-background space-y-5">
                <Link
                    to="/programs"
                    className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                    <ArrowLeft className="size-4" />
                    Back to Programs
                </Link>

                <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4">
                        <div className="size-14 rounded-xl bg-[#556830]/10 flex items-center justify-center shrink-0">
                            <Lightbulb className="size-7 text-[#556830]" />
                        </div>
                        <div>
                            <h1 className="text-xl font-semibold text-foreground">
                                {program.name}
                            </h1>
                            {program.program_types?.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 mt-1.5">
                                    {program.program_types.map((pt) => (
                                        <span
                                            key={pt.program_type}
                                            className={cn(
                                                'text-xs px-2.5 py-0.5 rounded-full border font-medium',
                                                programTypeColors[
                                                    pt.program_type
                                                ] ??
                                                    'bg-muted text-foreground border-border'
                                            )}
                                        >
                                            {formatEnum(pt.program_type)}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right">
                            <p className="text-xs text-muted-foreground mb-1">
                                Program Status
                            </p>
                            <Select
                                value={programStatus}
                                onValueChange={(v) => { void handleProgramStatusChange(v); }}
                                disabled={!!program.archived_at}
                            >
                                <SelectTrigger className="w-32 h-9">
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
                        {canSwitchFacility(user!) && (
                            <Button
                                variant="outline"
                                onClick={() =>
                                    navigate(
                                        `/programs/detail/${program.id}`
                                    )
                                }
                            >
                                <Pencil className="size-4" />
                                Edit Program
                            </Button>
                        )}
                    </div>
                </div>

                {program.description && (
                    <p className="text-muted-foreground text-sm max-w-3xl">
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
                    />
                </div>
            </div>

            <div className="px-6 py-6 bg-muted/40 min-h-[50vh]">
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <TabsList className="bg-transparent p-0 h-auto mb-6">
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
                            onStatusChange={(cls, status) => { void handleClassStatusChange(cls, status); }}
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
    );
}

function MetricBox({
    label,
    value,
    subtitle
}: {
    label: string;
    value: string | number;
    subtitle?: string;
}) {
    return (
        <div className="border rounded-lg p-4 bg-muted/30">
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold text-foreground mt-1">{value}</p>
            {subtitle && (
                <p className="text-xs text-muted-foreground mt-0.5">
                    {subtitle}
                </p>
            )}
        </div>
    );
}

function ClassesTab({
    classes,
    loading,
    programId,
    canAddClass,
    onStatusChange
}: {
    classes: Class[];
    loading: boolean;
    programId: string;
    canAddClass: boolean;
    onStatusChange: (cls: Class, status: string) => void;
}) {
    const navigate = useNavigate();

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-semibold text-foreground">
                        Classes
                    </h2>
                    <p className="text-sm text-muted-foreground">
                        All classes offered under this program
                    </p>
                </div>
                <Button
                    disabled={!canAddClass}
                    onClick={() =>
                        navigate(`/programs/${programId}/classes`)
                    }
                    className="bg-[#F1B51C] text-foreground hover:bg-[#F1B51C]/90"
                >
                    <Plus className="size-4" />
                    Create New Class
                </Button>
            </div>

            {loading ? (
                <p className="text-muted-foreground text-center py-8">
                    Loading classes...
                </p>
            ) : classes.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                    No classes found for this program.
                </p>
            ) : (
                <div className="space-y-3">
                    {classes.map((cls) => (
                        <ClassCard
                            key={cls.id}
                            cls={cls}
                            onStatusChange={onStatusChange}
                            onClick={() =>
                                navigate(
                                    `/program-classes/${cls.id}/dashboard`
                                )
                            }
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

function ClassCard({
    cls,
    onStatusChange,
    onClick
}: {
    cls: Class;
    onStatusChange: (cls: Class, status: string) => void;
    onClick: () => void;
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
            className="cursor-pointer hover:shadow-md transition-shadow bg-background border-l-4 border-l-[#556830]/30"
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
                                <div
                                    onClick={(e) => e.stopPropagation()}
                                    role="presentation"
                                >
                                    <Select
                                        value={cls.status}
                                        onValueChange={(v) =>
                                            onStatusChange(cls, v)
                                        }
                                    >
                                        <SelectTrigger className="h-6 w-28 text-xs">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {Object.values(ProgClassStatus).map(
                                                (s) => (
                                                    <SelectItem
                                                        key={s}
                                                        value={s}
                                                    >
                                                        {s}
                                                    </SelectItem>
                                                )
                                            )}
                                        </SelectContent>
                                    </Select>
                                </div>
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
                <h2 className="text-lg font-semibold text-foreground">
                    Program Details
                </h2>

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
                        <div className="flex flex-wrap gap-1.5">
                            {program.credit_types?.map((ct) => (
                                <span
                                    key={ct.credit_type}
                                    className="text-xs px-2.5 py-0.5 rounded-full border bg-muted text-foreground border-border font-medium"
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
        totalClassCount > 0 ? Math.round(totalEnrolled / totalClassCount) : 0;

    return (
        <Card className="bg-background">
            <CardContent className="p-6 space-y-4">
                <h2 className="text-lg font-semibold text-foreground">
                    Performance Metrics
                </h2>
                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-muted/50 rounded-lg p-5 space-y-3">
                        <p className="text-sm text-muted-foreground">
                            Total Enrollment
                        </p>
                        <p className="text-3xl font-bold text-foreground">
                            {totalEnrolled}
                        </p>
                        <Progress
                            value={capacityPct}
                            className="h-2.5"
                            indicatorClassName="bg-[#556830]"
                        />
                        <p className="text-xs text-muted-foreground">
                            {capacityPct}% of capacity
                        </p>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-5 space-y-3">
                        <p className="text-sm text-muted-foreground">
                            Average Class Size
                        </p>
                        <p className="text-3xl font-bold text-foreground">
                            {avgClassSize}
                        </p>
                        <p className="text-xs text-muted-foreground">
                            residents per class
                        </p>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-5 space-y-3">
                        <p className="text-sm text-muted-foreground">
                            Active Classes
                        </p>
                        <p className="text-3xl font-bold text-foreground">
                            {activeClassCount}
                        </p>
                        <p className="text-xs text-muted-foreground">
                            out of {totalClassCount} total
                        </p>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-5 space-y-3">
                        <p className="text-sm text-muted-foreground">
                            Completion Rate
                        </p>
                        <p className="text-3xl font-bold text-foreground">
                            {Math.round(completionRate)}%
                        </p>
                        <Progress
                            value={completionRate}
                            className="h-2.5"
                            indicatorClassName="bg-[#556830]"
                        />
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

function AuditHistoryTab({ entries }: { entries: ChangeLogEntry[] }) {
    function formatLogEntry(entry: ChangeLogEntry): string {
        const field = formatEnum(entry.field_name);
        if (entry.old_value && entry.new_value) {
            return `${field} changed from ${entry.old_value} to ${entry.new_value} by ${entry.username}`;
        }
        if (entry.new_value) {
            return `${field} set to ${entry.new_value} by ${entry.username}`;
        }
        return `${field} updated by ${entry.username}`;
    }

    return (
        <Card className="bg-background">
            <CardContent className="p-6 space-y-4">
                <h2 className="text-lg font-semibold text-foreground">
                    Audit History
                </h2>
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
                                    {formatLogEntry(entry)}
                                </p>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
