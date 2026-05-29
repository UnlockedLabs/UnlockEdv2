/** 40px — standard height for Learning Record actions (`Button` `size="lg"`). */
export const LEARNING_RECORD_BUTTON_SIZE = 'lg' as const;

export const learningRecordPrimaryButtonClassName =
    'h-10 bg-[#556830] text-white shadow-sm hover:bg-[#203622]';

export const learningRecordOutlineButtonClassName = 'h-10 gap-1.5 bg-background';

/** Muted moss selected state for tag chips (dark text on light fill). */
export const learningRecordSelectedChoiceClassName =
    'border border-[#556830] bg-[#556830]/15 font-medium text-foreground';

/** Same as above, scoped to ToggleGroup `data-[state=on]`. */
export const learningRecordSelectedToggleClassName =
    'data-[state=on]:border-[#556830] data-[state=on]:bg-[#556830]/15 data-[state=on]:font-medium data-[state=on]:text-foreground data-[state=on]:hover:bg-[#556830]/20';

export const learningRecordCheckedCheckboxClassName =
    'data-[state=checked]:border-[#556830] data-[state=checked]:bg-[#556830] data-[state=checked]:text-white';

/** Label + optional description block above a form control. */
export const learningRecordQuestionHeaderClassName = 'flex flex-col gap-0 pb-3';

export const learningRecordIconButtonClassName = 'size-10 shrink-0';
