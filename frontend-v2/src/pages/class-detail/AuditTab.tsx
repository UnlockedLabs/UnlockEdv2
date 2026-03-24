import { useState } from 'react';
import useSWR from 'swr';
import { Calendar } from 'lucide-react';
import { ServerResponseMany } from '@/types/server';

interface HistoryEntry {
    action: string;
    created_at: string;
    field_name: string | null;
    old_value: string | null;
    new_value: string | null;
    admin_username: string | null;
}

interface AuditTabProps {
    classId: number;
}

function parseDateFromRRule(rrule: string): string | null {
    const match = /DTSTART[^:]*:(\d{4})(\d{2})(\d{2})/.exec(rrule);
    if (!match) return null;
    const [, y, m, d] = match;
    return `${Number(m)}/${Number(d)}/${y}`;
}

function formatFieldLabel(name: string): string {
    return name.replace(/_/g, ' ');
}

const B = ({ children }: { children: React.ReactNode }) => (
    <span className="font-medium">{children}</span>
);

function formatEntry(entry: HistoryEntry): React.ReactNode {
    const actor = entry.admin_username ?? 'System';
    const field = entry.field_name ?? '';

    if (field === 'class' || field === 'program') {
        return <>Class created by <B>{actor}</B></>;
    }

    if (field === 'event_rescheduled') {
        const origDate = entry.old_value
            ? parseDateFromRRule(entry.old_value)
            : null;
        const newVal = entry.new_value ?? '';
        if (origDate) {
            return <>Event on <B>{origDate}</B> moved to <B>{newVal}</B> by <B>{actor}</B></>;
        }
        return <>Event rescheduled to <B>{newVal}</B> by <B>{actor}</B></>;
    }

    if (field === 'event_cancelled') {
        const date = entry.new_value
            ? parseDateFromRRule(entry.new_value)
            : null;
        return date
            ? <>Event on <B>{date}</B> cancelled by <B>{actor}</B></>
            : <>Event cancelled by <B>{actor}</B></>;
    }

    if (field === 'event_restored') {
        const date = entry.old_value
            ? parseDateFromRRule(entry.old_value)
            : null;
        return date
            ? <><B>{actor}</B> restored event on <B>{date}</B></>
            : <>Event restored by <B>{actor}</B></>;
    }

    if (field === 'event_rescheduled_series') {
        return <>Schedule series updated by <B>{actor}</B></>;
    }

    if (field === 'event_substitute_instructor') {
        return <>Substitute instructor set to <B>{entry.new_value ?? ''}</B> by <B>{actor}</B></>;
    }

    if (field === 'event_room_changed') {
        return <>Room changed to <B>{entry.new_value ?? ''}</B> by <B>{actor}</B></>;
    }

    const label = formatFieldLabel(field);
    if (entry.old_value && entry.new_value) {
        return <>{label} changed from <B>{entry.old_value}</B> to <B>{entry.new_value}</B> by <B>{actor}</B></>;
    }
    if (entry.new_value) {
        return <>{label} set to <B>{entry.new_value}</B> by <B>{actor}</B></>;
    }
    if (entry.old_value) {
        return <>{label} removed (was <B>{entry.old_value}</B>) by <B>{actor}</B></>;
    }
    return <>{label} updated by <B>{actor}</B></>;
}

export function AuditTab({ classId }: AuditTabProps) {
    const { data: auditResp } = useSWR<ServerResponseMany<HistoryEntry>>(
        `/api/program-classes/${classId}/history`
    );
    const [expanded, setExpanded] = useState(false);

    const entries = auditResp?.data ?? [];
    const displayEntries = expanded ? entries : entries.slice(0, 20);

    return (
        <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6">
            <h3 className="text-[#203622] mb-6">Audit History</h3>
            {entries.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                    <Calendar className="size-12 mx-auto mb-3 text-gray-500" />
                    <p>No audit history available</p>
                    <p className="text-sm mt-1">
                        Changes to this class will be logged here
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    {displayEntries.map((entry, idx) => (
                        <div
                            key={`${entry.created_at}-${entry.field_name}-${idx}`}
                            className="flex gap-3 text-sm"
                        >
                            <div className="text-gray-500 min-w-[100px] shrink-0">
                                {new Date(entry.created_at).toLocaleDateString(
                                    'en-US',
                                    {
                                        month: 'numeric',
                                        day: 'numeric',
                                        year: 'numeric'
                                    }
                                )}
                            </div>
                            <div className="flex-1 text-gray-700">
                                {formatEntry(entry)}
                            </div>
                        </div>
                    ))}
                    {entries.length > 20 && (
                        <button
                            onClick={() => setExpanded(!expanded)}
                            className="text-sm text-[#556830] hover:text-[#203622] underline"
                        >
                            {expanded
                                ? 'Show Less'
                                : `Show All (${entries.length})`}
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
