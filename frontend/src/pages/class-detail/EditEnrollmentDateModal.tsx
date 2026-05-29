import { useState, useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FormModal } from '@/components/shared';

interface EditEnrollmentDateModalProps {
    open: boolean;
    onClose: () => void;
    residentDisplayId: string;
    residentName: string;
    currentEnrolledAt: string;
    classStartDt: string;
    onSubmit: (newDateIso: string) => void;
}

const ISO = 'yyyy-MM-dd';

function toIsoDate(value: string): string {
    if (!value) return '';
    if (value.includes('T')) return value.split('T')[0];
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '';
    return format(parsed, ISO);
}

function validate(
    newDate: string,
    classStartIso: string,
    today: string
): string | null {
    if (!newDate) return 'Please select an enrollment date';
    if (newDate > today) return 'Enrollment date cannot be in the future';
    if (classStartIso && newDate < classStartIso) {
        return `Enrollment date cannot be before the class start date (${classStartIso})`;
    }
    return null;
}

export function EditEnrollmentDateModal({
    open,
    onClose,
    residentDisplayId,
    residentName,
    currentEnrolledAt,
    classStartDt,
    onSubmit
}: EditEnrollmentDateModalProps) {
    const currentIso = useMemo(
        () => toIsoDate(currentEnrolledAt),
        [currentEnrolledAt]
    );
    const classStartIso = useMemo(
        () => toIsoDate(classStartDt),
        [classStartDt]
    );
    const today = useMemo(() => format(new Date(), ISO), []);

    const [newDate, setNewDate] = useState(currentIso);

    useEffect(() => {
        if (open) setNewDate(currentIso);
    }, [open, currentIso]);

    const validationError = validate(newDate, classStartIso, today);
    const canSubmit = !validationError && newDate !== currentIso;

    const handleSubmit = () => {
        if (!canSubmit) return;
        onSubmit(`${newDate}T00:00:00Z`);
        onClose();
    };

    return (
        <FormModal
            open={open}
            onOpenChange={(isOpen) => !isOpen && onClose()}
            title="Update Enrollment Date"
            description="Change the date this resident was enrolled in the class."
            className="max-w-md"
            titleClassName="text-foreground"
        >
            <div className="space-y-4">
                <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                    <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Resident ID:</span>
                        <span className="font-medium text-brand-dark">
                            {residentDisplayId}
                        </span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Name:</span>
                        <span className="font-medium text-brand-dark">
                            {residentName}
                        </span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-gray-600">
                            Current Enrollment Date:
                        </span>
                        <span className="font-medium text-brand-dark">
                            {currentIso || 'Not set'}
                        </span>
                    </div>
                </div>
                <div>
                    <Label htmlFor="new-enrolled-date">
                        New Enrollment Date *
                    </Label>
                    <Input
                        id="new-enrolled-date"
                        type="date"
                        value={newDate}
                        min={classStartIso || undefined}
                        max={today}
                        onChange={(e) => setNewDate(e.target.value)}
                    />
                    {validationError && (
                        <p className="text-sm text-red-600">
                            {validationError}
                        </p>
                    )}
                </div>
                <div className="flex gap-2 justify-end pt-4">
                    <Button variant="outline" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={!canSubmit}
                        variant="brand"
                    >
                        Save
                    </Button>
                </div>
            </div>
        </FormModal>
    );
}
