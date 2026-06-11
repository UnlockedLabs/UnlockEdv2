import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export function toExternalUrl(url: string): string {
    if (!url) return url;
    if (
        url.startsWith('//') ||
        /^[a-z][a-z\d+.-]*:\/\//i.test(url) ||
        /^(mailto|tel):/i.test(url)
    ) {
        return url;
    }
    return `https://${url}`;
}
