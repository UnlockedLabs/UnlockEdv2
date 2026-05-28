import { useState } from 'react';
import { AlertCircle, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FormModal, TonedPanel } from '@/components/shared';
import { useTypeToConfirm } from '@/components/shared/useTypeToConfirm';

interface ArchiveConfirmDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    programName: string;
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
    const confirm = useTypeToConfirm({ open, expected: programName });

    function handleConfirm() {
        onConfirm();
        onOpenChange(false);
    }

    const warningBody =
        facilityCount !== undefined
            ? `Archiving this program will prevent new enrollments across all ${facilityCount} ${facilityCount === 1 ? 'facility' : 'facilities'}. Existing classes and enrollments will remain accessible but no new classes can be created for this program.`
            : 'Archiving this program will prevent new classes from being created. Existing data will remain accessible for reporting.';

    return (
        <FormModal
            open={open}
            onOpenChange={onOpenChange}
            title="Archive Program"
            description={`Are you sure you want to archive ${programName}? This action cannot be undone.`}
        >
            <TonedPanel tone="orange" className="my-4">
                <div className="flex gap-3">
                    <AlertCircle className="size-5 text-orange-600 shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm text-orange-900 font-medium mb-1">
                            Warning
                        </p>
                        <p className="text-sm text-orange-700">{warningBody}</p>
                    </div>
                </div>
            </TonedPanel>
            <div className="space-y-4">
                <div>
                    <Label htmlFor="archiveConfirmation">
                        To confirm, type the program name:{' '}
                        <strong>{programName}</strong>
                    </Label>
                    <Input
                        id="archiveConfirmation"
                        placeholder="Type program name to confirm"
                        {...confirm.inputProps}
                        className="mt-2"
                    />
                </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
                <Button
                    variant="outline"
                    onClick={() => onOpenChange(false)}
                    className="border-gray-300 focus-visible:border-[#b3b3b3] focus-visible:ring-[3px] focus-visible:ring-[#b3b3b3]/50 focus-visible:ring-offset-0"
                >
                    Cancel
                </Button>
                <Button
                    variant="warning"
                    disabled={!confirm.matches}
                    onClick={handleConfirm}
                >
                    <AlertCircle className="size-4 mr-2" />
                    Archive Program
                </Button>
            </div>
        </FormModal>
    );
}

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
        <FormModal
            open={open}
            onOpenChange={onOpenChange}
            title={`Cannot Archive ${programName}`}
            titleClassName="text-3xl"
            closeButtonClassName="opacity-100 text-gray-500"
        >
            <div className="flex flex-col gap-4 mt-2">
                <p className="text-sm text-gray-600">
                    This program has active or scheduled classes in{' '}
                    {facilities.length} {facilityLabel}. You must complete or
                    cancel all associated classes before archiving.
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
            <div className="flex justify-end mt-4">
                <Button
                    variant="outline"
                    onClick={() => onOpenChange(false)}
                    className="border-gray-300"
                >
                    Close
                </Button>
            </div>
        </FormModal>
    );
}
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
        <FormModal
            open={open}
            onOpenChange={handleOpenChange}
            title="Reactivate Program"
            description="Reactivating this program will make it available again for use. Please choose the program's new status:"
        >
            <div className="space-y-3 my-4">
                <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-sm">Available</span>
                    <input
                        type="radio"
                        name="reactivateStatus"
                        className="accent-brand"
                        checked={asAvailable}
                        onChange={() => setAsAvailable(true)}
                    />
                </label>
                <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-sm">Inactive</span>
                    <input
                        type="radio"
                        name="reactivateStatus"
                        className="accent-brand"
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
                <Button variant="brand" onClick={handleConfirm}>
                    Confirm
                </Button>
            </div>
        </FormModal>
    );
}
interface DeleteProgramDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    programName: string;
    /** Resolve to `true` on success to dismiss the dialog; `false` keeps it open so the user can retry. */
    onConfirm: () => Promise<boolean>;
}

export function DeleteProgramDialog({
    open,
    onOpenChange,
    programName,
    onConfirm
}: DeleteProgramDialogProps) {
    const confirm = useTypeToConfirm({ open, expected: programName });

    async function handleConfirm() {
        const ok = await onConfirm();
        if (ok) onOpenChange(false);
    }

    return (
        <FormModal
            open={open}
            onOpenChange={onOpenChange}
            title="Delete Program"
            description={`Are you sure you want to delete ${programName}? This action cannot be undone.`}
        >
            <TonedPanel tone="red" className="my-4">
                <div className="flex gap-3">
                    <AlertCircle className="size-5 text-red-600 shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm text-red-900 font-medium mb-1">
                            Warning
                        </p>
                        <p className="text-sm text-red-700">
                            This will permanently delete the program and all
                            associated data from the system. This operation is
                            irreversible.
                        </p>
                    </div>
                </div>
            </TonedPanel>
            <div className="space-y-4">
                <div>
                    <Label htmlFor="deleteConfirmation">
                        To confirm, type the program name:{' '}
                        <strong>{programName}</strong>
                    </Label>
                    <Input
                        id="deleteConfirmation"
                        placeholder="Type program name to confirm"
                        {...confirm.inputProps}
                        className="mt-2"
                    />
                </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
                <Button
                    variant="outline"
                    onClick={() => onOpenChange(false)}
                    className="border-gray-300 focus-visible:border-[#b3b3b3] focus-visible:ring-[3px] focus-visible:ring-[#b3b3b3]/50 focus-visible:ring-offset-0"
                >
                    Cancel
                </Button>
                <Button
                    variant="destructive"
                    disabled={!confirm.matches}
                    onClick={() => void handleConfirm()}
                >
                    <Trash2 className="size-4 mr-2" />
                    Delete Program
                </Button>
            </div>
        </FormModal>
    );
}
