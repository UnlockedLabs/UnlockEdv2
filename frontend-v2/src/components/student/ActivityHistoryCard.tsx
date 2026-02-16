import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ServerResponseMany, ActivityHistoryResponse } from '@/types';

interface ActivityHistoryCardProps {
    programId?: string;
    residentId?: string;
}

const FILTER_OPTIONS = [
    { label: 'All Activity', value: '' },
    { label: 'Past 30 days', value: 'days=30' },
    { label: 'Past 90 days', value: 'days=90' }
];

function formatActivityDate(date: Date): string {
    return new Date(date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });
}

function formatAction(action: string): string {
    return action
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function ActivityHistoryCard({
    programId,
    residentId
}: ActivityHistoryCardProps) {
    const [page, setPage] = useState(1);
    const [filterQuery, setFilterQuery] = useState('');

    const endpoint = residentId
        ? `/api/users/${residentId}/account-history?page=${page}&per_page=5${filterQuery ? `&${filterQuery}` : ''}`
        : programId
          ? `/api/programs/${programId}/history?page=${page}&per_page=5${filterQuery ? `&${filterQuery}` : ''}`
          : null;

    const { data, error, isLoading } = useSWR<
        ServerResponseMany<ActivityHistoryResponse>
    >(endpoint);

    useEffect(() => {
        setPage(1);
    }, [filterQuery]);

    const heading = programId ? 'Program History' : 'Account Overview';
    const totalPages = data?.meta?.last_page ?? 1;

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-foreground">{heading}</CardTitle>
                <Select value={filterQuery} onValueChange={setFilterQuery}>
                    <SelectTrigger className="w-[160px]">
                        <SelectValue placeholder="Filter" />
                    </SelectTrigger>
                    <SelectContent>
                        {FILTER_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value || 'all'}>
                                {opt.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </CardHeader>
            <CardContent>
                {isLoading && (
                    <p className="text-sm text-muted-foreground py-4 text-center">
                        Loading...
                    </p>
                )}
                {error && (
                    <p className="text-sm text-red-600 py-4 text-center">
                        Unable to retrieve history
                    </p>
                )}
                {!isLoading && !error && data && (
                    <>
                        <div className="space-y-2">
                            {data.data.map((item, idx) => (
                                <div
                                    key={idx}
                                    className="flex items-center justify-between py-2 px-3 rounded-md border border-border"
                                >
                                    <div>
                                        <p className="text-sm font-medium text-foreground">
                                            {formatAction(item.action)}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            {item.user_username}
                                            {item.admin_username &&
                                                ` by ${item.admin_username}`}
                                        </p>
                                    </div>
                                    <span className="text-xs text-muted-foreground">
                                        {formatActivityDate(item.created_at)}
                                    </span>
                                </div>
                            ))}
                        </div>
                        {totalPages > 1 && (
                            <div className="flex items-center justify-center gap-2 mt-4">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={page <= 1}
                                    onClick={() => setPage((p) => p - 1)}
                                >
                                    <ChevronLeft className="size-4" />
                                </Button>
                                <span className="text-sm text-muted-foreground">
                                    {page} of {totalPages}
                                </span>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={page >= totalPages}
                                    onClick={() => setPage((p) => p + 1)}
                                >
                                    <ChevronRight className="size-4" />
                                </Button>
                            </div>
                        )}
                    </>
                )}
            </CardContent>
        </Card>
    );
}
