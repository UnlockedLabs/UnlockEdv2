import { KCContentRow } from '@/types';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@/components/ui/table';

interface KCContentTableProps {
    title: string;
    nameLabel: string;
    valueLabel: string;
    rows: KCContentRow[];
}

export function KCContentTable({
    title,
    nameLabel,
    valueLabel,
    rows
}: KCContentTableProps) {
    return (
        <div className="bg-card rounded-lg border border-border overflow-hidden">
            <div className="flex items-center justify-between px-6 pt-5 pb-4">
                <h3 className="text-brand-dark dark:text-white font-medium">
                    {title}
                </h3>
                <span className="text-sm text-muted-foreground">
                    {valueLabel}
                </span>
            </div>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>{nameLabel}</TableHead>
                        <TableHead className="text-right">
                            {valueLabel}
                        </TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {rows.length === 0 ? (
                        <TableRow>
                            <TableCell
                                colSpan={2}
                                className="h-20 text-center text-muted-foreground"
                            >
                                No activity in this range
                            </TableCell>
                        </TableRow>
                    ) : (
                        rows.map((row) => (
                            <TableRow key={row.title}>
                                <TableCell className="text-muted-foreground">
                                    {row.title}
                                </TableCell>
                                <TableCell className="text-right text-muted-foreground">
                                    {row.visits.toLocaleString()}
                                </TableCell>
                            </TableRow>
                        ))
                    )}
                </TableBody>
            </Table>
        </div>
    );
}
