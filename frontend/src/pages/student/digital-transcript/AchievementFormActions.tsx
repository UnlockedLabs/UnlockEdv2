import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
    learningRecordOutlineButtonClassName,
    learningRecordPrimaryButtonClassName,
    LEARNING_RECORD_BUTTON_SIZE
} from './learningRecordButtons';

interface AchievementFormActionsProps {
    onCancel: () => void;
    onDone: () => void;
    showDelete?: boolean;
    onDeleteRequest?: () => void;
}

export function AchievementFormActions({
    onCancel,
    onDone,
    showDelete,
    onDeleteRequest
}: AchievementFormActionsProps) {
    return (
        <div className="-mx-3 flex flex-col-reverse gap-2 border-t border-border bg-background px-3 pt-4 sm:flex-row sm:justify-end">
            <Button
                type="button"
                variant="outline"
                size={LEARNING_RECORD_BUTTON_SIZE}
                className={learningRecordOutlineButtonClassName}
                onClick={onCancel}
            >
                Cancel
            </Button>
            {showDelete && onDeleteRequest ? (
                <Button
                    type="button"
                    variant="outline"
                    size={LEARNING_RECORD_BUTTON_SIZE}
                    className={cn(
                        learningRecordOutlineButtonClassName,
                        'text-destructive hover:bg-destructive/10 hover:text-destructive'
                    )}
                    onClick={onDeleteRequest}
                >
                    Delete
                </Button>
            ) : null}
            <Button
                type="button"
                size={LEARNING_RECORD_BUTTON_SIZE}
                data-slot="transcript-done"
                className={learningRecordPrimaryButtonClassName}
                onClick={onDone}
            >
                Done
            </Button>
        </div>
    );
}
