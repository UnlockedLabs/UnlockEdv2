import type { DigitalTranscriptVariant } from '@/types/digital-transcript';

/** Resident digital transcript — variant A (sidebar) */
export const DIGITAL_TRANSCRIPT_A_BASE = '/my-transcript-a';

/** Resident digital transcript — variant B (sidebar) */
export const DIGITAL_TRANSCRIPT_B_BASE = '/my-transcript';

export type DigitalTranscriptBasePath =
    | typeof DIGITAL_TRANSCRIPT_A_BASE
    | typeof DIGITAL_TRANSCRIPT_B_BASE;

export function isDigitalTranscriptAPath(pathname: string): boolean {
    return (
        pathname === DIGITAL_TRANSCRIPT_A_BASE ||
        pathname.startsWith(`${DIGITAL_TRANSCRIPT_A_BASE}/`)
    );
}

export function isDigitalTranscriptBPath(pathname: string): boolean {
    return (
        pathname === DIGITAL_TRANSCRIPT_B_BASE ||
        pathname.startsWith(`${DIGITAL_TRANSCRIPT_B_BASE}/`)
    );
}

export function isAnyDigitalTranscriptPath(pathname: string): boolean {
    return isDigitalTranscriptAPath(pathname) || isDigitalTranscriptBPath(pathname);
}

export function getDigitalTranscriptBasePath(pathname: string): DigitalTranscriptBasePath {
    if (isDigitalTranscriptAPath(pathname)) return DIGITAL_TRANSCRIPT_A_BASE;
    return DIGITAL_TRANSCRIPT_B_BASE;
}

export function getDigitalTranscriptVariant(pathname: string): DigitalTranscriptVariant {
    return isDigitalTranscriptAPath(pathname) ? 'a' : 'b';
}
