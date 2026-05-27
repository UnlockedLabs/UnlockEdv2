import API from './api';

export interface BulkPatchSession {
    eventId: number;
}

export interface BulkPatchResult {
    ok: number;
    fail: number;
}

export async function bulkPatchEvents<T extends BulkPatchSession>(
    classId: number,
    sessions: T[],
    buildBody: (session: T) => Record<string, unknown>
): Promise<BulkPatchResult> {
    const results = await Promise.allSettled(
        sessions.map((s) =>
            API.patch(
                `program-classes/${classId}/events/${s.eventId}`,
                buildBody(s)
            )
        )
    );
    const ok = results.filter(
        (r) => r.status === 'fulfilled' && r.value.success
    ).length;
    return { ok, fail: results.length - ok };
}
