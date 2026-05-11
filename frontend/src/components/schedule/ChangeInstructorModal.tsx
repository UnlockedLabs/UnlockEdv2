import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import API from '@/api/api';
import { FacilityProgramClassEvent, Instructor, ChangeReason } from '@/types';
import { FormModal } from '@/components/shared/FormModal';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';
import { useChangeEventField } from './useChangeEventField';

interface ChangeInstructorModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    event: FacilityProgramClassEvent;
    facilityId: string;
    onSuccess: () => void;
}

export function ChangeInstructorModal({
    open,
    onOpenChange,
    event,
    facilityId,
    onSuccess
}: ChangeInstructorModalProps) {
    const [instructorId, setInstructorId] = useState('');
    const [reason, setReason] = useState('');
    const [applyToFuture, setApplyToFuture] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [instructors, setInstructors] = useState<Instructor[]>([]);

    const { submitSingleSessionChange, submitSeriesChange } = useChangeEventField(
        event,
        { instructor_id: instructorId ? Number(instructorId) : null },
        reason
    );

    useEffect(() => {
        async function fetchInstructors() {
            const resp = await API.get<Instructor>(
                `facilities/${facilityId}/instructors`
            );
            if (resp.success && resp.type === 'many') {
                setInstructors(
                    resp.data.filter((i) => i.id !== 0)
                );
            }
        }
        void fetchInstructors();
    }, [facilityId]);

    useEffect(() => {
        if (open) {
            setInstructorId('');
            setReason('');
            setApplyToFuture(false);
        }
    }, [open]);

    const selectedInstructor = instructors.find((i) => String(i.id) === instructorId);
    const selectedInstructorName = selectedInstructor
        ? `${selectedInstructor.name_first} ${selectedInstructor.name_last}`
        : instructorId;

    async function handleSubmit() {
        if (!instructorId) {
            toast.error('Please select an instructor');
            return;
        }
        setSubmitting(true);

        const result = applyToFuture
            ? await submitSeriesChange()
            : await submitSingleSessionChange();

        setSubmitting(false);

        if (result.success) {
            toast.success(
                applyToFuture
                    ? `Instructor changed to ${selectedInstructorName} for all future sessions`
                    : `Instructor changed to ${selectedInstructorName}`
            );
            onOpenChange(false);
            onSuccess();
        } else {
            toast.error(result.message ?? 'Failed to update instructor');
        }
    }

    return (
        <FormModal open={open} onOpenChange={onOpenChange} title="Change Instructor">
            <div className="space-y-4 pt-6">
                <div className="space-y-2">
                    <Label>New Instructor</Label>
                    <Select value={instructorId} onValueChange={setInstructorId}>
                        <SelectTrigger>
                            <SelectValue placeholder="Select instructor" />
                        </SelectTrigger>
                        <SelectContent>
                            {instructors.map((inst) => (
                                <SelectItem key={inst.id} value={String(inst.id)}>
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
                            {Object.values(ChangeReason).map((r) => (
                                <SelectItem key={r} value={r}>
                                    {r}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="flex items-center gap-2">
                    <input
                        type="checkbox"
                        id="instructor-apply-to-future"
                        checked={applyToFuture}
                        onChange={(e) => setApplyToFuture(e.target.checked)}
                        className="size-4 rounded border-gray-300"
                    />
                    <label
                        htmlFor="instructor-apply-to-future"
                        className="text-sm font-normal cursor-pointer"
                    >
                        Apply this change to all future sessions
                    </label>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button
                        onClick={() => void handleSubmit()}
                        disabled={submitting || !instructorId}
                        className="bg-[#556830] text-white hover:bg-[#203622]"
                    >
                        {submitting ? 'Saving...' : 'Change Instructor'}
                    </Button>
                </div>
            </div>
        </FormModal>
    );
}
