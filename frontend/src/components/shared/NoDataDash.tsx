import { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

// The em dash's font metrics sit well above the baseline that adjacent
// digit/percentage text renders on, so a bare "—" looks visibly misaligned
// next to a real value. translate-y-[35%] nudges it down to the baseline;
// the offset is a percentage of the glyph's own box, so it holds across
// font sizes (verified from text-sm table cells to text-3xl stat cards).
export function NoDataDash({
    className,
    ...props
}: HTMLAttributes<HTMLSpanElement>) {
    return (
        <span
            className={cn('inline-block translate-y-[35%]', className)}
            {...props}
        >
            —
        </span>
    );
}
