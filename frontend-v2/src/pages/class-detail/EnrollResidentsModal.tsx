import { useState, useEffect, useMemo } from 'react';
import useSWR from 'swr';
import { useDebounceValue } from 'usehooks-ts';
import { Search, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import API from '@/api/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog';
import { User, ConflictDetail, ServerResponseMany } from '@/types';

interface EnrollResidentsModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    classId: number;
    className: string;
    capacity: number;
    enrolled: number;
    onEnrolled: () => void;
}

export function EnrollResidentsModal({
    open,
    onOpenChange,
    classId,
    className,
    capacity,
    enrolled,
    onEnrolled
}: EnrollResidentsModalProps) {
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [conflictMap, setConflictMap] = useState<Map<number, ConflictDetail>>(
        new Map()
    );
    const [searchTerm, setSearchTerm] = useState('');
    const [searchQuery] = useDebounceValue(searchTerm, 300);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');

    const encodedSearch = encodeURIComponent(searchQuery);
    const { data: usersResp } = useSWR<ServerResponseMany<User>>(
        open
            ? `/api/users?search=${encodedSearch}&per_page=50&order_by=name_last asc&role=student&class_id=${classId}&include=only_unenrolled`
            : null
    );
    const users = useMemo(() => usersResp?.data ?? [], [usersResp?.data]);

    useEffect(() => {
        if (!open || users.length === 0) return;
        const userIds = users.map((u) => u.id);
        void API.post<
            { conflicts: ConflictDetail[] },
            { user_ids: number[] }
        >(`program-classes/${classId}/enrollment-conflicts`, {
            user_ids: userIds
        }).then((resp) => {
            if (resp.success) {
                const data = resp.data as unknown as {
                    conflicts: ConflictDetail[];
                };
                const map = new Map<number, ConflictDetail>();
                for (const c of data.conflicts ?? []) {
                    map.set(c.user_id, c);
                }
                setConflictMap(map);
            }
        });
    }, [open, users, classId]);

    const spotsAvailable = capacity - enrolled;
    const selectedCount = selectedIds.size;
    const remainingSpots = Math.max(0, spotsAvailable - selectedCount);
    const wouldExceedCapacity = selectedCount > spotsAvailable;

    const toggleUser = (id: number) => {
        const next = new Set(selectedIds);
        if (next.has(id)) {
            next.delete(id);
        } else {
            next.add(id);
        }
        setSelectedIds(next);
    };

    const handleClose = () => {
        setSelectedIds(new Set());
        setConflictMap(new Map());
        setSearchTerm('');
        setError('');
        setIsSubmitting(false);
        onOpenChange(false);
    };

    const handleEnroll = async () => {
        if (selectedIds.size === 0) return;
        setIsSubmitting(true);
        setError('');
        const userIds = Array.from(selectedIds);
        const resp = await API.post<
            unknown,
            { user_ids: number[]; confirm: boolean }
        >(`program-classes/${classId}/enrollments`, {
            user_ids: userIds,
            confirm: true
        });

        if (resp.success) {
            toast.success(
                `${userIds.length} ${userIds.length === 1 ? 'resident' : 'residents'} enrolled in ${className}`
            );
            onEnrolled();
            handleClose();
        } else {
            setError(resp.message || 'Failed to enroll residents');
        }
        setIsSubmitting(false);
    };

    return (
        <Dialog
            open={open}
            onOpenChange={(isOpen) => {
                if (!isOpen) handleClose();
            }}
        >
            <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col p-0">
                <DialogHeader className="px-6 pt-6 pb-4">
                    <DialogTitle className="text-xl">
                        Enroll Residents in {className}
                    </DialogTitle>
                    <DialogDescription className="text-base">
                        Select residents to enroll in this class. You can select
                        multiple residents at once.
                    </DialogDescription>
                </DialogHeader>

                <div className="px-6 pb-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
                        <Input
                            placeholder="Search by resident ID or name..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10"
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto border-t border-b border-gray-200">
                    {users.length === 0 ? (
                        <div className="text-center py-16 text-gray-500">
                            <Search className="size-12 mx-auto mb-3 text-gray-300" />
                            <p className="font-medium">No residents found</p>
                            <p className="text-sm mt-1">
                                Try adjusting your search
                            </p>
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-200">
                            {users.map((user) => {
                                const conflict = conflictMap.get(user.id);
                                const isSelected = selectedIds.has(user.id);
                                return (
                                    <label
                                        key={user.id}
                                        className={`flex items-center gap-4 px-6 py-4 cursor-pointer transition-colors ${
                                            isSelected
                                                ? 'bg-[#556830]/5'
                                                : 'hover:bg-gray-50'
                                        }`}
                                    >
                                        <Checkbox
                                            checked={isSelected}
                                            onCheckedChange={() =>
                                                toggleUser(user.id)
                                            }
                                            className="shrink-0"
                                        />
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-3 mb-1">
                                                <span className="font-medium text-[#203622]">
                                                    {user.doc_id}
                                                </span>
                                                <span className="text-gray-700">
                                                    {user.name_first}{' '}
                                                    {user.name_last}
                                                </span>
                                            </div>
                                            {conflict && (
                                                <div className="flex items-start gap-2 text-sm text-amber-700">
                                                    <AlertTriangle className="size-4 shrink-0 mt-0.5" />
                                                    <span>
                                                        Already enrolled in
                                                        &quot;
                                                        {
                                                            conflict.conflicting_class
                                                        }
                                                        &quot;
                                                        {conflict.reason &&
                                                            ` - ${conflict.reason}`}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </label>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
                    <div className="flex items-center justify-between mb-4">
                        <div className="text-sm">
                            <div className="flex items-center gap-6">
                                <div>
                                    <span className="text-gray-600">
                                        Currently Enrolled:{' '}
                                    </span>
                                    <span className="font-semibold text-[#203622]">
                                        {enrolled} / {capacity}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-gray-600">
                                        Remaining Spots:{' '}
                                    </span>
                                    <span
                                        className={`font-semibold ${remainingSpots === 0 ? 'text-red-600' : 'text-[#556830]'}`}
                                    >
                                        {remainingSpots}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-gray-600">
                                        Selected:{' '}
                                    </span>
                                    <span
                                        className={`font-semibold ${wouldExceedCapacity ? 'text-red-600' : 'text-[#203622]'}`}
                                    >
                                        {selectedCount}
                                    </span>
                                </div>
                            </div>
                            {wouldExceedCapacity && (
                                <div className="text-red-600 font-medium flex items-center gap-2 mt-1">
                                    <AlertTriangle className="size-4" />
                                    Selection exceeds available capacity by{' '}
                                    {selectedCount - spotsAvailable}
                                </div>
                            )}
                        </div>
                    </div>

                    {error && (
                        <p className="text-sm text-red-600 mb-3">{error}</p>
                    )}

                    <div className="flex gap-3 justify-end">
                        <Button
                            variant="outline"
                            onClick={handleClose}
                            disabled={isSubmitting}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={() => void handleEnroll()}
                            disabled={
                                selectedIds.size === 0 ||
                                isSubmitting ||
                                wouldExceedCapacity
                            }
                            className="bg-[#556830] hover:bg-[#203622] text-white"
                        >
                            {isSubmitting
                                ? 'Enrolling...'
                                : `Enroll Selected (${selectedIds.size})`}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
