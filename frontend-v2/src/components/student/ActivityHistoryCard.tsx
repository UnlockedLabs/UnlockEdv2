import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { Calendar } from 'lucide-react';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';
import { Pagination } from '@/components/Pagination';
import { ServerResponseMany, ActivityHistoryResponse } from '@/types';
import type { ChangeLogEntry } from '@/types';
import { formatHistoryEntry } from '@/components/history/formatHistoryEntry';

const ATTENDANCE_LABELS: Record<string, string> = {
    present: 'present',
    partial: 'partial',
    absent_excused: 'absent (excused)',
    absent_unexcused: 'absent (unexcused)',
    deleted: 'deleted'
};

function renderAttendanceEntry(item: ActivityHistoryResponse) {
    const status = item.attendance_status
        ? (ATTENDANCE_LABELS[item.attendance_status] ?? item.attendance_status)
        : '';
    const className = (item.class_name ?? '').trim();
    const admin = item.admin_username ?? '';
    return (
        <>
            Resident marked <span className="font-medium">{status}</span>
            {' - '}
            <span className="font-medium">{className}</span>
            {' by '}
            <span className="font-medium">{admin}</span>
        </>
    );
}

interface ActivityHistoryCardProps {
    programId?: string;
    residentId?: string;
}

const FILTER_OPTIONS = [
    { label: 'All Activity', value: '' },
    { label: 'Past 30 days', value: 'days=30' },
    { label: 'Past 90 days', value: 'days=90' }
];

export default function ActivityHistoryCard({
    programId,
    residentId
}: ActivityHistoryCardProps) {
    const [page, setPage] = useState(1);
    const [perPage, setPerPage] = useState(20);
    const [filterQuery, setFilterQuery] = useState('');

    const endpoint = residentId
        ? `/api/users/${residentId}/account-history?page=${page}&per_page=${perPage}${filterQuery ? `&${filterQuery}` : ''}`
        : programId
          ? `/api/programs/${programId}/history?page=${page}&per_page=${perPage}${filterQuery ? `&${filterQuery}` : ''}`
          : null;

    const { data, error, isLoading } = useSWR<
        ServerResponseMany<ActivityHistoryResponse>
    >(endpoint);

    useEffect(() => {
        setPage(1);
    }, [filterQuery]);

    const heading = programId ? 'Program History' : 'Account Overview';
    const entries = data?.data ?? [];
    const total = data?.meta?.total ?? entries.length;

    return (
        <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6">
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-[#203622]">{heading}</h3>
                <Select value={filterQuery} onValueChange={setFilterQuery}>
                    <SelectTrigger className="w-[160px]">
                        <SelectValue placeholder="Filter" />
                    </SelectTrigger>
                    <SelectContent>
                        {FILTER_OPTIONS.map((opt) => (
                            <SelectItem
                                key={opt.value}
                                value={opt.value || 'all'}
                            >
                                {opt.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {isLoading && (
                <p className="text-sm text-gray-500 py-4 text-center">
                    Loading...
                </p>
            )}
            {error && (
                <p className="text-sm text-red-600 py-4 text-center">
                    Unable to retrieve history
                </p>
            )}
            {!isLoading && !error && entries.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                    <Calendar className="size-12 mx-auto mb-3 text-gray-500" />
                    <p>No activity history available</p>
                    <p className="text-sm mt-1">
                        Account changes will be logged here
                    </p>
                </div>
            )}
            {!isLoading && !error && entries.length > 0 && (
                <div className="space-y-3">
                    {entries.map((item, idx) => {
                        const prose =
                            item.action === 'attendance_recorded'
                                ? renderAttendanceEntry(item)
                                : (formatHistoryEntry(
                                      item as unknown as ChangeLogEntry
                                  ) ?? item.action);
                        return (
                            <div
                                key={`${String(item.created_at)}-${idx}`}
                                className="flex gap-3 text-sm"
                            >
                                <div className="text-gray-500 min-w-[100px] shrink-0">
                                    {new Date(
                                        item.created_at
                                    ).toLocaleDateString('en-US', {
                                        month: 'numeric',
                                        day: 'numeric',
                                        year: 'numeric'
                                    })}
                                </div>
                                <div className="flex-1 text-gray-700">
                                    {prose}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
            {total >= perPage && (
                <Pagination
                    currentPage={page}
                    totalItems={total}
                    itemsPerPage={perPage}
                    onPageChange={setPage}
                    onItemsPerPageChange={(val) => {
                        setPerPage(val);
                        setPage(1);
                    }}
                    itemLabel="entries"
                />
            )}
        </div>
    );
}
