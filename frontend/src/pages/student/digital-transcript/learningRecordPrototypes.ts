/** Preserved Learning Record prototype versions (Cmd+K registry). */
export const LEARNING_RECORD_PROTOTYPES = [
    {
        id: 'LearningRecord-Funnel',
        label: 'LearningRecord-Funnel',
        basePath: '/learning-record-funnel',
        entryPath: '/learning-record-funnel/entry',
        storageSuffix: 'funnel' as const
    },
    {
        id: 'LearningRecord-Categories',
        label: 'LearningRecord-Categories',
        basePath: '/learning-record-categories',
        entryPath: '/learning-record-categories/entry',
        storageSuffix: 'categories' as const
    }
] as const;

export type LearningRecordPrototypeId = (typeof LEARNING_RECORD_PROTOTYPES)[number]['id'];
export type LearningRecordFormVariant = 'funnel' | 'categories';

/** @deprecated Redirect target for bookmarks */
export const LEGACY_DIGITAL_TRANSCRIPT_BASE = '/my-transcript-a';

export const DEFAULT_LEARNING_RECORD_PROTOTYPE = LEARNING_RECORD_PROTOTYPES[0];

export function resolveLearningRecordPrototype(pathname: string) {
    return (
        LEARNING_RECORD_PROTOTYPES.find(
            (p) => pathname === p.basePath || pathname.startsWith(`${p.basePath}/`)
        ) ?? DEFAULT_LEARNING_RECORD_PROTOTYPE
    );
}

export function getLearningRecordFormVariant(pathname: string): LearningRecordFormVariant {
    return resolveLearningRecordPrototype(pathname).storageSuffix;
}
