import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type PanelTone =
    | 'red'
    | 'orange'
    | 'amber'
    | 'yellow'
    | 'green'
    | 'blue'
    | 'gray';

const TONE_PANEL: Record<PanelTone, string> = {
    red: 'bg-red-50 border-red-200',
    orange: 'bg-orange-50 border-orange-200',
    amber: 'bg-amber-50 border-amber-200',
    yellow: 'bg-yellow-50 border-yellow-200',
    green: 'bg-green-50 border-green-200',
    blue: 'bg-blue-50 border-blue-200',
    gray: 'bg-gray-50 border-gray-200'
};

interface TonedPanelProps {
    tone: PanelTone;
    className?: string;
    children: ReactNode;
}

/**
 * Tinted alert / warning container used by destructive-confirm modals,
 * bulk-action selection summaries, and import-result panels. The caller
 * owns the inner content (icons, text, lists, inputs).
 */
export function TonedPanel({ tone, className, children }: TonedPanelProps) {
    return (
        <div
            className={cn('border rounded-lg p-4', TONE_PANEL[tone], className)}
        >
            {children}
        </div>
    );
}
