import { useState } from 'react';
import useSWR from 'swr';
import { Calendar } from 'lucide-react';

interface AuditEntry {
    id: number;
    created_at: string;
    description: string;
    actor_name: string;
}

interface AuditTabProps {
    classId: number;
}

export function AuditTab({ classId }: AuditTabProps) {
    const { data: auditResp } = useSWR<{ data: AuditEntry[] }>(
        `/api/program-classes/${classId}/history`
    );
    const [expanded, setExpanded] = useState(false);

    const entries = auditResp?.data ?? [];
    const displayEntries = expanded ? entries : entries.slice(0, 20);

    return (
        <div className="bg-card rounded-lg border border-border p-6">
            <h3 className="text-foreground mb-6 font-semibold">Audit History</h3>
            {entries.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                    <Calendar className="size-12 mx-auto mb-3 text-muted-foreground" />
                    <p>No audit history available</p>
                    <p className="text-sm mt-1">
                        Changes to this class will be logged here
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    {displayEntries.map((entry) => (
                        <div key={entry.id} className="flex gap-3 text-sm">
                            <div className="text-muted-foreground min-w-[100px]">
                                {new Date(entry.created_at).toLocaleDateString(
                                    'en-US',
                                    {
                                        month: 'numeric',
                                        day: 'numeric',
                                        year: 'numeric'
                                    }
                                )}
                            </div>
                            <div className="flex-1 text-foreground">
                                {entry.description}
                                {entry.actor_name && (
                                    <>
                                        {' by '}
                                        <span className="font-medium">
                                            {entry.actor_name}
                                        </span>
                                    </>
                                )}
                            </div>
                        </div>
                    ))}
                    {entries.length > 20 && (
                        <button
                            onClick={() => setExpanded(!expanded)}
                            className="text-sm text-[#556830] hover:text-foreground underline"
                        >
                            {expanded ? 'Show Less' : `Show All (${entries.length})`}
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
