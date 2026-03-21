import { useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// ---------------------------------------------------------------------------
// ArchiveConfirmDialog
// ---------------------------------------------------------------------------

interface ArchiveConfirmDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    programName: string;
    /** If provided, the warning message includes the facility count. */
    facilityCount?: number;
    onConfirm: () => void;
}

export function ArchiveConfirmDialog({
    open,
    onOpenChange,
    programName,
    facilityCount,
    onConfirm
}: ArchiveConfirmDialogProps) {
    const [confirmText, setConfirmText] = useState('');

    function handleOpenChange(nextOpen: boolean) {
        if (!nextOpen) setConfirmText('');
        onOpenChange(nextOpen);
    }

    function handleConfirm() {
        onConfirm();
        setConfirmText('');
        onOpenChange(false);
    }

    const warningBody =
        facilityCount !== undefined
            ? `Archiving this program will prevent new enrollments across all ${facilityCount} ${facilityCount === 1 ? 'facility' : 'facilities'}. Existing classes and enrollments will remain accessible but no new classes can be created for this program.`
            : 'Archiving this program will prevent new classes from being created. Existing data will remain accessible for reporting.';

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle className="text-[#203622]">
                        Archive Program
                    </DialogTitle>
                    <DialogDescription>
                        Are you sure you want to archive{' '}
                        <strong>{programName}</strong>? This action cannot be
                        undone.
                    </DialogDescription>
                </DialogHeader>
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 my-4">
                    <div className="flex gap-3">
                        <AlertCircle className="size-5 text-orange-600 shrink-0 mt-0.5" />
                        <div>
                            <p className="text-sm text-orange-900 font-medium mb-1">
                                Warning
                            </p>
                            <p className="text-sm text-orange-700">
                                {warningBody}
                            </p>
                        </div>
                    </div>
                </div>
                <div className="space-y-4">
                    <div>
                        <Label htmlFor="archiveConfirmation">
                            To confirm, type the program name:{' '}
                            <strong>{programName}</strong>
                        </Label>
                        <Input
                            id="archiveConfirmation"
                            placeholder="Type program name to confirm"
                            value={confirmText}
                            onChange={(e) => setConfirmText(e.target.value)}
                            className="mt-2"
                        />
                    </div>
                </div>
                <div className="flex justify-end gap-3 mt-6">
                    <Button
                        variant="outline"
                        onClick={() => handleOpenChange(false)}
                        className="border-gray-300 focus-visible:border-[#b3b3b3] focus-visible:ring-[3px] focus-visible:ring-[#b3b3b3]/50 focus-visible:ring-offset-0"
                    >
                        Cancel
                    </Button>
                    <Button
                        className="bg-orange-600 hover:bg-orange-700 text-white"
                        disabled={confirmText !== programName}
                        onClick={handleConfirm}
                    >
                        <AlertCircle className="size-4 mr-2" />
                        Archive Program
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

// ---------------------------------------------------------------------------
// CannotArchiveDialog
// ---------------------------------------------------------------------------

interface CannotArchiveDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    programName: string;
    facilities: string[];
}

export function CannotArchiveDialog({
    open,
    onOpenChange,
    programName,
    facilities
}: CannotArchiveDialogProps) {
    const facilityLabel = facilities.length === 1 ? 'facility' : 'facilities';
    const visible = facilities.slice(0, 3);
    const remaining = facilities.length - visible.length;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle className="text-[#203622]">
                        Cannot Archive {programName}
                    </DialogTitle>
                    <DialogDescription asChild>
                        <div className="flex flex-col gap-4 mt-2">
                            <p className="text-sm text-gray-600">
                                This program has active or scheduled classes in{' '}
                                {facilities.length} {facilityLabel}. You must
                                complete or cancel all associated classes before
                                archiving.
                            </p>
                            <div className="flex flex-col gap-2">
                                <span className="text-sm font-semibold text-gray-900">
                                    Currently scheduled in:
                                </span>
                                <ul className="list-disc pl-5 text-sm text-gray-600">
                                    {visible.map((facility) => (
                                        <li key={facility}>{facility}</li>
                                    ))}
                                </ul>
                                {remaining > 0 && (
                                    <span className="text-sm text-gray-500">
                                        ...and {remaining} more.
                                    </span>
                                )}
                            </div>
                        </div>
                    </DialogDescription>
                </DialogHeader>
                <div className="flex justify-end mt-4">
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        className="border-gray-300"
                    >
                        Close
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

// ---------------------------------------------------------------------------
// ReactivateDialog
// ---------------------------------------------------------------------------

interface ReactivateDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onConfirm: (isActive: boolean) => void;
}

export function ReactivateDialog({
    open,
    onOpenChange,
    onConfirm
}: ReactivateDialogProps) {
    const [asAvailable, setAsAvailable] = useState(true);

    function handleOpenChange(nextOpen: boolean) {
        if (!nextOpen) setAsAvailable(true);
        onOpenChange(nextOpen);
    }

    function handleConfirm() {
        onConfirm(asAvailable);
        setAsAvailable(true);
        onOpenChange(false);
    }

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle className="text-[#203622]">
                        Reactivate Program
                    </DialogTitle>
                    <DialogDescription>
                        Reactivating this program will make it available again
                        for use. Please choose the program's new status:
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-3 my-4">
                    <label className="flex items-center justify-between cursor-pointer">
                        <span className="text-sm">Available</span>
                        <input
                            type="radio"
                            name="reactivateStatus"
                            className="accent-[#556830]"
                            checked={asAvailable}
                            onChange={() => setAsAvailable(true)}
                        />
                    </label>
                    <label className="flex items-center justify-between cursor-pointer">
                        <span className="text-sm">Inactive</span>
                        <input
                            type="radio"
                            name="reactivateStatus"
                            className="accent-[#556830]"
                            checked={!asAvailable}
                            onChange={() => setAsAvailable(false)}
                        />
                    </label>
                </div>
                <div className="flex justify-end gap-3 mt-2">
                    <Button
                        variant="outline"
                        onClick={() => handleOpenChange(false)}
                        className="border-gray-300"
                    >
                        Cancel
                    </Button>
                    <Button
                        className="bg-[#556830] hover:bg-[#203622] text-white"
                        onClick={handleConfirm}
                    >
                        Confirm
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
