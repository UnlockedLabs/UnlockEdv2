import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { CheckCircle, Users } from 'lucide-react';
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

const CHANGE_REASONS = [
    'Instructor Unavailable',
    'Illness',
    'Scheduling Conflict',
    'Personal Emergency',
    'Other'
];

export function ChangeInstructorModal({
    open,
    onClose,
    classId,
    sessions,
    onChanged
}: ChangeInstructorModalProps) {
    const { user } = useAuth();
    const [selectedInstructorId, setSelectedInstructorId] = useState('');
    const [reason, setReason] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const { data: instructorsResp } = useSWR<ServerResponseMany<User>>(
        open && user ? `/api/users?role=${user.role}&per_page=100` : null
    );
    const instructors = instructorsResp?.data ?? [];

    useEffect(() => {
        if (open) {
            setSelectedInstructorId('');
            setReason('');
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

    return (
        <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle className="text-[#203622]">
                        Change Instructor
                    </DialogTitle>
                    <DialogDescription>
                        Select a new instructor for {sessions.length}{' '}
                        {sessions.length === 1 ? 'session' : 'sessions'}
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div>
                        <Label htmlFor="newInstructor">New Instructor</Label>
                        <Select
                            value={selectedInstructorId}
                            onValueChange={setSelectedInstructorId}
                        >
                            <SelectTrigger
                                id="newInstructor"
                                className="mt-2"
                            >
                                <SelectValue placeholder="Select instructor" />
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

                    <div className="space-y-2">
                        <Label>Reason for Change</Label>
                        <Select value={reason} onValueChange={setReason}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select a reason" />
                            </SelectTrigger>
                            <SelectContent>
                                {CHANGE_REASONS.map((r) => (
                                    <SelectItem key={r} value={r}>
                                        {r}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div>
                        <Label className="text-sm font-medium text-[#203622] mb-2 block">
                            Sessions to Update
                        </Label>
                        <div className="max-h-48 overflow-y-auto bg-gray-50 rounded-lg p-4 space-y-1">
                            {sessions.map((s) => (
                                <div
                                    key={s.date}
                                    className="text-sm text-gray-700"
                                >
                                    {s.dateLabel}
                                </div>
                            ))}
                        </div>
                    </div>

                    {selectedInstructor && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <div className="flex gap-3">
                                <CheckCircle className="size-5 text-blue-600 shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-sm text-blue-900 font-medium mb-1">
                                        Preview
                                    </p>
                                    <p className="text-sm text-blue-700">
                                        <strong>
                                            {selectedInstructor.name_first}{' '}
                                            {selectedInstructor.name_last}
                                        </strong>{' '}
                                        will be assigned as the instructor for{' '}
                                        {sessions.length}{' '}
                                        {sessions.length === 1
                                            ? 'session'
                                            : 'sessions'}
                                        .
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
                <div className="flex justify-end gap-3">
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
                        <Users className="size-4 mr-2" />
                        Change Instructor
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
