import type { TranscriptEntry } from '@/types/digital-transcript';
import {
    countAnsweredReflections,
    reflectionSlotsTotal
} from '@/pages/student/digital-transcript/learningRecordDocumentModel';
import type { LearningRecordFormVariant } from './learningRecordPrototypes';
import { countFunnelFieldsAnswered } from './transcriptReflectionConfig';

export const LR_TABLE_SORT_STORAGE_KEY = 'lr_table_sort';

export type SortColumn = 'program' | 'completed' | 'questions' | 'addedOn';
export type SortDirection = 'asc' | 'desc';

export interface TableSort {
    column: SortColumn;
    direction: SortDirection;
}

export const DEFAULT_TABLE_SORT: TableSort = {
    column: 'addedOn',
    direction: 'desc'
};

const SORT_COLUMNS: SortColumn[] = ['program', 'completed', 'questions', 'addedOn'];
const SORT_DIRECTIONS: SortDirection[] = ['asc', 'desc'];

function isSortColumn(value: unknown): value is SortColumn {
    return typeof value === 'string' && SORT_COLUMNS.includes(value as SortColumn);
}

function isSortDirection(value: unknown): value is SortDirection {
    return typeof value === 'string' && SORT_DIRECTIONS.includes(value as SortDirection);
}

function getEntryQuestionsAnswered(
    entry: TranscriptEntry,
    formVariant: LearningRecordFormVariant
): number {
    if (formVariant === 'funnel') {
        return countFunnelFieldsAnswered(entry);
    }
    return countAnsweredReflections(entry);
}

function completionDateSortKey(entry: TranscriptEntry): number | null {
    const raw = entry.completionDate.trim();
    if (!raw) return null;
    const time = new Date(raw + 'T12:00:00').getTime();
    return Number.isNaN(time) ? null : time;
}

function addedOnSortKey(entry: TranscriptEntry): number {
    const raw = entry.createdAt.trim();
    if (!raw) return 0;
    const time = new Date(raw).getTime();
    return Number.isNaN(time) ? 0 : time;
}

function compareNullableNumbers(
    a: number | null,
    b: number | null,
    direction: SortDirection
): number {
    if (a === null && b === null) return 0;
    if (a === null) return 1;
    if (b === null) return -1;
    const diff = a - b;
    return direction === 'asc' ? diff : -diff;
}

function compareStrings(a: string, b: string, direction: SortDirection): number {
    const diff = a.localeCompare(b, undefined, { sensitivity: 'base' });
    return direction === 'asc' ? diff : -diff;
}

function compareNumbers(a: number, b: number, direction: SortDirection): number {
    const diff = a - b;
    return direction === 'asc' ? diff : -diff;
}

export function readTableSortFromSession(): TableSort {
    if (typeof window === 'undefined') {
        return DEFAULT_TABLE_SORT;
    }

    const raw = sessionStorage.getItem(LR_TABLE_SORT_STORAGE_KEY);
    if (!raw) {
        return DEFAULT_TABLE_SORT;
    }

    try {
        const parsed: unknown = JSON.parse(raw);
        if (
            typeof parsed === 'object' &&
            parsed !== null &&
            'column' in parsed &&
            'direction' in parsed &&
            isSortColumn((parsed as TableSort).column) &&
            isSortDirection((parsed as TableSort).direction)
        ) {
            return parsed as TableSort;
        }
    } catch {
        // fall through
    }

    return DEFAULT_TABLE_SORT;
}

export function writeTableSortToSession(sort: TableSort): void {
    if (typeof window === 'undefined') return;
    sessionStorage.setItem(LR_TABLE_SORT_STORAGE_KEY, JSON.stringify(sort));
}

export function toggleTableSort(current: TableSort, column: SortColumn): TableSort {
    if (current.column === column) {
        return {
            column,
            direction: current.direction === 'asc' ? 'desc' : 'asc'
        };
    }
    return { column, direction: 'asc' };
}

export function sortTranscriptEntries(
    entries: TranscriptEntry[],
    sort: TableSort,
    formVariant: LearningRecordFormVariant
): TranscriptEntry[] {
    const { column, direction } = sort;

    return [...entries].sort((a, b) => {
        switch (column) {
            case 'program':
                return compareStrings(
                    a.programName.trim(),
                    b.programName.trim(),
                    direction
                );
            case 'completed':
                return compareNullableNumbers(
                    completionDateSortKey(a),
                    completionDateSortKey(b),
                    direction
                );
            case 'questions':
                return compareNumbers(
                    getEntryQuestionsAnswered(a, formVariant),
                    getEntryQuestionsAnswered(b, formVariant),
                    direction
                );
            case 'addedOn':
                return compareNumbers(
                    addedOnSortKey(a),
                    addedOnSortKey(b),
                    direction
                );
            default:
                return 0;
        }
    });
}
