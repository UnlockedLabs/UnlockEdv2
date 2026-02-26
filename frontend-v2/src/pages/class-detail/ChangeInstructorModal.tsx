import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';
import { AlertCircle } from 'lucide-react';
import { useAuth } from '@/auth/useAuth';
import API from '@/api/api';
import { toast } from 'sonner';
import { User, ServerResponseMany } from '@/types';

export interface ChangeInstructorSession {
    date: string;
    dateLabel: string;
    eventId: number;
    classTime: string;
}

interface ChangeInstructorModalProps {
    open: boolean;
    onClose: () => void;
    classId: number;
    sessions: ChangeInstructorSession[];
    onChanged: () => void;
}

export function ChangeInstructorModal({
    open,
    onClose,
    classId,
    sessions,
    onChanged
}: ChangeInstructorModalProps) {
    const { user } = useAuth();
    const [selectedInstructorId, setSelectedInstructorId] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const { data: instructorsResp } = useSWR<ServerResponseMany<User>>(
        open && user ? `/api/users?role=${user.role}&per_page=100` : null
    );
    const instructors = instructorsResp?.data ?? [];

    useEffect(() => {
        if (open) {
            setSelectedInstructorId('');
        }
    }, [open]);

    const handleApply = async () => {
        if (!selectedInstructorId) return;
        setIsSubmitting(true);
        let ok = 0;
        let fail = 0;

        for (const s of sessions) {
            const resp = await API.patch(
                `program-classes/${classId}/events/${s.eventId}`,
                {
                    date: s.date,
                    is_cancelled: false,
                    instructor_id: Number(selectedInstructorId)
                }
            );
            if (resp.success) ok++;
            else fail++;
        }

        if (ok)
            toast.success(
                `Instructor updated for ${ok} session${ok === 1 ? '' : 's'}`
            );
        if (fail)
            toast.error(
                `Failed to update ${fail} session${fail === 1 ? '' : 's'}`
            );
        onClose();
        onChanged();
        setIsSubmitting(false);
    };

    const selectedInstructor = instructors.find(
        (i) => String(i.id) === selectedInstructorId
    );
    const isSingle = sessions.length === 1;

    return (
        <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle className="text-[#203622]">
                        Change Instructor
                    </DialogTitle>
                    <DialogDescription>
                        {isSingle
                            ? `Assign a substitute instructor for ${sessions[0]?.dateLabel}`
                            : `Assign a substitute instructor for ${sessions.length} sessions`}
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div>
                        <Label>Substitute Instructor</Label>
                        <Select
                            value={selectedInstructorId}
                            onValueChange={setSelectedInstructorId}
                        >
                            <SelectTrigger className="mt-1">
                                <SelectValue placeholder="Select an instructor" />
                            </SelectTrigger>
                            <SelectContent>
                                {instructors.map((inst) => (
                                    <SelectItem
                                        key={inst.id}
                                        value={String(inst.id)}
                                    >
                                        {inst.name_first} {inst.name_last}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {sessions.length > 0 && (
                        <div>
                            <Label className="text-sm text-gray-600 mb-2 block">
                                Affected Sessions
                            </Label>
                            <div className="border border-gray-200 rounded-lg divide-y divide-gray-200 max-h-48 overflow-y-auto">
                                {sessions.map((s) => (
                                    <div
                                        key={s.date}
                                        className="flex items-center gap-2 px-3 py-2 text-sm"
                                    >
                                        <Clock className="size-3 text-gray-400" />
                                        <span className="text-[#203622]">
                                            {s.dateLabel}
                                        </span>
                                        <span className="text-gray-500">
                                            {s.classTime}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {selectedInstructor && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-2">
                            <AlertCircle className="size-4 text-blue-700 mt-0.5 shrink-0" />
                            <p className="text-sm text-blue-900">
                                This will assign{' '}
                                <strong>
                                    {selectedInstructor.name_first}{' '}
                                    {selectedInstructor.name_last}
                                </strong>{' '}
                                as substitute for {sessions.length}{' '}
                                {sessions.length === 1 ? 'session' : 'sessions'}.
                            </p>
                        </div>
                    )}
                </div>
                <div className="flex gap-2 justify-end">
                    <Button
                        variant="outline"
                        onClick={onClose}
                        disabled={isSubmitting}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={() => {
                            void handleApply();
                        }}
                        disabled={!selectedInstructorId || isSubmitting}
                        className="bg-[#556830] hover:bg-[#203622] text-white"
                    >
                        {isSubmitting ? 'Updating...' : 'Change Instructor'}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
