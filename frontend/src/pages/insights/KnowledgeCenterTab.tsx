import { BookOpenIcon } from '@heroicons/react/24/outline';
import { EmptyState } from '@/components/shared';

export default function KnowledgeCenterTab() {
    return (
        <EmptyState
            icon={<BookOpenIcon className="size-6 text-muted-foreground" />}
            title="Knowledge Center insights coming soon"
            description="Library and video engagement metrics will appear here in an upcoming release."
        />
    );
}
