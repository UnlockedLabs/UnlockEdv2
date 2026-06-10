import type { ReactNode } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface AchievementFormCategoryCardProps {
    title: string;
    description?: string;
    labelledBy?: string;
    children: ReactNode;
    className?: string;
}

/** 15five-style section container for the learning-record-categories editor. */
export function AchievementFormCategoryCard({
    title,
    description,
    labelledBy,
    children,
    className
}: AchievementFormCategoryCardProps) {
    return (
        <Card
            data-slot="achievement-form-category-card"
            className={cn(
                'gap-0 overflow-hidden border-border/80 bg-card p-0 shadow-sm',
                className
            )}
        >
            <CardHeader className="grid-rows-[auto_auto] gap-1 border-b border-border/60 px-5 py-4">
                <CardTitle
                    id={labelledBy}
                    className="text-base font-semibold tracking-tight text-foreground"
                >
                    {title}
                </CardTitle>
                {description ? (
                    <CardDescription className="max-w-prose text-xs leading-relaxed">
                        {description}
                    </CardDescription>
                ) : null}
            </CardHeader>
            <CardContent className="space-y-5 px-5 py-5">{children}</CardContent>
        </Card>
    );
}
