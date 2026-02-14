import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import useSWR from 'swr';
import { ArrowLeft, Edit } from 'lucide-react';
import {
    AcademicCapIcon,
    WrenchScrewdriverIcon,
    HeartIcon,
    SparklesIcon,
    LightBulbIcon,
    HomeModernIcon,
    HandRaisedIcon
} from '@heroicons/react/24/outline';
import {
    ServerResponseOne,
    ServerResponseMany,
    ProgramOverview,
    Class
} from '@/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger
} from '@/components/ui/tabs';
import EditProgramDialog from './EditProgramDialog';
import ClassesTab from './ClassesTab';
import { programTypeColors, TAB_TRIGGER_CLASSES } from './constants';

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

function StatCard({
    label,
    value,
    subtitle
}: {
    label: string;
    value: string | number;
    subtitle?: string;
}) {
    return (
        <div className="bg-[#E2E7EA] rounded-lg p-3">
            <div className="text-sm text-gray-600 mb-1">{label}</div>
            <div className="text-2xl text-[#203622]">{value}</div>
            {subtitle && (
                <div className="text-xs text-gray-500 mt-0.5">{subtitle}</div>
            )}
        </div>
    );
}

function MetricCard({
    label,
    value,
    subtitle,
    progress
}: {
    label: string;
    value: string | number;
    subtitle: string;
    progress?: number;
}) {
    return (
        <div className="p-4 bg-[#E2E7EA] rounded-lg">
            <div className="text-sm text-gray-600 mb-2">{label}</div>
            <div className="text-3xl text-[#203622] mb-2">{value}</div>
            {progress !== undefined && (
                <Progress
                    value={progress}
                    className="h-2"
                    indicatorClassName="bg-[#556830]"
                />
            )}
            <div className="text-xs text-gray-500 mt-2">{subtitle}</div>
        </div>
    );
}

export default function ProgramDetail() {
    const { program_id: programId } = useParams();
    const navigate = useNavigate();
    const [showEditDialog, setShowEditDialog] = useState(false);

    const { data: programResp } = useSWR<ServerResponseOne<ProgramOverview>>(
        '/api/programs/' + programId
    );
    const program = programResp?.data;

    const { data: classesResp } = useSWR<ServerResponseMany<Class>>(
        '/api/programs/' + programId + '/classes'
    );
    const programClasses = classesResp?.data ?? [];

    if (!program) {
        return (
            <div className="flex items-center justify-center h-64">
                <p className="text-muted-foreground">Loading program...</p>
            </div>
        );
    }

    const primaryType = program.program_types[0]?.program_type;
    const Icon = primaryType
        ? programTypeIcons[primaryType] || AcademicCapIcon
        : AcademicCapIcon;

    const totalEnrolled = programClasses.reduce(
        (sum, c) => sum + c.enrolled,
        0
    );
    const totalCapacity = programClasses.reduce(
        (sum, c) => sum + c.capacity,
        0
    );
    const capacityPercentage =
        totalCapacity > 0 ? (totalEnrolled / totalCapacity) * 100 : 0;
    const activeClasses = programClasses.filter(
        (c) => c.status === 'Active'
    ).length;
    const avgClassSize =
        programClasses.length > 0
            ? Math.round(totalEnrolled / programClasses.length)
            : 0;

    return (
        <div className="min-h-screen bg-[#E2E7EA]">
            <div className="bg-white border-b border-gray-200">
                <div className="max-w-7xl mx-auto px-6 py-6">
                    <Button
                        variant="ghost"
                        onClick={() => navigate('/programs')}
                        className="mb-4 -ml-2 text-gray-600 hover:text-[#203622]"
                    >
                        <ArrowLeft className="size-4 mr-2" />
                        Back to Programs
                    </Button>

                    <div className="flex items-start gap-6">
                        <div className="bg-[#556830] p-4 rounded-lg">
                            <Icon className="size-10 text-white" />
                        </div>
                        <div className="flex-1">
                            <div className="flex items-start justify-between mb-2">
                                <div>
                                    <h1 className="text-[#203622] mb-2">
                                        {program.name}
                                    </h1>
                                    <div className="flex flex-wrap gap-2 mb-3">
                                        {program.program_types.map((pt) => (
                                            <Badge
                                                key={pt.program_type}
                                                variant="outline"
                                                className={
                                                    programTypeColors[
                                                        pt.program_type
                                                    ] ||
                                                    'bg-gray-100 text-gray-700 border-gray-200'
                                                }
                                            >
                                                {pt.program_type.replace(
                                                    /_/g,
                                                    ' '
                                                )}
                                            </Badge>
                                        ))}
                                        <Badge
                                            variant="outline"
                                            className={
                                                program.is_active
                                                    ? 'bg-green-50 text-[#556830] border-green-200'
                                                    : 'bg-gray-50 text-gray-700 border-gray-200'
                                            }
                                        >
                                            {program.is_active
                                                ? 'Active'
                                                : 'Inactive'}
                                        </Badge>
                                    </div>
                                </div>
                                <Button
                                    variant="outline"
                                    className="border-gray-300"
                                    onClick={() => setShowEditDialog(true)}
                                >
                                    <Edit className="size-4 mr-2" />
                                    Edit Program
                                </Button>
                            </div>
                            <p className="text-gray-600 mb-4 max-w-3xl">
                                {program.description}
                            </p>

                            <div className="grid grid-cols-4 gap-4">
                                <StatCard
                                    label="Total Classes"
                                    value={programClasses.length}
                                    subtitle={`${activeClasses} active`}
                                />
                                <StatCard
                                    label="Active Classes"
                                    value={activeClasses}
                                />
                                <StatCard
                                    label="Total Enrollment"
                                    value={
                                        program.total_enrollments ??
                                        totalEnrolled
                                    }
                                    subtitle={`${totalCapacity} capacity`}
                                />
                                <StatCard
                                    label="Active Enrollment"
                                    value={
                                        program.active_enrollments ??
                                        totalEnrolled
                                    }
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-6 py-6">
                <Tabs defaultValue="classes" className="space-y-6">
                    <TabsList className="bg-white border border-gray-200 p-1 h-auto gap-1">
                        <TabsTrigger
                            value="classes"
                            className={TAB_TRIGGER_CLASSES}
                        >
                            Classes ({programClasses.length})
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
                            value="audit"
                            className={TAB_TRIGGER_CLASSES}
                        >
                            Audit History
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="classes" className="space-y-4">
                        <ClassesTab
                            programId={programId!}
                            programClasses={programClasses}
                            navigate={navigate}
                        />
                    </TabsContent>

                    <TabsContent value="details">
                        <DetailsTab program={program} />
                    </TabsContent>

                    <TabsContent value="performance">
                        <PerformanceTab
                            totalEnrolled={totalEnrolled}
                            capacityPercentage={capacityPercentage}
                            avgClassSize={avgClassSize}
                            activeClasses={activeClasses}
                            totalClasses={programClasses.length}
                            completionRate={program.completion_rate}
                        />
                    </TabsContent>

                    <TabsContent value="audit">
                        <div className="bg-white rounded-lg border border-gray-200 p-6">
                            <h3 className="text-[#203622] mb-6">
                                Audit History
                            </h3>
                            <p className="text-gray-500 text-sm">
                                Audit history coming soon
                            </p>
                        </div>
                    </TabsContent>
                </Tabs>
            </div>

            <EditProgramDialog
                open={showEditDialog}
                onOpenChange={setShowEditDialog}
                program={program}
            />
        </div>
    );
}

