export function decodeHtmlEntities(input: string): string {
    if (!input) return input;
    const el = document.createElement('textarea');
    el.innerHTML = input;
    return el.value;
}
