import { ProgramCompletionMatrixCell } from '@/types';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@/components/ui/table';

export function LegendSwatch({
    className,
    label
}: {
    className: string;
    label: string;
}) {
    return (
        <div className="flex items-center gap-1.5">
            <span className={`w-3 h-3 rounded-sm shrink-0 ${className}`} />
            {label}
        </div>
    );
}

function matrixCellClass(cell: ProgramCompletionMatrixCell): string {
    if (cell.insufficient) return 'bg-muted text-muted-foreground';
    if (cell.delta_from_facility_average > 15)
        return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300';
    if (cell.delta_from_facility_average > 5)
        return 'bg-green-50 dark:bg-green-900/15 text-green-700 dark:text-green-400';
    if (cell.delta_from_facility_average < -15)
        return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300';
    if (cell.delta_from_facility_average < -5)
        return 'bg-red-50 dark:bg-red-900/15 text-red-700 dark:text-red-400';
    return 'bg-transparent text-foreground';
}

export function ProgramMatrixTable({
    cells
}: {
    cells: ProgramCompletionMatrixCell[];
}) {
    const programs = Array.from(new Set(cells.map((c) => c.program_name))).sort(
        (a, b) => a.localeCompare(b)
    );
    const facilities = Array.from(
        new Map(cells.map((c) => [c.facility_id, c.facility_name])).entries()
    ).sort((a, b) => a[1].localeCompare(b[1]));
    const cellByKey = new Map(
        cells.map((c) => [`${c.program_name}::${c.facility_id}`, c])
    );

    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Program</TableHead>
                    {facilities.map(([id, name]) => (
                        <TableHead key={id} className="text-center">
                            {name}
                        </TableHead>
                    ))}
                </TableRow>
            </TableHeader>
            <TableBody>
                {programs.map((program) => (
                    <TableRow key={program}>
                        <TableCell className="font-medium text-brand-dark dark:text-white">
                            {program}
                        </TableCell>
                        {facilities.map(([id]) => {
                            const cell = cellByKey.get(`${program}::${id}`);
                            if (!cell) {
                                return (
                                    <TableCell
                                        key={id}
                                        className="text-center text-muted-foreground"
                                    >
                                        —
                                    </TableCell>
                                );
                            }
                            return (
                                <TableCell
                                    key={id}
                                    className={`text-center ${matrixCellClass(cell)}`}
                                    title={
                                        cell.insufficient
                                            ? `n=${cell.enrolled} (insufficient data, need 3+)`
                                            : `n=${cell.enrolled}, rate=${Math.round(cell.completion_rate)}%, delta=${cell.delta_from_facility_average >= 0 ? '+' : ''}${Math.round(cell.delta_from_facility_average)}pp`
                                    }
                                >
                                    {cell.insufficient
                                        ? '—'
                                        : `${Math.round(cell.completion_rate)}%`}
                                </TableCell>
                            );
                        })}
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    );
}
