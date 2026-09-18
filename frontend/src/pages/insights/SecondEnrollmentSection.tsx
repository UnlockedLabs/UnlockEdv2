import useSWR from 'swr';
import { SecondProgramEnrollmentRow, ServerResponseMany } from '@/types';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@/components/ui/table';
import { AllTimeBadge } from './ProgramMatrixTable';
import { pct } from './programsUtils';

interface SecondEnrollmentSectionProps {
    selectedFacility: string;
}

export function SecondEnrollmentSection({
    selectedFacility
}: SecondEnrollmentSectionProps) {
    const { data: secondEnrollmentResp } = useSWR<
        ServerResponseMany<SecondProgramEnrollmentRow>
    >(
        `/api/department-metrics/programs/second-enrollment?facility=${selectedFacility}`
    );

    if (!secondEnrollmentResp?.data || secondEnrollmentResp.data.length === 0) {
        return null;
    }

    return (
        <div className="bg-card rounded-lg border border-border overflow-hidden">
            <div className="px-6 pt-5 pb-4">
                <div className="flex items-center justify-between gap-2">
                    <h3 className="text-brand-dark dark:text-white font-medium">
                        Second Program Enrollment After First Completion — by
                        Facility and Program Type
                    </h3>
                    <AllTimeBadge />
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                    {pct(
                        secondEnrollmentResp.data.reduce(
                            (sum, r) => sum + r.enrolled_second,
                            0
                        ),
                        secondEnrollmentResp.data.reduce(
                            (sum, r) => sum + r.completed_first,
                            0
                        )
                    )}
                    % of residents who complete a program enroll in a second — a
                    measure of sustained engagement.
                </p>
            </div>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="pl-6">Facility</TableHead>
                        <TableHead>First Program Type</TableHead>
                        <TableHead className="text-right">
                            Completed First
                        </TableHead>
                        <TableHead className="text-right">
                            Enrolled in Second
                        </TableHead>
                        <TableHead className="text-right pr-6">Rate</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {secondEnrollmentResp.data.map((row) => (
                        <TableRow
                            key={`${row.facility_name}-${row.program_type}`}
                        >
                            <TableCell className="pl-6 text-muted-foreground">
                                {row.facility_name}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                                {row.program_type}
                            </TableCell>
                            <TableCell className="text-right text-muted-foreground">
                                {row.completed_first.toLocaleString()}
                            </TableCell>
                            <TableCell className="text-right text-muted-foreground">
                                {row.enrolled_second.toLocaleString()}
                            </TableCell>
                            <TableCell className="text-right pr-6">
                                <div className="flex items-center justify-end gap-2">
                                    <div className="w-16 bg-muted rounded-full h-1.5 overflow-hidden">
                                        <div
                                            className="h-full rounded-full bg-brand"
                                            style={{
                                                width: `${row.rate}%`
                                            }}
                                        />
                                    </div>
                                    <span className="text-muted-foreground w-10 text-right">
                                        {Math.round(row.rate)}%
                                    </span>
                                </div>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}
