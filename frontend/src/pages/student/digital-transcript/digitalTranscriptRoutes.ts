import {
    DEFAULT_LEARNING_RECORD_PROTOTYPE,
    LEARNING_RECORD_PROTOTYPES,
    LEGACY_DIGITAL_TRANSCRIPT_BASE,
    resolveLearningRecordPrototype
} from './learningRecordPrototypes';

/** Default prototype home route (Learning Record list). */
export const DIGITAL_TRANSCRIPT_BASE = DEFAULT_LEARNING_RECORD_PROTOTYPE.basePath;

/** Default prototype editor + live preview route. */
export const DIGITAL_TRANSCRIPT_ENTRY_PATH = DEFAULT_LEARNING_RECORD_PROTOTYPE.entryPath;

export { DEFAULT_LEARNING_RECORD_PROTOTYPE, LEGACY_DIGITAL_TRANSCRIPT_BASE };

export function isDigitalTranscriptPath(pathname: string): boolean {
    if (pathname === LEGACY_DIGITAL_TRANSCRIPT_BASE || pathname.startsWith(`${LEGACY_DIGITAL_TRANSCRIPT_BASE}/`)) {
        return true;
    }
    return LEARNING_RECORD_PROTOTYPES.some(
        (p) => pathname === p.basePath || pathname.startsWith(`${p.basePath}/`)
    );
}

/** WYSIWYG editor + live preview — fixed viewport; editor list scrolls, preview does not. */
export function isDigitalTranscriptEntryPath(pathname: string): boolean {
    return LEARNING_RECORD_PROTOTYPES.some((p) => pathname === p.entryPath);
}

/** @deprecated Use isDigitalTranscriptPath */
export const isAnyDigitalTranscriptPath = isDigitalTranscriptPath;

export function getDigitalTranscriptBasePath(pathname: string): string {
    if (pathname === LEGACY_DIGITAL_TRANSCRIPT_BASE || pathname.startsWith(`${LEGACY_DIGITAL_TRANSCRIPT_BASE}/`)) {
        return DEFAULT_LEARNING_RECORD_PROTOTYPE.basePath;
    }
    return resolveLearningRecordPrototype(pathname).basePath;
}

let activeStorageBasePath: string = DEFAULT_LEARNING_RECORD_PROTOTYPE.basePath;

/** Pin localStorage namespace while on a prototype route (home + entry). */
export function setDigitalTranscriptStorageContext(basePath: string): void {
    activeStorageBasePath = getDigitalTranscriptBasePath(basePath);
}

export function getActiveDigitalTranscriptStorageBasePath(): string {
    return activeStorageBasePath;
}
