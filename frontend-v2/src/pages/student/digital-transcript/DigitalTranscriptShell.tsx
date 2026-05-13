import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

/** Moss / forest accent — aligns with Knowledge Center and brand nav */
export const dtAccent = 'text-[#556830]';
export const dtAccentSoft = 'bg-[#556830]/10';
export const dtTitle = 'text-[#203622] dark:text-foreground';

interface ShellProps {
    children: ReactNode;
    /** Survey is slightly narrower for reading comfort; xlWide fits split editor + preview */
    variant?: 'narrow' | 'wide' | 'xlWide';
}

export function DigitalTranscriptShell({ children, variant = 'wide' }: ShellProps) {
    const widthClass =
        variant === 'narrow'
            ? 'mx-auto max-w-xl px-5 pb-24 pt-8 sm:px-8 sm:pt-10'
            : variant === 'xlWide'
              ? 'mx-auto max-w-6xl px-5 pb-24 pt-8 sm:px-8 sm:pt-12'
              : 'mx-auto max-w-2xl px-5 pb-24 pt-8 sm:px-8 sm:pt-12';

    return (
        <div data-slot="digital-transcript-shell" className={cn('relative min-h-[min(70vh,40rem)]', widthClass)}>
            <div
                className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-[#556830]/30 to-transparent dark:via-primary/25 sm:inset-x-12"
                aria-hidden
            />
            {children}
        </div>
    );
}

export function DigitalTranscriptBackLink({
    to,
    children
}: {
    to: string;
    children: ReactNode;
}) {
    return (
        <Link
            to={to}
            data-slot="digital-transcript-back"
            className={cn(
                'group inline-flex items-center gap-1.5 text-sm font-medium transition-colors',
                dtAccent,
                'hover:text-[#203622] dark:hover:text-foreground'
            )}
        >
            <span
                className="inline-block transition-transform group-hover:-translate-x-0.5"
                aria-hidden
            >
                ←
            </span>
            {children}
        </Link>
    );
}

export function DigitalTranscriptEyebrow({ children }: { children: ReactNode }) {
    return (
        <p
            data-slot="digital-transcript-eyebrow"
            className={cn(
                'text-[11px] font-semibold uppercase tracking-[0.22em]',
                dtAccent
            )}
        >
            {children}
        </p>
    );
}

export function DigitalTranscriptPageTitle({ children }: { children: ReactNode }) {
    return <h1 className="text-[#203622] mb-2">{children}</h1>;
}
