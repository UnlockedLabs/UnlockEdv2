import API from './api';
import type {
    TranscriptDraft,
    TranscriptEntry,
    TranscriptQ4Toggle
} from '@/types/digital-transcript';

interface BackendEntry {
    id: number;
    client_id: string;
    program_name: string;
    completion_date: string;
    confidence: string;
    summary: string;
    top_skills: string[];
    barrier_to_completion: string;
    goal_connection: string;
    pride: string;
    standout_moment: string;
    advice_to_peer: string;
    challenge_toggle: string | null;
    challenge_text: string;
    skill_tags_before: string[];
    skill_tags_after: string[];
    skill_reflection: string;
    growth_reflection: string;
    support_selections: string[];
    next_step_selections: string[];
    created_at: string;
}

function arr(v: unknown): string[] {
    return Array.isArray(v)
        ? v.filter((x): x is string => typeof x === 'string')
        : [];
}

function toFrontend(b: BackendEntry): TranscriptEntry {
    return {
        id: b.client_id,
        createdAt: b.created_at,
        programName: b.program_name,
        completionDate: b.completion_date,
        confidence: b.confidence,
        oneSentence: b.summary,
        topSkills: arr(b.top_skills),
        whatMadeYouFinish: b.barrier_to_completion,
        goalConnection: b.goal_connection,
        pride: b.pride,
        standoutMoment: b.standout_moment,
        adviceToPeer: b.advice_to_peer,
        q4Toggle: (b.challenge_toggle as TranscriptQ4Toggle | null) ?? null,
        q4Text: b.challenge_text ?? '',
        q5BeforeTags: arr(b.skill_tags_before),
        q5AfterTags: arr(b.skill_tags_after),
        q5FreeText: b.skill_reflection ?? '',
        q7Text: b.growth_reflection ?? '',
        q8Selections: arr(b.support_selections),
        q9Selections: arr(b.next_step_selections)
    };
}

function toDraftFrontend(b: BackendEntry, updatedAt: string): TranscriptDraft {
    return {
        id: b.client_id,
        updatedAt,
        stepIndex: 0,
        uiPhase: 'survey',
        programName: b.program_name,
        completionDate: b.completion_date,
        confidence: b.confidence,
        oneSentence: b.summary,
        topSkills: arr(b.top_skills),
        whatMadeYouFinish: b.barrier_to_completion,
        goalConnection: b.goal_connection,
        pride: b.pride,
        standoutMoment: b.standout_moment,
        adviceToPeer: b.advice_to_peer,
        q4Toggle: (b.challenge_toggle as TranscriptQ4Toggle | null) ?? null,
        q4Text: b.challenge_text ?? '',
        q5BeforeTags: arr(b.skill_tags_before),
        q5AfterTags: arr(b.skill_tags_after),
        q5FreeText: b.skill_reflection ?? '',
        q7Text: b.growth_reflection ?? '',
        q8Selections: arr(b.support_selections),
        q9Selections: arr(b.next_step_selections),
        editingEntryId: undefined
    };
}

function toBackend(clientId: string, e: TranscriptEntry | TranscriptDraft) {
    return {
        client_id: clientId,
        program_name: e.programName,
        completion_date: e.completionDate,
        confidence: e.confidence,
        summary: e.oneSentence,
        top_skills: e.topSkills,
        barrier_to_completion: e.whatMadeYouFinish,
        goal_connection: e.goalConnection,
        pride: e.pride,
        standout_moment: e.standoutMoment,
        advice_to_peer: e.adviceToPeer,
        challenge_toggle: e.q4Toggle,
        challenge_text: e.q4Text,
        skill_tags_before: e.q5BeforeTags,
        skill_tags_after: e.q5AfterTags,
        skill_reflection: e.q5FreeText,
        growth_reflection: e.q7Text,
        support_selections: e.q8Selections,
        next_step_selections: e.q9Selections
    };
}

function extractArray(
    resp: Awaited<ReturnType<typeof API.get<BackendEntry>>>
): BackendEntry[] {
    if (!resp.success) return [];
    if (resp.type === 'many') return resp.data;
    if (Array.isArray(resp.data)) return resp.data;
    return [];
}

export async function apiGetEntries(): Promise<{
    entries: TranscriptEntry[];
    backendIds: Map<string, number>;
}> {
    const resp = await API.get<BackendEntry>('learning-record/entries');
    const rows = extractArray(resp);
    const entries: TranscriptEntry[] = [];
    const backendIds = new Map<string, number>();
    for (const b of rows) {
        entries.push(toFrontend(b));
        backendIds.set(b.client_id, b.id);
    }
    return { entries, backendIds };
}

export async function apiCreateEntry(
    entry: TranscriptEntry
): Promise<{ entry: TranscriptEntry; backendId: number } | null> {
    const resp = await API.post<BackendEntry, ReturnType<typeof toBackend>>(
        'learning-record/entries',
        toBackend(entry.id, entry)
    );
    if (!resp.success || resp.type !== 'one' || !resp.data) return null;
    const b = resp.data;
    return { entry: toFrontend(b), backendId: b.id };
}

export async function apiUpdateEntry(
    backendId: number,
    entry: TranscriptEntry
): Promise<boolean> {
    const resp = await API.put<BackendEntry, ReturnType<typeof toBackend>>(
        `learning-record/entries/${backendId}`,
        toBackend(entry.id, entry)
    );
    return resp.success;
}

export async function apiDeleteEntry(backendId: number): Promise<boolean> {
    const resp = await API.delete<string>(
        `learning-record/entries/${backendId}`
    );
    return resp.success;
}

export async function apiGetDraft(): Promise<TranscriptDraft | null> {
    const resp = await API.get<BackendEntry & { updated_at: string }>(
        'learning-record/draft'
    );
    if (!resp.success || resp.type !== 'one' || !resp.data) return null;
    const b = resp.data as (BackendEntry & { updated_at: string }) | null;
    if (!b || !b.client_id) return null;
    return toDraftFrontend(b, b.updated_at ?? new Date().toISOString());
}

export async function apiUpsertDraft(draft: TranscriptDraft): Promise<boolean> {
    const resp = await API.put<BackendEntry, ReturnType<typeof toBackend>>(
        'learning-record/draft',
        toBackend(draft.id, draft)
    );
    return resp.success;
}

export async function apiDeleteDraft(clientId: string): Promise<boolean> {
    const resp = await API.delete<string>(
        `learning-record/draft?client_id=${encodeURIComponent(clientId)}`
    );
    return resp.success;
}
