import { Attendance, AttendanceReason } from '@/types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';
import { TableCell, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { LocalRowData } from './types';

const ATTENDANCE_OPTIONS = [
    { label: 'Present', value: Attendance.Present },
    { label: 'Excused Absence', value: Attendance.Absent_Excused },
    { label: 'Unexcused Absence', value: Attendance.Absent_Unexcused }
];

function isPresentLike(status?: Attendance): boolean {
    return status === Attendance.Present || status === Attendance.Partial;
}

interface AttendanceRowProps {
    row: LocalRowData;
    blockEdits: boolean;
    onStatusChange: (userId: number, status: Attendance) => void;
    onReasonChange: (userId: number, reason: string) => void;
    onNoteChange: (userId: number, note: string) => void;
    onTimeChange: (userId: number, field: 'check_in_at' | 'check_out_at', value: string) => void;
    onCheckoutFocus: (userId: number) => void;
    getAttendedMinutes: (row: LocalRowData) => number | null;
}

export function AttendanceRow({
    row,
    blockEdits,
    onStatusChange,
    onReasonChange,
    onNoteChange,
    onTimeChange,
    onCheckoutFocus,
    getAttendedMinutes
}: AttendanceRowProps) {
    const isPresent = isPresentLike(row.attendance_status);
    const noteRequired =
        !isPresent && row.reason_category === AttendanceReason.Other;
    const noteEnabled = !!row.attendance_status;
    const reasonDisabled = blockEdits || !row.attendance_status || isPresent;

    return (
        <TableRow>
            <TableCell className="truncate">
                {row.name_last}, {row.name_first}
            </TableCell>
            <TableCell className="whitespace-nowrap">
                {row.doc_id || '-'}
            </TableCell>
            <TableCell className="min-w-[200px]">
                <div className="flex gap-1">
                    {ATTENDANCE_OPTIONS.map((opt) => (
                        <Button
                            key={opt.value}
                            type="button"
                            size="sm"
                            variant={row.attendance_status === opt.value ? 'default' : 'outline'}
                            disabled={blockEdits}
                            className={cn(
                                'text-xs px-2 py-1 h-7',
                                row.attendance_status === opt.value &&
                                    (opt.value === Attendance.Present
                                        ? 'bg-green-600 hover:bg-green-700 text-white'
                                        : opt.value === Attendance.Absent_Excused
                                          ? 'bg-amber-500 hover:bg-amber-600 text-white'
                                          : 'bg-red-500 hover:bg-red-600 text-white')
                            )}
                            onClick={() => onStatusChange(row.user_id, opt.value)}
                        >
                            {opt.label.split(' ')[0]}
                        </Button>
                    ))}
                </div>
            </TableCell>
            <TableCell className="min-w-[130px]">
                <Select
                    value={isPresent ? '' : (row.reason_category ?? '')}
                    onValueChange={(v) => onReasonChange(row.user_id, v)}
                    disabled={reasonDisabled}
                >
                    <SelectTrigger className={cn('h-8 text-xs', reasonDisabled && 'opacity-40')}>
                        <SelectValue placeholder="Select reason" />
                    </SelectTrigger>
                    <SelectContent>
                        {Object.values(AttendanceReason).map((reason) => (
                            <SelectItem key={reason} value={reason}>
                                {reason}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </TableCell>
            <TableCell className="whitespace-nowrap">
                <Input
                    type="time"
                    className="h-8 text-xs w-28"
                    value={row.check_in_at ?? ''}
                    onChange={(e) => onTimeChange(row.user_id, 'check_in_at', e.target.value)}
                    disabled={blockEdits || !isPresent}
                />
            </TableCell>
            <TableCell className="whitespace-nowrap">
                <Input
                    type="time"
                    className="h-8 text-xs w-28"
                    value={row.check_out_at ?? ''}
                    onChange={(e) => onTimeChange(row.user_id, 'check_out_at', e.target.value)}
                    onFocus={() => onCheckoutFocus(row.user_id)}
                    disabled={blockEdits || !isPresent}
                />
            </TableCell>
            <TableCell className="text-center whitespace-nowrap">
                {getAttendedMinutes(row) ?? '\u2014'}
            </TableCell>
            <TableCell>
                <Input
                    className={cn('h-8 text-xs', (blockEdits || !noteEnabled) && 'opacity-40')}
                    value={row.note ?? ''}
                    onChange={(e) => onNoteChange(row.user_id, e.target.value)}
                    disabled={blockEdits || !noteEnabled}
                    placeholder={noteRequired ? 'Required' : ''}
                />
            </TableCell>
        </TableRow>
    );
}
