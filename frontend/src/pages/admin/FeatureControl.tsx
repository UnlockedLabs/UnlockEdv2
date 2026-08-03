import { useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import { toast } from 'sonner';
import { AlertCircle, Search } from 'lucide-react';
import { useAuth, fetchUser } from '@/auth/useAuth';
import {
    FeatureAccess,
    FacilityFeatureOverviewRow,
    FacilityFeatureDetailRow,
    ServerResponseMany
} from '@/types';
import API from '@/api/api';
import { PageHeader } from '@/components/shared/PageHeader';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectSeparator,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

// The 4 features shown as their own card/pill. Order drives both the list-panel
// pills and the detail-panel cards.
const TOP_LEVEL_FEATURES = [
    FeatureAccess.OpenContentAccess,
    FeatureAccess.ProviderAccess,
    FeatureAccess.ProgramAccess,
    FeatureAccess.LearningRecordAccess
];

const FEATURE_LABELS: Partial<Record<FeatureAccess, string>> = {
    [FeatureAccess.OpenContentAccess]: 'Knowledge Center',
    [FeatureAccess.ProviderAccess]: 'Learning Platforms',
    [FeatureAccess.ProgramAccess]: 'Programs',
    [FeatureAccess.LearningRecordAccess]: 'Learning Record'
};

const FEATURE_CARDS: {
    feature: FeatureAccess;
    title: string;
    description: string;
}[] = [
    {
        feature: FeatureAccess.OpenContentAccess,
        title: 'Knowledge Center',
        description:
            'Provides educational content, videos, and resources for residents'
    },
    {
        feature: FeatureAccess.ProviderAccess,
        title: 'Learning Platforms',
        description:
            'Enables access to third-party provider platforms and courses'
    },
    {
        feature: FeatureAccess.ProgramAccess,
        title: 'Program Hub & Tracking',
        description:
            'Enables program management, class scheduling, attendance tracking, and resident enrollment functionality'
    },
    {
        feature: FeatureAccess.LearningRecordAccess,
        title: 'Learning Record',
        description:
            'Allows residents to log and track their learning achievements and generate a personal learning record'
    }
];

const SUB_FEATURES: {
    feature: FeatureAccess;
    label: string;
    description: string;
}[] = [
    {
        feature: FeatureAccess.RequestContentAccess,
        label: 'Request Content Button',
        description:
            'Allows residents to submit requests for new content to be added to the Knowledge Center'
    },
    {
        feature: FeatureAccess.HelpfulLinksAccess,
        label: 'Helpful Links',
        description:
            'Enables the Helpful Links tab for residents and allows admins to add/manage helpful resources'
    },
    {
        feature: FeatureAccess.UploadVideoAccess,
        label: 'Videos',
        description:
            'Enables video content viewing for residents and allows admins to upload/manage videos'
    }
];

type FilterValue = 'all' | `${FeatureAccess}:true` | `${FeatureAccess}:false`;

function overviewUrl(search: string, filter: FilterValue): string {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (filter !== 'all') {
        const [feature, enabled] = filter.split(':');
        params.set('feature', feature);
        params.set('enabled', enabled);
    }
    const qs = params.toString();
    return `/api/facilities/features${qs ? `?${qs}` : ''}`;
}

function onCount(row: FacilityFeatureOverviewRow): number {
    return TOP_LEVEL_FEATURES.filter((f) => row.features[f]).length;
}

function FeaturePill({ feature, on }: { feature: FeatureAccess; on: boolean }) {
    return (
        <span
            className={cn(
                'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap',
                on
                    ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-400 dark:border-green-800'
                    : 'bg-muted text-muted-foreground border-border'
            )}
        >
            {FEATURE_LABELS[feature]}
        </span>
    );
}

export default function FeatureControl() {
    const { user, setUser } = useAuth();
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState<FilterValue>('all');
    const [selectedFacilityId, setSelectedFacilityId] = useState<number | null>(
        null
    );
    const [confirmApplyAll, setConfirmApplyAll] = useState(false);
    const [applying, setApplying] = useState(false);

    const { data: overviewResp, mutate: mutateOverview } = useSWR<
        ServerResponseMany<FacilityFeatureOverviewRow>
    >(overviewUrl(search, filter));
    const rows = useMemo(() => overviewResp?.data ?? [], [overviewResp]);

    const { data: detailResp, mutate: mutateDetail } = useSWR<
        ServerResponseMany<FacilityFeatureDetailRow>
    >(
        selectedFacilityId
            ? `/api/facilities/${selectedFacilityId}/features`
            : null
    );
    const detailRows = detailResp?.data ?? [];
    const isEnabled = (feature: FeatureAccess) =>
        detailRows.find((r) => r.feature === feature)?.enabled ?? false;

    // Default to the acting admin's own facility once the list loads.
    useEffect(() => {
        if (selectedFacilityId !== null || rows.length === 0) return;
        const home = user
            ? rows.find((r) => r.facility_id === user.facility_id)
            : undefined;
        setSelectedFacilityId((home ?? rows[0]).facility_id);
    }, [rows, selectedFacilityId, user]);

    const selectedFacility = useMemo(
        () => rows.find((r) => r.facility_id === selectedFacilityId) ?? null,
        [rows, selectedFacilityId]
    );

    if (!user) return null;

    const kcEnabled = isEnabled(FeatureAccess.OpenContentAccess);

    async function refreshOwnClaimsIfAffected(facilityId: number) {
        if (user?.facility_id === facilityId) {
            const updated = await fetchUser();
            if (updated) setUser(updated);
        }
    }

    async function handleToggle(feature: FeatureAccess, currentValue: boolean) {
        if (!selectedFacilityId) return;
        const label =
            FEATURE_LABELS[feature] ??
            SUB_FEATURES.find((s) => s.feature === feature)?.label ??
            feature;
        const resp = await API.put<string, { enabled: boolean }>(
            `facilities/${selectedFacilityId}/features/${feature}`,
            { enabled: !currentValue }
        );
        if (!resp.success) {
            toast.error(resp.message || `Failed to update ${label}`);
            return;
        }
        toast.success(`${label} ${!currentValue ? 'enabled' : 'disabled'}`);
        await mutateDetail();
        await mutateOverview();
        await refreshOwnClaimsIfAffected(selectedFacilityId);
    }

    async function handleApplyAll() {
        if (!selectedFacilityId) return;
        setApplying(true);
        const resp = await API.put<string, { source_facility_id: number }>(
            'facilities/features/apply-all',
            { source_facility_id: selectedFacilityId }
        );
        setApplying(false);
        if (!resp.success) {
            toast.error(resp.message || 'Failed to apply settings');
            return;
        }
        toast.success(
            `${selectedFacility?.facility_name ?? 'This facility'}'s settings were applied to all facilities`
        );
        setConfirmApplyAll(false);
        await mutateOverview();
        await mutateDetail();
        const updated = await fetchUser();
        if (updated) setUser(updated);
    }

    return (
        <div className="p-6 space-y-6">
            <PageHeader
                title="Feature Control"
                subtitle="Turn features on or off for each facility"
            />

            <div className="flex items-start gap-6">
                {/* Left: search + filter + facility list */}
                <div className="w-80 shrink-0 overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-[#262626] dark:bg-[#171717]">
                    <div className="space-y-2 border-b border-gray-100 p-3 dark:border-[#262626]">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
                            <Input
                                placeholder="Search facilities..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="h-8 pl-8 text-sm"
                            />
                        </div>
                        <Select
                            value={filter}
                            onValueChange={(v) => setFilter(v as FilterValue)}
                        >
                            <SelectTrigger className="h-8 text-sm">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">
                                    All facilities
                                </SelectItem>
                                {TOP_LEVEL_FEATURES.map((feature) => (
                                    <SelectGroup key={feature}>
                                        <SelectSeparator />
                                        <SelectLabel>
                                            {FEATURE_LABELS[feature]}
                                        </SelectLabel>
                                        <SelectItem
                                            value={
                                                `${feature}:true` as FilterValue
                                            }
                                        >
                                            {FEATURE_LABELS[feature]}: On
                                        </SelectItem>
                                        <SelectItem
                                            value={
                                                `${feature}:false` as FilterValue
                                            }
                                        >
                                            {FEATURE_LABELS[feature]}: Off
                                        </SelectItem>
                                    </SelectGroup>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="max-h-[calc(100vh-20rem)] overflow-y-auto p-2">
                        {rows.length === 0 ? (
                            <p className="px-2 py-3 text-xs text-gray-400">
                                No facilities found
                            </p>
                        ) : (
                            rows.map((row) => {
                                const active =
                                    row.facility_id === selectedFacilityId;
                                return (
                                    <button
                                        key={row.facility_id}
                                        type="button"
                                        onClick={() =>
                                            setSelectedFacilityId(
                                                row.facility_id
                                            )
                                        }
                                        className={cn(
                                            'mb-1 w-full rounded-md px-3 py-2 text-left transition-colors',
                                            active
                                                ? 'border border-brand bg-brand/5'
                                                : 'border border-transparent hover:bg-gray-50 dark:hover:bg-[#262626]'
                                        )}
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm font-medium text-brand-dark dark:text-white">
                                                {row.facility_name}
                                            </span>
                                            <span className="text-xs text-gray-500 dark:text-gray-400">
                                                {onCount(row)} of{' '}
                                                {TOP_LEVEL_FEATURES.length} on
                                            </span>
                                        </div>
                                        <div className="mt-1.5 flex flex-wrap gap-1">
                                            {TOP_LEVEL_FEATURES.map((f) => (
                                                <FeaturePill
                                                    key={f}
                                                    feature={f}
                                                    on={!!row.features[f]}
                                                />
                                            ))}
                                        </div>
                                    </button>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* Right: selected facility's feature cards */}
                <div className="min-w-0 flex-1 space-y-4">
                    {selectedFacility ? (
                        <>
                            <div className="flex items-start justify-between">
                                <div>
                                    <h2 className="text-brand-dark dark:text-white">
                                        {selectedFacility.facility_name}
                                    </h2>
                                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                        Changes apply to this facility only
                                    </p>
                                </div>
                                <Button
                                    variant="outline"
                                    onClick={() => setConfirmApplyAll(true)}
                                >
                                    Apply these settings to all facilities
                                </Button>
                            </div>

                            <div className="space-y-4">
                                {FEATURE_CARDS.map((card) => {
                                    const enabled = isEnabled(card.feature);
                                    return (
                                        <div
                                            key={card.feature}
                                            className="bg-background border border-border rounded-lg p-6"
                                        >
                                            <div className="flex items-start justify-between mb-3">
                                                <div className="flex-1">
                                                    <h3 className="text-lg font-semibold text-brand-dark dark:text-white">
                                                        {card.title}
                                                    </h3>
                                                    <p className="text-sm text-muted-foreground mt-1">
                                                        {card.description}
                                                    </p>
                                                </div>
                                                <Switch
                                                    checked={enabled}
                                                    onCheckedChange={() =>
                                                        void handleToggle(
                                                            card.feature,
                                                            enabled
                                                        )
                                                    }
                                                />
                                            </div>

                                            {card.feature ===
                                                FeatureAccess.OpenContentAccess && (
                                                <div className="mt-4 bg-surface-hover rounded-md p-4">
                                                    <div className="flex items-start gap-2 mb-4 text-sm text-muted-foreground">
                                                        <AlertCircle className="size-4 shrink-0" />
                                                        <span>
                                                            Sub-features (only
                                                            available when
                                                            Knowledge Center is
                                                            enabled)
                                                        </span>
                                                    </div>
                                                    <div className="space-y-4">
                                                        {SUB_FEATURES.map(
                                                            (sub) => {
                                                                const subEnabled =
                                                                    isEnabled(
                                                                        sub.feature
                                                                    );
                                                                return (
                                                                    <div
                                                                        key={
                                                                            sub.feature
                                                                        }
                                                                        className={cn(
                                                                            'flex items-start justify-between',
                                                                            !kcEnabled &&
                                                                                'opacity-50'
                                                                        )}
                                                                    >
                                                                        <div className="flex-1 pr-4">
                                                                            <h4 className="text-sm font-medium text-brand-dark dark:text-white">
                                                                                {
                                                                                    sub.label
                                                                                }
                                                                            </h4>
                                                                            <p className="text-xs text-muted-foreground mt-1">
                                                                                {
                                                                                    sub.description
                                                                                }
                                                                            </p>
                                                                        </div>
                                                                        <Switch
                                                                            checked={
                                                                                subEnabled
                                                                            }
                                                                            disabled={
                                                                                !kcEnabled
                                                                            }
                                                                            onCheckedChange={() =>
                                                                                void handleToggle(
                                                                                    sub.feature,
                                                                                    subEnabled
                                                                                )
                                                                            }
                                                                        />
                                                                    </div>
                                                                );
                                                            }
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    ) : (
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            Select a facility to manage its features.
                        </p>
                    )}
                </div>
            </div>

            <Dialog open={confirmApplyAll} onOpenChange={setConfirmApplyAll}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Apply to all facilities?</DialogTitle>
                        <DialogDescription>
                            This will overwrite every other facility&apos;s
                            feature settings — including sub-features — with{' '}
                            {selectedFacility?.facility_name ?? 'this facility'}
                            &apos;s current settings. This cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setConfirmApplyAll(false)}
                            disabled={applying}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={() => void handleApplyAll()}
                            disabled={applying}
                            className="bg-brand hover:bg-brand-dark text-white"
                        >
                            {applying ? 'Applying…' : 'Apply to All Facilities'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
