/** Max characters shown before truncating with an ellipsis (banner, lists, PDF). */
export const MAX_ENTRY_TITLE_DISPLAY_LENGTH = 40;

/**
 * Known-good short program codes — always shown as-is even if other rules change.
 * Tune per facility during pilot.
 */
export const KNOWN_SHORT_ENTRY_TITLES = [
    'GED',
    'CPR',
    'ABE',
    'OSHA',
    'HVAC',
    'GAA'
] as const;

const KNOWN_SHORT_ENTRY_TITLE_SET = new Set<string>(KNOWN_SHORT_ENTRY_TITLES);

export const DEFAULT_ENTRY_DISPLAY_TITLE = 'Untitled achievement';

export const INCOMPLETE_ENTRY_BANNER_GENERIC =
    'You started an achievement — pick up where you left off.';

/**
 * True when the raw title should not be shown to residents (placeholder keystrokes,
 * punctuation-only, empty, etc.). Real short codes like GED pass via safelist or
 * character-variety checks — length alone is not used.
 */
export function isJunkEntryTitle(title: string | null | undefined): boolean {
    if (title == null) return true;

    const trimmed = title.trim();
    if (trimmed.length === 0) return true;

    if (KNOWN_SHORT_ENTRY_TITLE_SET.has(trimmed.toUpperCase())) return false;

    if (!/[a-z0-9]/i.test(trimmed)) return true;

    const uniqueChars = new Set(trimmed.replace(/\s/g, '').toLowerCase());
    if (uniqueChars.size === 1) return true;

    return false;
}

/** Trim and truncate long titles for display. Assumes title is not junk. */
export function formatEntryTitleForDisplay(title: string): string {
    const trimmed = title.trim();
    if (trimmed.length <= MAX_ENTRY_TITLE_DISPLAY_LENGTH) return trimmed;
    return `${trimmed.slice(0, MAX_ENTRY_TITLE_DISPLAY_LENGTH).trimEnd()}…`;
}

/** Banner copy for an in-progress entry reminder on the resident homepage. */
export function getIncompleteEntryBannerText(
    rawTitle: string | null | undefined
): string {
    if (isJunkEntryTitle(rawTitle)) {
        return INCOMPLETE_ENTRY_BANNER_GENERIC;
    }
    const display = formatEntryTitleForDisplay(rawTitle!);
    return `You started logging “${display}” — pick up where you left off.`;
}

/**
 * Resident-facing list / row label. Junk titles resolve to `fallback` so "vv"
 * never appears in one view while filtered in another.
 */
export function getEntryDisplayTitle(
    rawTitle: string | null | undefined,
    fallback = DEFAULT_ENTRY_DISPLAY_TITLE
): string {
    if (isJunkEntryTitle(rawTitle)) return fallback;
    return formatEntryTitleForDisplay(rawTitle!);
}

/** Like `getEntryDisplayTitle`, but returns null for junk/empty (placeholder UI). */
export function getEntryDisplayTitleOrNull(
    rawTitle: string | null | undefined
): string | null {
    if (isJunkEntryTitle(rawTitle)) return null;
    return formatEntryTitleForDisplay(rawTitle!);
}
