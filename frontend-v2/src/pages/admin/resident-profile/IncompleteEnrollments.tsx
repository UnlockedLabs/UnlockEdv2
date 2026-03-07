import { useState } from 'react';
import { XCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger
} from '@/components/ui/collapsible';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@/components/ui/table';
import { formatDate, getEnrollmentStatusColor } from '@/lib/formatters';
import { ResidentProgramOverview } from '@/types';

interface IncompleteEnrollmentsProps {
    enrollments: ResidentProgramOverview[];
}

function stripIncompletePrefix(status: string): string {
    return status.replace(/^Incomplete:\s*/, '');
}

export function IncompleteEnrollments({
    enrollments
}: IncompleteEnrollmentsProps) {
    const [isOpen, setIsOpen] = useState(false);

    if (enrollments.length === 0) return null;

    return (
        <Collapsible open={isOpen} onOpenChange={setIsOpen} className="mb-6">
            <div className="bg-white rounded-lg border border-gray-200">
                <CollapsibleTrigger asChild>
                    <button className="w-full p-6 flex items-center justify-between hover:bg-gray-50 transition-colors">
                        <div className="flex items-center gap-3">
                            <XCircle className="size-5 text-gray-500" />
                            <div className="text-left">
                                <h2 className="text-lg font-semibold text-[#203622]">
                                    Incomplete Enrollments
                                </h2>
                                <p className="text-sm text-gray-600 mt-1">
                                    {enrollments.length} class
                                    {enrollments.length !== 1
                                        ? 'es'
                                        : ''}{' '}
                                    not completed
                                </p>
                            </div>
                        </div>
                        {isOpen ? (
                            <ChevronUp className="size-5 text-gray-500" />
                        ) : (
                            <ChevronDown className="size-5 text-gray-500" />
                        )}
                    </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                    <div className="border-t border-gray-200">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Program & Class</TableHead>
                                    <TableHead>Enrolled</TableHead>
                                    <TableHead>Ended</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Reason</TableHead>
                                    <TableHead>Attendance</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {enrollments.map((enrollment) => {
                                    const present =
                                        enrollment.present_attendance ?? 0;
                                    const absent =
                                        enrollment.absent_attendance ?? 0;
                                    const total = present + absent;
                                    const rate =
                                        total > 0
                                            ? Math.round(
                                                  (present / total) * 100
                                              )
                                            : 0;
                                    const statusLabel =
                                        stripIncompletePrefix(
                                            enrollment.enrollment_status ?? ''
                                        );

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
                                                {formatDate(
                                                    enrollment.start_date
                                                )}
                                            </TableCell>
                                            <TableCell className="text-sm text-gray-600">
                                                {formatDate(
                                                    enrollment.end_date
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <Badge
                                                    className={getEnrollmentStatusColor(
                                                        enrollment.enrollment_status ??
                                                            ''
                                                    )}
                                                >
                                                    {statusLabel}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-sm text-gray-600">
                                                {enrollment.change_reason ??
                                                    '-'}
                                            </TableCell>
                                            <TableCell className="text-sm text-gray-600">
                                                {present}/{total} ({rate}%)
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </div>
                </CollapsibleContent>
            </div>
        </Collapsible>
    );
}
