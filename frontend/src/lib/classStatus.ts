import { Class, SelectedClassStatus } from '@/types';

export function isCompletedCancelledOrArchived(cls: Class): boolean {
    return (
        cls.status === SelectedClassStatus.Completed ||
        cls.status === SelectedClassStatus.Cancelled ||
        !!cls.archived_at
    );
}
