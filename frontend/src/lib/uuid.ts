/**
 * UUID with a fallback.
 *
 * `crypto.randomUUID` only exists in a secure context (HTTPS or localhost) and in
 * reasonably current browsers. Both Learning Record call sites run inside the entry
 * page's bootstrap effect, so where it is missing the throw lands on the router's
 * error boundary and the resident gets the generic error page — on facility devices,
 * which is exactly where an old browser or a plain-HTTP origin turns up.
 */
export function newUuid(): string {
    try {
        if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
            return crypto.randomUUID();
        }
    } catch {
        /* fall through */
    }
    try {
        if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
            const bytes = crypto.getRandomValues(new Uint8Array(16));
            // RFC 4122 version 4, variant 1.
            bytes[6] = (bytes[6] & 0x0f) | 0x40;
            bytes[8] = (bytes[8] & 0x3f) | 0x80;
            const hex = Array.from(bytes, (b) =>
                b.toString(16).padStart(2, '0')
            ).join('');
            return [
                hex.slice(0, 8),
                hex.slice(8, 12),
                hex.slice(12, 16),
                hex.slice(16, 20),
                hex.slice(20)
            ].join('-');
        }
    } catch {
        /* fall through */
    }
    // Last resort: not cryptographically random, but these ids only have to be
    // unique per resident, and a working form beats a crashed one.
    return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}`;
}
