import { ElementType } from 'react';
import { InfoTooltip } from '@/components/shared';

interface MetricCardProps {
    icon: ElementType;
    value: string;
    label: string;
    sub?: string;
    tooltip?: string;
}

export function MetricCard({
    icon: Icon,
    value,
    label,
    sub,
    tooltip
}: MetricCardProps) {
    return (
        <div className="bg-card rounded-lg border border-gray-200 dark:border-border p-4 flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-3">
                <div className="bg-surface-hover dark:bg-muted p-2 rounded">
                    <Icon className="size-5 text-brand dark:text-brand-gold" />
                </div>
                <div className="text-2xl text-brand-dark dark:text-white">
                    {value}
                </div>
                {tooltip && (
                    <InfoTooltip className="ml-auto">{tooltip}</InfoTooltip>
                )}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
                {label}
            </div>
            {sub && (
                <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                    {sub}
                </div>
            )}
        </div>
    );
}
