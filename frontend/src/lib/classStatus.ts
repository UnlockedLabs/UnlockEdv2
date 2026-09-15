import { Cohort, SelectedClassStatus } from '@/types';

export function isCompletedCancelledOrArchived(cls: Cohort): boolean {
    return (
        cls.status === SelectedClassStatus.Completed ||
        cls.status === SelectedClassStatus.Cancelled ||
        !!cls.archived_at
    );
}
