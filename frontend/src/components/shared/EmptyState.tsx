import { ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';

interface EmptyStateProps {
    icon?: ReactNode;
    title: string;
    description?: string;
    action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
    return (
        <Card className="bg-card">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                {icon && (
                    <div className="rounded-full bg-muted p-3 mb-4">
                        {icon}
                    </div>
                )}
                <h3 className="text-lg font-medium text-foreground">{title}</h3>
                {description && (
                    <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                        {description}
                    </p>
                )}
                {action && <div className="mt-4">{action}</div>}
            </CardContent>
        </Card>
    );
}
