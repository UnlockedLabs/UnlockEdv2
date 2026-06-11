import { ChevronDown, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { LEARNING_RECORD_BUTTON_SIZE } from './learningRecordButtons';

interface AddAchievementRowProps {
    onAdd: () => void;
}

export function AddAchievementRow({ onAdd }: AddAchievementRowProps) {
    return (
        <Button
            type="button"
            variant="outline"
            size={LEARNING_RECORD_BUTTON_SIZE}
            data-slot="add-achievement-row"
            onClick={onAdd}
            className={cn(
                'h-10 w-full justify-start gap-3 rounded-lg border-dashed bg-transparent px-3 text-left font-normal text-foreground hover:bg-muted/30'
            )}
        >
            <span
                className="flex size-8 shrink-0 items-center justify-center rounded-full border border-dashed border-border text-muted-foreground"
                aria-hidden
            >
                <Plus className="size-4" />
            </span>
            <span className="min-w-0 flex-1 font-medium">Add another achievement</span>
            <ChevronDown className="size-5 shrink-0 text-muted-foreground" aria-hidden />
        </Button>
    );
}
