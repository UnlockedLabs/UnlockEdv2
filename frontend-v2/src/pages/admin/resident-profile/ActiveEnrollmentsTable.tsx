import { useState } from 'react';
import { ChevronDown, ChevronUp, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@/components/ui/table';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger
} from '@/components/ui/tooltip';
import { formatDate } from '@/lib/formatters';
import { ResidentProgramOverview } from '@/types';
import { getEngagementIndicator } from './engagement-utils';

interface ActiveEnrollmentsTableProps {
    enrollments: ResidentProgramOverview[];
    onViewDetails: (enrollment: ResidentProgramOverview) => void;
}

const DEFAULT_VISIBLE = 3;

export function ActiveEnrollmentsTable({
    enrollments,
    onViewDetails
}: ActiveEnrollmentsTableProps) {
    const [showAll, setShowAll] = useState(false);

    const displayed = showAll
        ? enrollments
        : enrollments.slice(0, DEFAULT_VISIBLE);
    const hiddenCount = enrollments.length - DEFAULT_VISIBLE;

    if (enrollments.length === 0) {
        return (
            <div className="bg-white rounded-lg border border-gray-200 mb-6 p-6">
                <h2 className="text-lg font-semibold text-[#203622] mb-1">
                    Active Enrollments
                </h2>
                <p className="text-sm text-gray-500">No active enrollments</p>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-lg border border-gray-200 mb-6">
            <div className="p-6 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-[#203622]">
                    Active Enrollments
                </h2>
                <p className="text-sm text-gray-600 mt-1">{enrollments.length} active class{enrollments.length !== 1 ? 'es' : ''} • All time</p>
            </div>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Program & Class</TableHead>
                        <TableHead>Schedule</TableHead>
                        <TableHead>Enrolled</TableHead>
                        <TableHead>Attendance</TableHead>
                        <TableHead>
                            <div className="flex items-center gap-1">
                                <span>Engagement</span>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <HelpCircle className="size-3 text-gray-400 cursor-help" />
                                    </TooltipTrigger>
                                    <TooltipContent className="max-w-xs">
                                        <p className="text-sm font-semibold mb-1">
                                            Engagement Levels:
                                        </p>
                                        <p className="text-sm mb-1">
                                            <span className="font-medium">
                                                Strong Engagement:
                                            </span>{' '}
                                            80%+ attendance
                                        </p>
                                        <p className="text-sm mb-1">
                                            <span className="font-medium">
                                                Check-in Opportunity:
                                            </span>{' '}
                                            60-79% attendance
                                        </p>
                                        <p className="text-sm">
                                            <span className="font-medium">
                                                Support Recommended:
                                            </span>{' '}
                                            Below 60% attendance
                                        </p>
                                    </TooltipContent>
                                </Tooltip>
                            </div>
                        </TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {displayed.map((enrollment) => {
                        const present = enrollment.present_attendance ?? 0;
                        const absent = enrollment.absent_attendance ?? 0;
                        const total = present + absent;
                        const rate =
                            total > 0 ? Math.round((present / total) * 100) : 0;
                        const indicator = getEngagementIndicator(present, total);

                        return (
                            <TableRow
                                key={`${enrollment.program_id}-${enrollment.class_id}`}
                            >
                                <TableCell>
                                    <div className="font-medium text-[#203622]">
                                        {enrollment.program_name}
                                    </div>
                                    <div className="text-sm text-gray-600">
                                        {enrollment.class_name}
                                    </div>
                                </TableCell>
                                <TableCell className="text-sm text-gray-600">
                                    {enrollment.schedule ?? '-'}
                                </TableCell>
                                <TableCell className="text-sm text-gray-600">
                                    {formatDate(enrollment.start_date)}
                                </TableCell>
                                <TableCell>
                                    <div className="font-medium text-[#203622]">
                                        {present} of {total} sessions
                                    </div>
                                    <div className="text-sm text-gray-600">
                                        {rate}% attendance
                                    </div>
                                </TableCell>
                                <TableCell>
                                    {indicator.level !== 'none' && (
                                        <Badge className={indicator.className}>
                                            {indicator.label}
                                        </Badge>
                                    )}
                                </TableCell>
                                <TableCell className="text-right">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() =>
                                            onViewDetails(enrollment)
                                        }
                                    >
                                        View Details
                                    </Button>
                                </TableCell>
                            </TableRow>
                        );
                    })}
                </TableBody>
            </Table>
            {!showAll && hiddenCount > 0 && (
                <div className="p-4 border-t border-gray-200">
                    <Button
                        variant="ghost"
                        onClick={() => setShowAll(true)}
                        className="w-full text-[#556830] hover:text-[#203622] hover:bg-gray-50"
                    >
                        <ChevronDown className="size-4 mr-2" />
                        See {hiddenCount} other{hiddenCount !== 1 ? 's' : ''}
                    </Button>
                </div>
            )}
            {showAll && enrollments.length > DEFAULT_VISIBLE && (
                <div className="p-4 border-t border-gray-200">
                    <Button
                        variant="ghost"
                        onClick={() => setShowAll(false)}
                        className="w-full text-[#556830] hover:text-[#203622] hover:bg-gray-50"
                    >
                        <ChevronUp className="size-4 mr-2" />
                        Show less
                    </Button>
                </div>
            )}
        </div>
    );
}
