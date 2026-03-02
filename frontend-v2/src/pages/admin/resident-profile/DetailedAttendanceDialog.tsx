import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog';
import { useToast } from '@/contexts/ToastContext';
import { ToastState } from '@/types';
import API from '@/api/api';
import { ResidentProgramOverview } from '@/types';
import { getEngagementIndicator } from './engagement-utils';

interface DetailedAttendanceDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    enrollment: ResidentProgramOverview | null;
    residentId: string;
}

export function DetailedAttendanceDialog({
    open,
    onOpenChange,
    enrollment,
    residentId
}: DetailedAttendanceDialogProps) {
    const { toaster } = useToast();

    if (!enrollment) return null;

    const present = enrollment.present_attendance ?? 0;
    const absent = enrollment.absent_attendance ?? 0;
    const total = present + absent;
    const rate = total > 0 ? Math.round((present / total) * 100) : 0;
    const indicator = getEngagementIndicator(present, total);

    const handleExport = async () => {
        try {
            const { blob, headers } = await API.downloadFile(
                `users/${residentId}/attendance-export`
            );
            const disposition = headers.get('Content-Disposition');
            const filename =
                disposition?.match(/filename="?(.+)"?/)?.[1] ??
                'attendance-export.csv';
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            a.remove();
            toaster('Attendance data exported to CSV', ToastState.success);
        } catch {
            toaster('Failed to export attendance data', ToastState.error);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl">
                <DialogHeader>
                    <DialogTitle>
                        Detailed Attendance - {enrollment.class_name}
                    </DialogTitle>
                    <DialogDescription>
                        Complete attendance record for this class
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                    <div className="flex items-center justify-between mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <div>
                            <div className="font-medium text-[#203622]">
                                {present} of {total} sessions attended
                            </div>
                            <div className="text-sm text-gray-600">
                                {rate}% overall attendance
                            </div>
                        </div>
                        <Badge className={indicator.className}>
                            {indicator.label}
                        </Badge>
                    </div>
                    <div className="flex justify-end">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => void handleExport()}
                        >
                            <Download className="size-4 mr-2" />
                            Export to CSV
                        </Button>
                    </div>
                </div>
                <DialogFooter>
                    <Button onClick={() => onOpenChange(false)}>Close</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