function DetailsTab({ program }: { program: ProgramOverview }) {
    return (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-[#203622] mb-6">Program Details</h3>
            <div className="space-y-6">
                <div>
                    <div className="text-sm text-gray-600 mb-2">
                        Description
                    </div>
                    <p className="text-[#203622]">{program.description}</p>
                </div>
                <div className="grid grid-cols-2 gap-6">
                    <div>
                        <div className="text-sm text-gray-600 mb-2">
                            Program Types
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {program.program_types.map((pt) => (
                                <Badge
                                    key={pt.program_type}
                                    variant="outline"
                                    className={
                                        programTypeColors[pt.program_type] ||
                                        'bg-gray-100 text-gray-700 border-gray-200'
                                    }
                                >
                                    {pt.program_type.replace(/_/g, ' ')}
                                </Badge>
                            ))}
                        </div>
                    </div>
                    <div>
                        <div className="text-sm text-gray-600 mb-2">
                            Credit Types
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {program.credit_types.map((ct) => (
                                <Badge
                                    key={ct.credit_type}
                                    variant="outline"
                                    className="bg-gray-100 text-gray-700 border-gray-200"
                                >
                                    {ct.credit_type}
                                </Badge>
                            ))}
                        </div>
                    </div>
                    <div>
                        <div className="text-sm text-gray-600 mb-2">
                            Funding Type
                        </div>
                        <div className="text-[#203622]">
                            {program.funding_type.replace(/_/g, ' ')}
                        </div>
                    </div>
                    <div>
                        <div className="text-sm text-gray-600 mb-2">
                            Status
                        </div>
                        <Badge
                            variant="outline"
                            className={
                                program.is_active
                                    ? 'bg-green-50 text-[#556830] border-green-200'
                                    : 'bg-gray-50 text-gray-700 border-gray-200'
                            }
                        >
                            {program.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                    </div>
                </div>
            </div>
        </div>
    );
}

function PerformanceTab({
    totalEnrolled,
    capacityPercentage,
    avgClassSize,
    activeClasses,
    totalClasses,
    completionRate
}: {
    totalEnrolled: number;
    capacityPercentage: number;
    avgClassSize: number;
    activeClasses: number;
    totalClasses: number;
    completionRate: number;
}) {
    const rate = completionRate ?? 0;
    return (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-[#203622] mb-6">Performance Metrics</h3>
            <div className="grid grid-cols-2 gap-6">
                <MetricCard
                    label="Total Enrollment"
                    value={totalEnrolled}
                    subtitle={`${Math.round(capacityPercentage)}% of capacity`}
                    progress={capacityPercentage}
                />
                <MetricCard
                    label="Average Class Size"
                    value={avgClassSize}
                    subtitle="residents per class"
                />
                <MetricCard
                    label="Active Classes"
                    value={activeClasses}
                    subtitle={`out of ${totalClasses} total`}
                />
                <MetricCard
                    label="Completion Rate"
                    value={`${Math.round(rate)}%`}
                    subtitle="of enrolled residents"
                    progress={rate}
                />
            </div>
        </div>
    );
}
