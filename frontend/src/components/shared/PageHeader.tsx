import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
    title: string;
    subtitle?: ReactNode;
    meta?: ReactNode;
    actions?: ReactNode;
    className?: string;
}

export function PageHeader({
    title,
    subtitle,
    meta,
    actions,
    className
}: PageHeaderProps) {
    return (
        <div
            className={cn('flex items-start justify-between', className)}
        >
            <div>
                <h1 className="text-[#203622] dark:text-white mb-2">
                    {title}
                </h1>
                {subtitle && (
                    <div className="text-gray-600 dark:text-gray-300">
                        {subtitle}
                    </div>
                )}
                {meta && (
                    <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        {meta}
                    </div>
                )}
            </div>
            {actions && (
                <div className="flex items-center gap-2">{actions}</div>
            )}
        </div>
    );
}
