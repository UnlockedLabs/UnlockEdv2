import { useCallback, useState } from 'react';
import { Check } from 'lucide-react';
import useSWR from 'swr';
import { toast } from 'sonner';
import API from '@/api/api';
import {
    User,
    ValidResident,
    TransferResidentProgamConflicts,
    Facility,
    ServerResponseMany,
    ServerResponseOne
} from '@/types';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';

interface TransferDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    user: User;
    onSuccess: () => void;
}

export function TransferDialog({
    open,
    onOpenChange,
    user,
    onSuccess
}: TransferDialogProps) {
    const [selectedFacilityId, setSelectedFacilityId] = useState('');
    const [confirmInput, setConfirmInput] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [conflicts, setConflicts] = useState<
        TransferResidentProgamConflicts[]
    >([]);
    const [verifying, setVerifying] = useState(false);
    const [verified, setVerified] = useState(false);
    const [transferToName, setTransferToName] = useState('');

    const docId = user.doc_id ?? '';
    const currentFacilityId = user.facility?.id;

    const { data: facilitiesResp } = useSWR<ServerResponseMany<Facility>>(
        open ? '/api/facilities' : null
    );
    const facilities = facilitiesResp?.data ?? [];
    const otherFacilities = facilities.filter(
        (f) => f.id !== currentFacilityId
    );

    const handleClose = useCallback(
        (isOpen: boolean) => {
            if (!isOpen) {
                setSelectedFacilityId('');
                setConfirmInput('');
                setConflicts([]);
                setVerified(false);
                setTransferToName('');
            }
            onOpenChange(isOpen);
        },
        [onOpenChange]
    );

    const handleFacilitySelect = async (facilityId: string) => {
        setSelectedFacilityId(facilityId);
        setConfirmInput('');
        setVerified(false);
        setConflicts([]);

        const facility = facilities.find(
            (f) => String(f.id) === facilityId
        );
        setTransferToName(facility?.name ?? '');

        setVerifying(true);
        const resp = await API.get<ValidResident>(
            `users/resident-verify?user_id=${user.id}&doc_id=${docId}&facility_id=${facilityId}`
        );
        setVerifying(false);

        if (resp.success) {
            const data = (resp as ServerResponseOne<ValidResident>).data;
            setConflicts(data.program_names ?? []);
            setVerified(true);
        } else {
            toast.error(resp.message);
        }
    };

    const handleTransfer = async () => {
        setSubmitting(true);
        const resp = await API.patch('users/resident-transfer', {
            user_id: user.id,
            trans_facility_id: Number(selectedFacilityId),
            curr_facility_id: currentFacilityId
        });
        setSubmitting(false);
        if (resp.success) {
            toast.success(
                `${user.name_first} ${user.name_last} has been transferred`
            );
            onSuccess();
            handleClose(false);
        } else {
            toast.error(resp.message);
        }
    };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Transfer Resident</DialogTitle>
                    <DialogDescription>
                        Move {user.name_last}, {user.name_first} to a different
                        facility
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-6 py-4">
                    <div className="space-y-3">
                        <div className="text-sm text-gray-600">
                            Current Facility:{' '}
                            <span className="font-medium text-gray-900">
                                {user.facility?.name}
                            </span>
                        </div>
                        <div>
                            <Label className="text-xs text-gray-500">
                                New Facility
                            </Label>
                            <Select
                                value={selectedFacilityId}
                                onValueChange={(v) =>
                                    void handleFacilitySelect(v)
                                }
                            >
                                <SelectTrigger className="mt-1">
                                    <SelectValue placeholder="Select facility" />
                                </SelectTrigger>
                                <SelectContent>
                                    {otherFacilities.map((facility) => (
                                        <SelectItem
                                            key={facility.id}
                                            value={String(facility.id)}
                                        >
                                            {facility.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {verifying && (
                        <p className="text-sm text-gray-500">
                            Verifying transfer...
                        </p>
                    )}

                    {verified && selectedFacilityId && (
                        <>
                            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                                <div className="flex items-start gap-3">
                                    <div className="bg-orange-100 rounded-full p-1.5 mt-0.5">
                                        <svg
                                            className="size-4 text-orange-600"
                                            fill="none"
                                            viewBox="0 0 24 24"
                                            stroke="currentColor"
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                                            />
                                        </svg>
                                    </div>
                                    <div className="flex-1">
                                        <div className="font-medium text-orange-900 text-sm mb-1">
                                            Transfer will unenroll resident
                                            from all classes
                                        </div>
                                        <div className="text-sm text-orange-800">
                                            {user.name_first} will be removed
                                            from all active enrollments and
                                            must be re-enrolled at the new
                                            facility.
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {conflicts.length > 0 && (
                                <div className="border border-gray-200 rounded-lg p-4">
                                    <div className="font-medium text-sm text-gray-900 mb-3">
                                        Programs not available at{' '}
                                        {transferToName}
                                    </div>
                                    <div className="space-y-2">
                                        {conflicts.map((conflict, idx) => (
                                            <div
                                                key={idx}
                                                className="text-sm text-gray-600 flex items-center gap-2"
                                            >
                                                <div className="size-1.5 rounded-full bg-gray-400" />
                                                {conflict.program_name}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="space-y-2">
                                <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                                    What happens next
                                </div>
                                <div className="space-y-1.5 text-sm text-gray-700">
                                    <div className="flex items-center gap-2">
                                        <Check className="size-4 text-green-600 flex-shrink-0" />
                                        <span>
                                            Account history and favorites will
                                            be preserved
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Check className="size-4 text-green-600 flex-shrink-0" />
                                        <span>
                                            Resident can log in at{' '}
                                            {transferToName}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="border-t pt-4">
                                <Label
                                    htmlFor="transfer-confirm"
                                    className="text-sm font-medium"
                                >
                                    Type{' '}
                                    <span className="font-mono font-semibold text-[#203622]">
                                        {docId}
                                    </span>{' '}
                                    to confirm
                                </Label>
                                <Input
                                    id="transfer-confirm"
                                    value={confirmInput}
                                    onChange={(e) =>
                                        setConfirmInput(e.target.value)
                                    }
                                    placeholder="Enter Resident ID"
                                    className="mt-2"
                                />
                            </div>
                        </>
                    )}
                </div>
                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => handleClose(false)}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={() => void handleTransfer()}
                        disabled={
                            !verified ||
                            !selectedFacilityId ||
                            confirmInput !== docId ||
                            submitting
                        }
                        className="bg-[#556830] hover:bg-[#203622]"
                    >
                        Transfer Resident
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
