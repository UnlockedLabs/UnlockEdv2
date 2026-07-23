import { Fragment, useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import { toast } from 'sonner';
import { AlertCircle, Building2 } from 'lucide-react';
import API from '@/api/api';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/shared/PageHeader';
import { SearchInput } from '@/components/shared/SearchInput';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog';
import {
    FacilityFeatureDetail,
    FacilityFeatureDetailItem,
    FacilityFeatureStatus,
    FeatureAccess,
    ServerResponseMany,
    ServerResponseOne
} from '@/types';

interface SubFeatureConfig {
    key: FeatureAccess;
    label: string;
    description: string;
}

interface FeatureConfigEntry {
    key: FeatureAccess;
    label: string;
    pill: string;
    description: string;
    subs?: SubFeatureConfig[];
}

const FEATURE_CONFIG: FeatureConfigEntry[] = [
    {
        key: FeatureAccess.OpenContentAccess,
        label: 'Knowledge Center',
        pill: 'Knowledge Center',
        description:
            'Provides educational content, videos, and resources for residents',
        subs: [
            {
                key: FeatureAccess.RequestContentAccess,
                label: 'Request Content Button',
                description:
                    'Allows residents to submit requests for new content to be added to the Knowledge Center'
            },
            {
                key: FeatureAccess.HelpfulLinksAccess,
                label: 'Helpful Links',
                description:
                    'Enables the Helpful Links tab for residents and allows admins to add/manage helpful resources'
            },
            {
                key: FeatureAccess.UploadVideoAccess,
                label: 'Videos',
                description:
                    'Enables video content viewing for residents and allows admins to upload/manage videos'
            }
        ]
    },
    {
        key: FeatureAccess.ProviderAccess,
        label: 'Learning Platforms',
        pill: 'Learning Platforms',
        description:
            'Enables the Learning Platforms area for connecting and managing external provider platforms at this facility'
    },
    {
        key: FeatureAccess.ProgramAccess,
        label: 'Program Hub & Tracking',
        pill: 'Programs',
        description:
            'Enables program management, class scheduling, attendance tracking, and resident enrollment functionality'
    },
    {
        key: FeatureAccess.LearningRecordAccess,
        label: 'Learning Record',
        pill: 'Learning Record',
        description:
            'Allows residents to log and track their learning achievements and generate a personal learning record'
    }
];

const PILL_LABELS: Partial<Record<FeatureAccess, string>> = Object.fromEntries(
    FEATURE_CONFIG.map((fc) => [fc.key, fc.pill])
);

interface FeatureFilter {
    feature: FeatureAccess;
    enabled: boolean;
}

export default function FacilityFeatureControl() {
    const [searchQuery, setSearchQuery] = useState('');
    const [filter, setFilter] = useState<FeatureFilter | null>(null);
    const [filterValue, setFilterValue] = useState('all');
    const [selectedFacilityId, setSelectedFacilityId] = useState<number | null>(
        null
    );
    const [applyAllOpen, setApplyAllOpen] = useState(false);
    const [applyLoading, setApplyLoading] = useState(false);

    const listKey = filter
        ? `/api/facilities/features?per_page=1000&feature=${filter.feature}&enabled=${filter.enabled}`
        : '/api/facilities/features?per_page=1000';
    const { data: listResp, mutate: mutateList } =
        useSWR<ServerResponseMany<FacilityFeatureStatus>>(listKey);
    const facilities = useMemo(() => listResp?.data ?? [], [listResp]);

    const { data: detailResp, mutate: mutateDetail } = useSWR<
        ServerResponseOne<FacilityFeatureDetail>
    >(
        selectedFacilityId
            ? `/api/facilities/${selectedFacilityId}/features`
            : null
    );
    const detail = detailResp?.data;

    useEffect(() => {
        if (selectedFacilityId === null && facilities.length > 0) {
            setSelectedFacilityId(facilities[0].facility_id);
        }
    }, [facilities, selectedFacilityId]);

    const normalizedQuery = searchQuery.trim().toLowerCase();
    const filteredFacilities = normalizedQuery
        ? facilities.filter((f) =>
              f.facility_name.toLowerCase().includes(normalizedQuery)
          )
        : facilities;

    const featureOptions = useMemo(() => {
        const present = new Set(
            facilities[0]?.features.map((f) => f.feature) ?? []
        );
        return FEATURE_CONFIG.filter((fc) => present.has(fc.key));
    }, [facilities]);

    function handleFilterChange(value: string) {
        setFilterValue(value);
        if (value === 'all') {
            setFilter(null);
            return;
        }
        const [feature, enabledStr] = value.split(':');
        setFilter({
            feature: feature as FeatureAccess,
            enabled: enabledStr === 'true'
        });
    }

    async function handleToggle(
        featureKey: FeatureAccess,
        label: string,
        currentValue: boolean
    ) {
        if (!selectedFacilityId) return;
        const newValue = !currentValue;
        const resp = await API.put<string, { enabled: boolean }>(
            `facilities/${selectedFacilityId}/features/${featureKey}`,
            { enabled: newValue }
        );
        if (!resp.success) {
            toast.error(resp.message);
            return;
        }
        await Promise.all([mutateList(), mutateDetail()]);
        toast.success(`${label} ${newValue ? 'enabled' : 'disabled'}`);
    }

    async function handleApplyAll() {
        if (!selectedFacilityId) return;
        setApplyLoading(true);
        try {
            const resp = await API.put<string, { source_facility_id: number }>(
                'facilities/features/apply-all',
                { source_facility_id: selectedFacilityId }
            );
            if (!resp.success) {
                toast.error(resp.message);
                return;
            }
            await Promise.all([mutateList(), mutateDetail()]);
            toast.success('Settings applied to all facilities');
            setApplyAllOpen(false);
        } finally {
            setApplyLoading(false);
        }
    }

    return (
        <div className="p-6 space-y-6">
            <PageHeader
                title="Facility Features"
                subtitle="Turn features on or off for each facility"
            />

            <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6 items-start">
                {/* Left panel — master list */}
                <div className="card-block p-4 space-y-4">
                    <SearchInput
                        value={searchQuery}
                        onChange={setSearchQuery}
                        placeholder="Search facilities..."
                    />

                    <Select
                        value={filterValue}
                        onValueChange={handleFilterChange}
                    >
                        <SelectTrigger className="w-full h-9 text-sm">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All facilities</SelectItem>
                            {featureOptions.map((fc) => (
                                <Fragment key={fc.key}>
                                    <SelectItem value={`${fc.key}:true`}>
                                        {fc.pill}: On
                                    </SelectItem>
                                    <SelectItem value={`${fc.key}:false`}>
                                        {fc.pill}: Off
                                    </SelectItem>
                                </Fragment>
                            ))}
                        </SelectContent>
                    </Select>

                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-1">
                        Facilities — {filteredFacilities.length} shown
                    </p>

                    <div className="space-y-2">
                        {filteredFacilities.map((facility) => (
                            <button
                                key={facility.facility_id}
                                onClick={() =>
                                    setSelectedFacilityId(facility.facility_id)
                                }
                                className={cn(
                                    'w-full text-left rounded-lg border p-4 transition-colors',
                                    selectedFacilityId === facility.facility_id
                                        ? 'border-brand-gold bg-brand-gold/10'
                                        : 'border-border bg-background hover:bg-accent'
                                )}
                            >
                                <div className="flex items-center justify-between mb-2 gap-2">
                                    <span className="font-semibold text-brand-dark dark:text-white">
                                        {facility.facility_name}
                                    </span>
                                    <span className="text-sm text-muted-foreground whitespace-nowrap">
                                        {facility.enabled_count} of{' '}
                                        {facility.total_count} on
                                    </span>
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                    {facility.features.map((ft) => (
                                        <FeaturePill
                                            key={ft.feature}
                                            label={
                                                PILL_LABELS[ft.feature] ??
                                                ft.feature
                                            }
                                            enabled={ft.enabled}
                                        />
                                    ))}
                                </div>
                            </button>
                        ))}
                        {filteredFacilities.length === 0 && (
                            <p className="text-sm text-muted-foreground italic px-1">
                                No facilities found
                            </p>
                        )}
                    </div>
                </div>

                {/* Right panel — detail (single white card) */}
                <div className="card-block p-6">
                    {detail && (
                        <div className="flex items-center justify-between gap-4 pb-4 mb-2 border-b border-gray-200">
                            <div>
                                <h2 className="text-lg font-semibold text-brand-dark dark:text-white">
                                    {detail.facility_name}
                                </h2>
                                <p className="text-sm text-muted-foreground mt-1">
                                    Changes apply to this facility only
                                </p>
                            </div>
                            <Button
                                variant="outline"
                                onClick={() => setApplyAllOpen(true)}
                                className="gap-2"
                            >
                                <Building2 className="size-4" />
                                Apply these settings to all facilities
                            </Button>
                        </div>
                    )}

                    <div className="divide-y divide-gray-200">
                        {FEATURE_CONFIG.map((config) => {
                            const item = detail?.features.find(
                                (it) => it.feature === config.key
                            );
                            if (!item) return null;
                            return (
                                <FeatureCard
                                    key={config.key}
                                    config={config}
                                    item={item}
                                    onToggle={handleToggle}
                                />
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Apply-to-all confirmation dialog */}
            <Dialog
                open={applyAllOpen}
                onOpenChange={(open) => !applyLoading && setApplyAllOpen(open)}
            >
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>
                            Apply settings to all facilities?
                        </DialogTitle>
                        <DialogDescription>
                            This will copy {detail?.facility_name ?? 'this'}
                            &rsquo;s current feature settings to every other
                            facility immediately.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-md p-3 flex gap-2">
                        <AlertCircle className="size-4 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
                        <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                            This affects every other facility statewide.
                        </p>
                    </div>

                    <div className="flex gap-3 justify-end pt-2">
                        <Button
                            variant="outline"
                            onClick={() => setApplyAllOpen(false)}
                            disabled={applyLoading}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={() => void handleApplyAll()}
                            disabled={applyLoading}
                            className="bg-brand hover:bg-brand-dark text-white"
                        >
                            Apply to All Facilities
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}

function FeaturePill({ label, enabled }: { label: string; enabled: boolean }) {
    return (
        <span
            className={cn(
                'inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full',
                enabled
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-700'
            )}
        >
            {label}
        </span>
    );
}

interface FeatureCardProps {
    config: FeatureConfigEntry;
    item: FacilityFeatureDetailItem;
    onToggle: (
        featureKey: FeatureAccess,
        label: string,
        currentValue: boolean
    ) => void | Promise<void>;
}

function FeatureCard({ config, item, onToggle }: FeatureCardProps) {
    return (
        <div className="py-6 first:pt-2">
            <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                    <h3 className="text-lg font-semibold text-brand-dark dark:text-white">
                        {config.label}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                        {config.description}
                    </p>
                </div>
                <Switch
                    checked={item.enabled}
                    disabled={!item.globally_enabled}
                    className={cn(!item.globally_enabled && 'opacity-50')}
                    onCheckedChange={() =>
                        void onToggle(config.key, config.label, item.enabled)
                    }
                />
            </div>

            {config.subs ? (
                <div className="mt-4 bg-surface-hover rounded-md p-4">
                    <div className="flex items-start gap-2 mb-4 text-sm text-muted-foreground">
                        <AlertCircle className="size-4 shrink-0" />
                        <span>
                            Sub-features (only available when {config.label} is
                            enabled)
                        </span>
                    </div>

                    <div className="space-y-4">
                        {config.subs.map((sub) => {
                            const subItem = item.page_features?.find(
                                (p) => p.feature === sub.key
                            );
                            if (!subItem) return null;
                            return (
                                <SubFeatureRow
                                    key={sub.key}
                                    label={sub.label}
                                    description={sub.description}
                                    enabled={subItem.enabled}
                                    parentEnabled={item.enabled}
                                    globallyEnabled={subItem.globally_enabled}
                                    onToggle={() =>
                                        void onToggle(
                                            sub.key,
                                            sub.label,
                                            subItem.enabled
                                        )
                                    }
                                />
                            );
                        })}
                    </div>
                </div>
            ) : (
                <p className="text-sm text-muted-foreground italic">
                    No additional configuration options
                </p>
            )}
        </div>
    );
}

interface SubFeatureRowProps {
    label: string;
    description: string;
    enabled: boolean;
    parentEnabled: boolean;
    globallyEnabled: boolean;
    onToggle: () => void;
}

function SubFeatureRow({
    label,
    description,
    enabled,
    parentEnabled,
    globallyEnabled,
    onToggle
}: SubFeatureRowProps) {
    const disabled = !parentEnabled || !globallyEnabled;
    return (
        <div
            className={cn(
                'flex items-start justify-between',
                disabled && 'opacity-50'
            )}
        >
            <div className="flex-1 pr-4">
                <h4 className="text-sm font-medium text-brand-dark dark:text-white">
                    {label}
                </h4>
                <p className="text-xs text-muted-foreground mt-1">
                    {description}
                </p>
            </div>
            <Switch
                checked={enabled}
                onCheckedChange={onToggle}
                disabled={disabled}
            />
        </div>
    );
}
