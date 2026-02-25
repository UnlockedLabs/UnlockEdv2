import { useState, useEffect, useMemo } from 'react';
import useSWR from 'swr';
import { useDebounceValue } from 'usehooks-ts';
import { Search, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import API from '@/api/api';
import { FormModal } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
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
    const [showConfirmConflicts, setShowConfirmConflicts] = useState(false);

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

    const remaining = capacity - enrolled;

    const toggleUser = (id: number) => {
        const next = new Set(selectedIds);
        if (next.has(id)) {
            next.delete(id);
        } else {
            next.add(id);
        }
        setSelectedIds(next);
    };

    const toggleAll = () => {
        if (selectedIds.size === users.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(users.map((u) => u.id)));
        }
    };

    const handleClose = () => {
        setSelectedIds(new Set());
        setConflictMap(new Map());
        setSearchTerm('');
        setError('');
        setShowConfirmConflicts(false);
        setIsSubmitting(false);
        onOpenChange(false);
    };

    const submitEnrollment = async (confirm: boolean) => {
        setIsSubmitting(true);
        setError('');
        const userIds = Array.from(selectedIds);
        interface EnrollResp {
            conflicts?: ConflictDetail[];
        }
        const resp = await API.post<
            EnrollResp,
            { user_ids: number[]; confirm: boolean }
        >(`program-classes/${classId}/enrollments`, {
            user_ids: userIds,
            confirm
        });

        if (resp.success) {
            toast.success(
                `${userIds.length} ${userIds.length === 1 ? 'resident' : 'residents'} enrolled in ${className}`
            );
            onEnrolled();
            handleClose();
        } else if (resp.status === 409) {
            setShowConfirmConflicts(true);
        } else {
            setError(resp.message || 'Failed to enroll residents');
        }
        setIsSubmitting(false);
    };

    const handleEnroll = () => {
        if (selectedIds.size === 0) return;
        void submitEnrollment(false);
    };

    const handleEnrollAnyway = () => {
        void submitEnrollment(true);
    };

    return (
        <FormModal
            open={open}
            onOpenChange={(isOpen) => {
                if (!isOpen) handleClose();
            }}
            title="Enroll Residents"
            description={`Select residents to enroll in ${className}`}
            className="sm:max-w-[560px]"
        >
            <div className="space-y-4">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
                    <Input
                        placeholder="Search by name or ID..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                    />
                </div>

                <div className="border border-gray-200 rounded-lg">
                    <div className="px-4 py-2 border-b border-gray-200 bg-gray-50/50">
                        <div className="flex items-center gap-3">
                            <Checkbox
                                checked={
                                    selectedIds.size === users.length &&
                                    users.length > 0
                                }
                                onCheckedChange={toggleAll}
                                aria-label="Select all"
                            />
                            <span className="text-sm text-gray-600">
                                {users.length} available resident
                                {users.length !== 1 ? 's' : ''}
                            </span>
                        </div>
                    </div>

                    <div className="max-h-[400px] overflow-y-auto divide-y divide-gray-200">
                        {users.length === 0 ? (
                            <div className="text-center py-8 text-gray-500">
                                <Search className="size-8 mx-auto mb-2 text-gray-400" />
                                <p className="text-sm">
                                    No eligible residents found
                                </p>
                            </div>
                        ) : (
                            users.map((user) => {
                                const conflict = conflictMap.get(user.id);
                                return (
                                    <label
                                        key={user.id}
                                        className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors"
                                    >
                                        <Checkbox
                                            checked={selectedIds.has(user.id)}
                                            onCheckedChange={() =>
                                                toggleUser(user.id)
                                            }
                                            className="mt-0.5"
                                        />
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium text-[#203622]">
                                                    {user.doc_id}
                                                </span>
                                                <span className="text-sm text-gray-600">
                                                    {user.name_last},{' '}
                                                    {user.name_first}
                                                </span>
                                            </div>
                                            {conflict && (
                                                <div className="flex items-center gap-1.5 mt-1">
                                                    <AlertTriangle className="size-3.5 text-amber-500 shrink-0" />
                                                    <span className="text-xs text-amber-700">
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
                            })
                        )}
                    </div>
                </div>

                <div className="flex items-center justify-between text-sm text-gray-600 px-1">
                    <div className="flex gap-4">
                        <span>
                            Enrolled:{' '}
                            <strong className="text-[#203622]">
                                {enrolled} / {capacity}
                            </strong>
                        </span>
                        <span>
                            Remaining:{' '}
                            <strong className="text-[#203622]">
                                {remaining}
                            </strong>
                        </span>
                    </div>
                    <span>
                        Selected:{' '}
                        <strong className="text-[#203622]">
                            {selectedIds.size}
                        </strong>
                    </span>
                </div>

                {error && (
                    <p className="text-sm text-red-600 px-1">{error}</p>
                )}

                <div className="flex justify-end gap-3 pt-2">
                    <Button
                        variant="outline"
                        onClick={handleClose}
                        className="border-gray-300"
                        disabled={isSubmitting}
                    >
                        Cancel
                    </Button>
                    {showConfirmConflicts ? (
                        <Button
                            onClick={handleEnrollAnyway}
                            disabled={isSubmitting}
                            className="bg-amber-600 hover:bg-amber-700 text-white"
                        >
                            {isSubmitting
                                ? 'Enrolling...'
                                : `Enroll Anyway (${selectedIds.size})`}
                        </Button>
                    ) : (
                        <Button
                            onClick={handleEnroll}
                            disabled={
                                selectedIds.size === 0 || isSubmitting
                            }
                            className="bg-[#556830] hover:bg-[#203622] text-white"
                        >
                            {isSubmitting
                                ? 'Enrolling...'
                                : `Enroll Selected (${selectedIds.size})`}
                        </Button>
                    )}
                </div>
            </div>
        </FormModal>
    );
}
