import { useState, useEffect } from 'react';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';
import { FormModal, TonedPanel } from '@/components/shared';
import { bulkPatchEvents } from '@/api/bulkPatchEvents';
import { toast } from 'sonner';

export interface BulkCancelSession {
    date: string;
    dateObj: Date;
    dayName: string;
    eventId: number;
    classTime?: string;
}

interface BulkCancelSessionsModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    classId: number;
    sessions: BulkCancelSession[];
    onCancelled: () => void;
}

export function BulkCancelSessionsModal({
    open,
    onOpenChange,
    classId,
    sessions,
    onCancelled
}: BulkCancelSessionsModalProps) {
    const [reason, setReason] = useState('');
    const [note, setNote] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (open) {
            setReason('');
            setNote('');
        }
    }, [open]);

    const canSubmit =
        reason && (reason !== 'other' || note.trim().length > 0) && !isSubmitting;

    const handleCancel = async () => {
        setIsSubmitting(true);

        const { ok, fail } = await bulkPatchEvents(classId, sessions, (s) => ({
            date: s.date,
            start_time: s.classTime?.split('-')[0],
            is_cancelled: true,
            reason: reason === 'other' ? note.trim() : reason
        }));

        if (ok)
            toast.success(
                `${ok} session${ok === 1 ? '' : 's'} cancelled`
            );
        if (fail)
            toast.error(
                `Failed to cancel ${fail} session${fail === 1 ? '' : 's'}`
            );

        onOpenChange(false);
        onCancelled();
        setIsSubmitting(false);
    };

    const sorted = [...sessions].sort(
        (a, b) => a.dateObj.getTime() - b.dateObj.getTime()
    );

    return (
        <FormModal
            open={open}
            onOpenChange={onOpenChange}
            title="Cancel Sessions"
            description={`Review and confirm cancellation of ${sessions.length} ${sessions.length === 1 ? 'session' : 'sessions'}`}
            className="max-w-2xl"
        >
            <div className="space-y-4 py-4">
                    <div>
                        <Label className="form-label">
                            Sessions to Cancel
                        </Label>
                        <div className="scroll-panel">
                            {sorted.map((session) => (
                                <div
                                    key={session.date}
                                    className="text-sm text-gray-700"
                                >
                                    {session.dayName},{' '}
                                    {session.dateObj.toLocaleDateString(
                                        'en-US',
                                        {
                                            month: 'long',
                                            day: 'numeric',
                                            year: 'numeric'
                                        }
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    <div>
                        <Label htmlFor="bulkCancelReason">
                            Reason for Cancellation *
                        </Label>
                        <Select
                            value={reason}
                            onValueChange={(value) => {
                                setReason(value);
                                if (value !== 'other') {
                                    setNote('');
                                }
                            }}
                        >
                            <SelectTrigger className="w-full mt-2">
                                <SelectValue placeholder="Select a reason" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="instructor_unavailable">
                                    Instructor Unavailable
                                </SelectItem>
                                <SelectItem value="instructor_illness">
                                    Instructor Illness
                                </SelectItem>
                                <SelectItem value="facility_issue_or_lockdown">
                                    Facility Issue or Lockdown
                                </SelectItem>
                                <SelectItem value="holiday_or_scheduled_break">
                                    Holiday or Scheduled Break
                                </SelectItem>
                                <SelectItem value="technology_issue">
                                    Technology Issue
                                </SelectItem>
                                <SelectItem value="other">Other</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {reason === 'other' && (
                        <div className="min-w-0">
                            <Label htmlFor="cancelNote">
                                Please specify *
                            </Label>
                            <Textarea
                                id="cancelNote"
                                placeholder="Enter the specific reason for cancellation..."
                                value={note}
                                onChange={(e) => setNote(e.target.value)}
                                className="mt-2 break-all [field-sizing:fixed]"
                                rows={3}
                                maxLength={255}
                            />
                        </div>
                    )}

                    <TonedPanel tone="amber">
                        <div className="flex gap-3">
                            <AlertCircle className="size-5 text-amber-600 shrink-0 mt-0.5" />
                            <div>
                                <p className="text-sm text-amber-900 font-medium mb-1">
                                    Impact
                                </p>
                                <p className="text-sm text-amber-700">
                                    These sessions will be marked as cancelled.
                                    Residents will see these sessions as
                                    cancelled in their schedules.
                                </p>
                            </div>
                        </div>
                    </TonedPanel>
                </div>
                <div className="flex justify-end gap-3">
                    <Button
                        variant="outline"
                        onClick={() => {
                            onOpenChange(false);
                            setNote('');
                            setReason('');
                        }}
                        disabled={isSubmitting}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={() => void handleCancel()}
                        disabled={!canSubmit}
                        className="bg-red-600 hover:bg-red-700 text-white"
                    >
                        {isSubmitting
                            ? 'Cancelling...'
                            : `Cancel ${sessions.length} ${sessions.length === 1 ? 'Session' : 'Sessions'}`}
                    </Button>
                </div>
        </FormModal>
    );
}
