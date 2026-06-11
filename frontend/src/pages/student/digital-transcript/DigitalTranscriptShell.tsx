import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { LEARNING_RECORD_BUTTON_SIZE } from './learningRecordButtons';

/** Page canvas — shadcn `muted` surface */
export const dtPageSurface = 'bg-muted';

/** Viewport below TopNav (`h-16`) — fills visible main area on Learning Record routes */
export const dtShellMinHeight = 'min-h-[calc(100dvh-4rem)]';

interface ShellProps {
    children: ReactNode;
    /**
     * `narrow` — centered column for lightweight states (e.g. loading).
     * `wide` — full width within the same `max-w-7xl` content area as Knowledge Center / Home.
     */
    variant?: 'narrow' | 'wide';
}

/**
 * Learning Record shell: page scrolls with the main layout (no nested ScrollArea).
 * `max-w-7xl mx-auto px-6 py-8` matches ResidentKnowledgeCenter rhythm.
 */
export function DigitalTranscriptShell({ children, variant = 'wide' }: ShellProps) {
    const innerClass = variant === 'narrow' ? 'mx-auto w-full max-w-xl' : 'w-full';

    return (
        <div
            data-slot="digital-transcript-shell"
            className={cn('flex flex-1 flex-col', dtShellMinHeight, dtPageSurface)}
        >
            <div
                className={cn(
                    'mx-auto flex w-full max-w-7xl flex-1 flex-col px-6 py-8',
                    dtShellMinHeight,
                    dtPageSurface
                )}
            >
                <div className={cn('relative flex min-h-0 flex-1 flex-col', innerClass)}>{children}</div>
            </div>
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
        <Button
            asChild
            variant="ghost"
            size={LEARNING_RECORD_BUTTON_SIZE}
            className="group h-10 gap-1.5 text-primary hover:bg-muted hover:text-primary"
        >
            <Link to={to} data-slot="digital-transcript-back">
                <span
                    className="inline-block transition-transform group-hover:-translate-x-0.5"
                    aria-hidden
                >
                    ←
                </span>
                {children}
            </Link>
        </Button>
    );
}

export function DigitalTranscriptEyebrow({ children }: { children: ReactNode }) {
    return (
        <p
            data-slot="digital-transcript-eyebrow"
            className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
        >
            {children}
        </p>
    );
}

export function DigitalTranscriptPageTitle({ children }: { children: ReactNode }) {
    return (
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{children}</h1>
    );
}
