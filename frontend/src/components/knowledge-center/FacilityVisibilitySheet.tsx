import { useState } from 'react';
import useSWR from 'swr';
import { toast } from 'sonner';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetFooter,
    SheetHeader,
    SheetTitle
} from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ContentFacilityVisibility, ServerResponseOne } from '@/types';
import API from '@/api/api';
import { decodeHtmlEntities } from '@/lib/decodeHtmlEntities';

export interface ManagedContent {
    title: string;
    endpoint: string;
}

interface FacilityVisibilitySheetProps {
    content: ManagedContent | null;
    onClose: () => void;
    onChanged: () => void;
}

function FacilityRow({
    row,
    onToggle
}: {
    row: ContentFacilityVisibility;
    onToggle: (facilityId: number, visible: boolean) => void;
}) {
    return (
        <div className="flex items-center justify-between py-2">
            <span className="text-sm">{row.facility_name}</span>
            <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                    {row.visibility_status ? 'Visible' : 'Hidden'}
                </span>
                <Switch
                    checked={row.visibility_status}
                    onCheckedChange={(checked) =>
                        onToggle(row.facility_id, checked)
                    }
                    aria-label={`Visibility for ${row.facility_name}`}
                    className="data-[state=checked]:bg-brand"
                />
            </div>
        </div>
    );
}

export default function FacilityVisibilitySheet({
    content,
    onClose,
    onChanged
}: FacilityVisibilitySheetProps) {
    const [filter, setFilter] = useState('');
    const { data, mutate, isLoading } = useSWR<
        ServerResponseOne<ContentFacilityVisibility[]>
    >(content ? `/api/${content.endpoint}` : null);
    const rows = data?.data ?? [];
    const visibleRows = rows.filter((r) => r.visibility_status);
    const hiddenRows = rows.filter((r) => !r.visibility_status);
    const matchesFilter = (r: ContentFacilityVisibility) =>
        r.facility_name.toLowerCase().includes(filter.trim().toLowerCase());

    const setVisibility = async (facilityIds: number[], visible: boolean) => {
        if (!content || facilityIds.length === 0) return;
        const resp = await API.put<null, object>(content.endpoint, {
            facility_ids: facilityIds,
            visibility_status: visible
        });
        if (resp.success) {
            void mutate();
            onChanged();
        } else {
            toast.error('Failed to update facility visibility');
        }
    };

    const handleToggle = (facilityId: number, visible: boolean) =>
        void setVisibility([facilityId], visible);

    const groups = [
        { label: 'Visible', items: visibleRows.filter(matchesFilter) },
        { label: 'Hidden', items: hiddenRows.filter(matchesFilter) }
    ];

    return (
        <Sheet open={!!content} onOpenChange={(open) => !open && onClose()}>
            <SheetContent className="w-100 sm:w-125 sm:max-w-md flex flex-col gap-4 p-6 overflow-y-auto">
                <SheetHeader className="p-0 text-left">
                    <SheetTitle>
                        {content ? decodeHtmlEntities(content.title) : ''}
                    </SheetTitle>
                    <SheetDescription>
                        Choose which facilities can show this content to
                        residents.
                    </SheetDescription>
                </SheetHeader>
                <div className="space-y-2">
                    <p className="text-sm font-medium">
                        {isLoading
                            ? 'Loading facilities...'
                            : visibleRows.length === 0
                              ? 'Hidden at all facilities'
                              : `Visible at ${visibleRows.length} of ${rows.length} facilities`}
                    </p>
                    <Progress
                        value={
                            rows.length
                                ? (visibleRows.length / rows.length) * 100
                                : 0
                        }
                        indicatorClassName="bg-brand"
                    />
                </div>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() =>
                            void setVisibility(
                                rows.map((r) => r.facility_id),
                                true
                            )
                        }
                    >
                        Show at all
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() =>
                            void setVisibility(
                                rows.map((r) => r.facility_id),
                                false
                            )
                        }
                    >
                        Hide at all
                    </Button>
                </div>
                <Input
                    placeholder="Filter facilities..."
                    aria-label="Filter facilities"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                />
                <div className="flex-1 space-y-4">
                    {groups.map(
                        (group) =>
                            group.items.length > 0 && (
                                <div key={group.label}>
                                    <p className="text-xs font-medium uppercase text-muted-foreground mb-1">
                                        {group.label} ({group.items.length})
                                    </p>
                                    <div className="divide-y divide-border">
                                        {group.items.map((row) => (
                                            <FacilityRow
                                                key={row.facility_id}
                                                row={row}
                                                onToggle={handleToggle}
                                            />
                                        ))}
                                    </div>
                                </div>
                            )
                    )}
                </div>
                <SheetFooter className="flex-row items-center justify-between p-0">
                    <span className="text-xs text-muted-foreground">
                        Changes are saved automatically
                    </span>
                    <Button variant="brand" size="sm" onClick={onClose}>
                        Done
                    </Button>
                </SheetFooter>
            </SheetContent>
        </Sheet>
    );
}
