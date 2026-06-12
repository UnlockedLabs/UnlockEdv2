import {
    ReactNode,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState
} from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import useSWR from 'swr';
import {
    ProviderPlatform,
    ProviderPlatformType,
    ProviderUser,
    User,
    UserImports,
    ServerResponseMany,
    ServerResponseOne,
    MatchUsersResponse,
    ConfirmedMatch,
    ApplyMatchesRequest,
    ApplyMatchesResponse,
    UserMatchResult
} from '@/types';
import API from '@/api/api';
import { FormModal } from '@/components/shared/FormModal';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { SearchInput } from '@/components/shared/SearchInput';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger
} from '@/components/ui/collapsible';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@/components/ui/table';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
    ArrowPathIcon,
    ChevronLeftIcon,
    LinkSlashIcon
} from '@heroicons/react/24/outline';
import {
    AlertTriangle,
    CheckCircle2,
    ChevronDown,
    ChevronUp,
    Undo2,
    UserX,
    Users,
    Upload,
    X
} from 'lucide-react';

type PendingLinkSource = 'auto' | 'review' | 'create';

interface PendingLinkEntry {
    externalUserId: string;
    canvasUser: ProviderUser;
    residentId?: number;
    residentName: string;
    residentUsername: string;
    source: PendingLinkSource;
    /** False once persisted via map-user or apply-matches */
    isPendingApply: boolean;
}

interface LinkedResidentEntry {
    key: string;
    externalUserId?: string;
    canvasLabel: string;
    residentName: string;
    residentUsername: string;
    isPending: boolean;
    mappedUser?: User;
}

interface ReconciliationOverrides {
    demotedFromAuto: ProviderUser[];
    demotedFromReview: ProviderUser[];
    ambiguousSelections: Record<string, number>;
    reviewResidentLabels: Record<
        string,
        Pick<User, 'id' | 'name_first' | 'name_last' | 'username'>
    >;
    unmatchedToCreate: Set<string>;
}

interface DerivedReconciliation {
    autoRows: UserMatchResult[];
    reviewRows: UserMatchResult[];
    unmatchedRows: ProviderUser[];
    pendingLinks: PendingLinkEntry[];
    linkedEntries: LinkedResidentEntry[];
    totalCanvasUsers: number;
    autoCount: number;
    reviewCount: number;
    outstandingUnmatchedCount: number;
    linkedCount: number;
    resolvedCount: number;
    resolvedReviewCount: number;
    progressGreenCount: number;
    progressAmberCount: number;
}

function canvasLabel(user: ProviderUser) {
    return `${user.name_first} ${user.name_last}`.trim();
}

function residentLabel(user: Pick<User, 'name_first' | 'name_last'>) {
    return `${user.name_first} ${user.name_last}`.trim();
}

function uniqueByExternalId(users: ProviderUser[]): ProviderUser[] {
    const seen = new Set<string>();
    return users.filter((u) => {
        if (seen.has(u.external_user_id)) return false;
        seen.add(u.external_user_id);
        return true;
    });
}

function deriveReconciliationState(
    matchState: MatchUsersResponse,
    mappedUsers: User[],
    overrides: ReconciliationOverrides
): DerivedReconciliation {
    const {
        demotedFromAuto,
        demotedFromReview,
        ambiguousSelections,
        reviewResidentLabels,
        unmatchedToCreate
    } = overrides;

    const demotedAutoIds = new Set(
        demotedFromAuto.map((u) => u.external_user_id)
    );
    const demotedReviewIds = new Set(
        demotedFromReview.map((u) => u.external_user_id)
    );
    const mappedUserIds = new Set(mappedUsers.map((u) => u.id));

    const autoRows = matchState.auto_confirmed.filter(
        (r) => !demotedAutoIds.has(r.canvas_user.external_user_id)
    );

    const reviewRows = matchState.ambiguous.filter((r) => {
        const externalId = r.canvas_user.external_user_id;
        return (
            ambiguousSelections[externalId] == null &&
            !demotedReviewIds.has(externalId)
        );
    });

    const apiUnmatchedIds = new Set(
        matchState.unmatched.map((u) => u.external_user_id)
    );
    const extraDemoted = [
        ...demotedFromAuto,
        ...demotedFromReview.filter(
            (u) => !apiUnmatchedIds.has(u.external_user_id)
        )
    ];
    const unmatchedRows = uniqueByExternalId([
        ...matchState.unmatched,
        ...extraDemoted
    ]);

    const pendingLinks: PendingLinkEntry[] = [];

    for (const row of autoRows) {
        if (!row.suggested_user) continue;
        pendingLinks.push({
            externalUserId: row.canvas_user.external_user_id,
            canvasUser: row.canvas_user,
            residentId: row.suggested_user.id,
            residentName: residentLabel(row.suggested_user),
            residentUsername: row.suggested_user.username,
            source: 'auto',
            isPendingApply: !mappedUserIds.has(row.suggested_user.id)
        });
    }

    for (const row of matchState.ambiguous) {
        const externalId = row.canvas_user.external_user_id;
        const selectedId = ambiguousSelections[externalId];
        if (selectedId == null) continue;

        const label = reviewResidentLabels[externalId];
        const fromSuggestion =
            row.suggested_user?.id === selectedId
                ? row.suggested_user
                : undefined;

        const residentName = label
            ? residentLabel(label)
            : fromSuggestion
              ? residentLabel(fromSuggestion)
              : 'Selected resident';
        const residentUsername =
            label?.username ?? fromSuggestion?.username ?? '—';

        pendingLinks.push({
            externalUserId: externalId,
            canvasUser: row.canvas_user,
            residentId: selectedId,
            residentName,
            residentUsername,
            source: 'review',
            isPendingApply: !mappedUserIds.has(selectedId)
        });
    }

    for (const externalId of unmatchedToCreate) {
        const canvasUser =
            unmatchedRows.find((u) => u.external_user_id === externalId) ??
            matchState.unmatched.find((u) => u.external_user_id === externalId);
        if (!canvasUser) continue;
        pendingLinks.push({
            externalUserId: externalId,
            canvasUser,
            residentName: 'New resident (queued)',
            residentUsername: canvasUser.username,
            source: 'create',
            isPendingApply: true
        });
    }

    const residentCanvasLabels = new Map<number, string>();
    for (const row of matchState.auto_confirmed) {
        if (row.suggested_user) {
            residentCanvasLabels.set(
                row.suggested_user.id,
                canvasLabel(row.canvas_user)
            );
        }
    }
    for (const row of matchState.ambiguous) {
        const externalId = row.canvas_user.external_user_id;
        const selectedId = ambiguousSelections[externalId];
        if (selectedId != null) {
            residentCanvasLabels.set(selectedId, canvasLabel(row.canvas_user));
        } else if (row.suggested_user) {
            residentCanvasLabels.set(
                row.suggested_user.id,
                canvasLabel(row.canvas_user)
            );
        }
    }

    const linkedEntries: LinkedResidentEntry[] = [];

    for (const user of mappedUsers) {
        linkedEntries.push({
            key: `mapped-${user.id}`,
            canvasLabel: residentCanvasLabels.get(user.id) ?? '—',
            residentName: residentLabel(user),
            residentUsername: user.username,
            isPending: false,
            mappedUser: user
        });
    }

    for (const link of pendingLinks) {
        if (link.residentId != null && mappedUserIds.has(link.residentId)) {
            continue;
        }
        linkedEntries.push({
            key: `pending-${link.externalUserId}`,
            externalUserId: link.externalUserId,
            canvasLabel: canvasLabel(link.canvasUser),
            residentName: link.residentName,
            residentUsername: link.residentUsername,
            isPending: link.isPendingApply
        });
    }

    const autoCount = autoRows.length;
    const reviewCount = reviewRows.length;
    const outstandingUnmatchedCount = unmatchedRows.filter(
        (u) => !unmatchedToCreate.has(u.external_user_id)
    ).length;
    const resolvedReviewCount = Object.keys(ambiguousSelections).length;
    const queuedCreateCount = unmatchedToCreate.size;
    const totalCanvasUsers =
        autoCount + reviewCount + unmatchedRows.length + resolvedReviewCount;

    const resolvedCount = autoCount + resolvedReviewCount + queuedCreateCount;

    return {
        autoRows,
        reviewRows,
        unmatchedRows,
        pendingLinks,
        linkedEntries,
        totalCanvasUsers,
        autoCount,
        reviewCount,
        outstandingUnmatchedCount,
        linkedCount: linkedEntries.length,
        resolvedCount,
        resolvedReviewCount,
        progressGreenCount: autoCount + queuedCreateCount,
        progressAmberCount: resolvedReviewCount
    };
}

type MatchSectionId = 'auto-confirmed' | 'needs-review' | 'unmatched';
type WorkflowTarget = MatchSectionId | 'apply';

const WORKFLOW_GUIDE_STEPS: {
    label: string;
    target: WorkflowTarget;
}[] = [
    {
        label: 'Review auto-matched pairs',
        target: 'auto-confirmed'
    },
    {
        label: 'Resolve ambiguous matches',
        target: 'needs-review'
    },
    {
        label: 'Handle unmatched users',
        target: 'unmatched'
    },
    {
        label: 'Apply your changes',
        target: 'apply'
    }
];

interface WorkflowGuideProps {
    onDismiss: () => void;
    onStepClick: (target: WorkflowTarget) => void;
}

function WorkflowGuide({ onDismiss, onStepClick }: WorkflowGuideProps) {
    return (
        <div className="rounded-lg border border-gray-200 bg-gray-50/80 p-4">
            <div className="mb-4 flex items-start justify-between gap-3">
                <p className="font-medium text-brand-dark">How this works</p>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 shrink-0 text-gray-600 hover:text-brand-dark"
                    onClick={onDismiss}
                    aria-label="Dismiss"
                >
                    <X className="size-4" />
                </Button>
            </div>
            <ol className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-4 sm:gap-y-2">
                {WORKFLOW_GUIDE_STEPS.map((step, index) => (
                    <li key={step.target} className="flex items-center">
                        <button
                            type="button"
                            onClick={() => onStepClick(step.target)}
                            className="group flex min-w-0 items-center gap-2 rounded-md text-left transition-colors hover:bg-white/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:px-1 sm:py-0.5"
                        >
                            <Badge
                                variant="outline"
                                className="flex size-6 shrink-0 items-center justify-center rounded-full border-gray-200 bg-white px-0 text-xs font-medium text-brand"
                            >
                                {index + 1}
                            </Badge>
                            <span className="text-sm text-gray-700 group-hover:text-brand-dark">
                                {step.label}
                            </span>
                        </button>
                    </li>
                ))}
            </ol>
        </div>
    );
}

function sessionKey(providerId: string | undefined, suffix: string) {
    return `provider-match-${suffix}-${providerId ?? 'unknown'}`;
}

function readSessionBool(key: string, fallback: boolean) {
    try {
        const value = sessionStorage.getItem(key);
        if (value === null) return fallback;
        return value === 'true';
    } catch {
        return fallback;
    }
}

function writeSessionBool(key: string, value: boolean) {
    try {
        sessionStorage.setItem(key, String(value));
    } catch {
        /* ignore */
    }
}

function formatCanvasUser(user: ProviderUser) {
    return `${user.name_first} ${user.name_last}`.trim();
}

function formatResident(user?: Pick<User, 'name_first' | 'name_last'>) {
    if (!user) return '—';
    return `${user.name_first} ${user.name_last}`.trim();
}

function highlightRowClass(
    externalUserId: string,
    highlightedIds: Set<string>
) {
    return cn(
        highlightedIds.has(externalUserId) &&
            'animate-in fade-in bg-brand/5 ring-2 ring-brand/20 duration-300'
    );
}

function formatSyncedAt(date: Date | null) {
    if (!date) return null;
    return date.toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short'
    });
}

type StatTileTone = 'green' | 'amber' | 'red';

const STAT_TILE_ICON_BG: Record<StatTileTone, string> = {
    green: 'bg-green-600',
    amber: 'bg-amber-500',
    red: 'bg-red-600'
};

const STAT_TILE_ICON: Record<StatTileTone, ReactNode> = {
    green: <CheckCircle2 className="size-5 text-white" />,
    amber: <AlertTriangle className="size-5 text-white" />,
    red: <UserX className="size-5 text-white" />
};

const STAT_TILE_PRIORITY: Record<StatTileTone, string> = {
    green: 'ring-2 ring-green-200 border-green-300',
    amber: 'ring-2 ring-amber-200 border-amber-300',
    red: 'ring-2 ring-red-200 border-red-300'
};

interface ReconciliationStatTileProps {
    tone: StatTileTone;
    label: string;
    count: number;
    isPriority: boolean;
    onClick: () => void;
    ariaLabel: string;
}

function ReconciliationStatTile({
    tone,
    label,
    count,
    isPriority,
    onClick,
    ariaLabel
}: ReconciliationStatTileProps) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-label={ariaLabel}
            className={cn(
                'bg-card flex w-full cursor-pointer items-start gap-4 rounded-lg border border-border p-5 text-left transition-colors',
                'hover:bg-accent/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                isPriority && STAT_TILE_PRIORITY[tone]
            )}
        >
            <div
                className={cn(
                    'shrink-0 rounded-lg p-2.5',
                    STAT_TILE_ICON_BG[tone]
                )}
            >
                {STAT_TILE_ICON[tone]}
            </div>
            <div className="min-w-0">
                <p className="text-sm text-muted-foreground">{label}</p>
                <p className="text-2xl font-semibold text-foreground">
                    {count}
                </p>
            </div>
        </button>
    );
}

interface ReconciliationProgressBarProps {
    total: number;
    resolved: number;
    greenCount: number;
    amberCount: number;
}

function ReconciliationProgressBar({
    total,
    resolved,
    greenCount,
    amberCount
}: ReconciliationProgressBarProps) {
    const resolvedPercent =
        total > 0 ? Math.round((resolved / total) * 100) : 0;

    const fillSegments = [
        { count: greenCount, className: 'bg-green-500', key: 'resolved-green' },
        { count: amberCount, className: 'bg-amber-500', key: 'resolved-amber' }
    ].filter((segment) => segment.count > 0);

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-gray-600">
                    {resolved} of {total} resolved
                </span>
                <span className="font-medium text-brand-dark">
                    {resolvedPercent}%
                </span>
            </div>
            <div
                className="flex h-2 overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={total}
                aria-valuenow={resolved}
                aria-label={`${resolvedPercent}% of Canvas users resolved`}
            >
                {fillSegments.map((segment) => (
                    <div
                        key={segment.key}
                        className={cn(
                            'h-full transition-all',
                            segment.className
                        )}
                        style={{
                            width: `${(segment.count / total) * 100}%`
                        }}
                    />
                ))}
            </div>
            {fillSegments.length > 0 ? (
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    {greenCount > 0 ? (
                        <span className="inline-flex items-center gap-1.5">
                            <span className="size-2 rounded-full bg-green-500" />
                            Auto-matched &amp; queued
                        </span>
                    ) : null}
                    {amberCount > 0 ? (
                        <span className="inline-flex items-center gap-1.5">
                            <span className="size-2 rounded-full bg-amber-500" />
                            Review decided
                        </span>
                    ) : null}
                </div>
            ) : null}
        </div>
    );
}

interface ApplyMatchesActionProps {
    pendingApplyCount: number;
    applySubmitting: boolean;
    onApplyClick: () => void;
}

function ApplyMatchesAction({
    pendingApplyCount,
    applySubmitting,
    onApplyClick
}: ApplyMatchesActionProps) {
    const disabled = pendingApplyCount === 0 || applySubmitting;
    const disabledReason = applySubmitting
        ? 'Applying matches…'
        : pendingApplyCount === 0
          ? 'No matches ready to apply yet — confirm or link users above'
          : null;
    const applyLabel = applySubmitting
        ? 'Applying…'
        : `Apply ${pendingApplyCount} match${pendingApplyCount === 1 ? '' : 'es'}`;

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <span
                    tabIndex={disabled ? 0 : -1}
                    className="inline-flex rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                    <Button
                        type="button"
                        variant="brand"
                        disabled={disabled}
                        onClick={onApplyClick}
                    >
                        {applyLabel}
                    </Button>
                </span>
            </TooltipTrigger>
            {disabledReason ? (
                <TooltipContent className="max-w-xs">
                    {disabledReason}
                </TooltipContent>
            ) : null}
        </Tooltip>
    );
}

interface MatchSectionCardProps {
    id: MatchSectionId;
    tone: 'green' | 'amber' | 'red';
    icon: ReactNode;
    title: string;
    count: number;
    instruction: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    headerAction?: ReactNode;
    emptyTitle: string;
    isEmpty: boolean;
    children: ReactNode;
}

const SECTION_BORDER: Record<MatchSectionCardProps['tone'], string> = {
    green: 'border-l-green-500',
    amber: 'border-l-amber-500',
    red: 'border-l-red-500'
};

const SECTION_ICON: Record<MatchSectionCardProps['tone'], string> = {
    green: 'text-green-600',
    amber: 'text-amber-600',
    red: 'text-red-600'
};

function MatchSectionCard({
    id,
    tone,
    icon,
    title,
    count,
    instruction,
    open,
    onOpenChange,
    headerAction,
    emptyTitle,
    isEmpty,
    children
}: MatchSectionCardProps) {
    return (
        <Collapsible
            id={`section-${id}`}
            open={open}
            onOpenChange={onOpenChange}
            className="card-block scroll-mt-24"
        >
            <div className={cn('border-l-4', SECTION_BORDER[tone])}>
                <div className="flex flex-wrap items-start justify-between gap-3 px-6 py-4 md:py-5">
                    <CollapsibleTrigger asChild>
                        <button
                            type="button"
                            className="group flex min-w-0 flex-1 items-start gap-3 rounded-md text-left transition-colors hover:bg-accent/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                            aria-expanded={open}
                            aria-controls={`section-${id}-content`}
                        >
                            <span className={cn('mt-0.5', SECTION_ICON[tone])}>
                                {icon}
                            </span>
                            <span className="min-w-0 flex-1">
                                <span className="flex flex-wrap items-center gap-2">
                                    <span className="text-base font-semibold text-brand-dark">
                                        {title}
                                    </span>
                                    <Badge
                                        variant="outline"
                                        className={cn(
                                            tone === 'green' &&
                                                'bg-green-50 text-green-700 border-green-200',
                                            tone === 'amber' && 'badge-amber',
                                            tone === 'red' &&
                                                'bg-red-50 text-red-700 border-red-200'
                                        )}
                                    >
                                        {count}
                                    </Badge>
                                </span>
                                <span className="mt-1 block text-sm text-gray-600">
                                    {instruction}
                                </span>
                            </span>
                            <span className="mt-0.5 flex shrink-0 rounded-md p-1 text-gray-500 transition-colors group-hover:bg-accent group-hover:text-brand-dark">
                                {open ? (
                                    <ChevronUp className="size-5" aria-hidden />
                                ) : (
                                    <ChevronDown
                                        className="size-5"
                                        aria-hidden
                                    />
                                )}
                            </span>
                        </button>
                    </CollapsibleTrigger>
                    {headerAction ? (
                        <div className="flex shrink-0 items-center gap-2">
                            {headerAction}
                        </div>
                    ) : null}
                </div>

                <CollapsibleContent id={`section-${id}-content`}>
                    <div className="border-t border-gray-200 px-6 pb-4 md:pb-5">
                        {isEmpty ? (
                            <div className="empty-state py-8">
                                <CheckCircle2 className="mx-auto mb-2 size-5 text-green-600" />
                                <p className="text-sm text-gray-600">
                                    {emptyTitle}
                                </p>
                            </div>
                        ) : (
                            children
                        )}
                    </div>
                </CollapsibleContent>
            </div>
        </Collapsible>
    );
}

export default function ProviderUserManagement() {
    const { id: providerId } = useParams();
    const navigate = useNavigate();

    const [userToMap, setUserToMap] = useState<ProviderUser | undefined>();
    const [provider, setProvider] = useState<ProviderPlatform | undefined>();
    const [importedUsers, setImportedUsers] = useState<UserImports[]>([]);
    const [providerLoading, setProviderLoading] = useState(true);
    const [showMapModal, setShowMapModal] = useState(false);
    const [showImportedModal, setShowImportedModal] = useState(false);
    const [showImportAllConfirm, setShowImportAllConfirm] = useState(false);
    const [showApplyConfirm, setShowApplyConfirm] = useState(false);
    const [showCreateAllConfirm, setShowCreateAllConfirm] = useState(false);
    const [appliedFlashIds, setAppliedFlashIds] = useState<Set<string>>(
        new Set()
    );
    const [bulkCreateSubmitting, setBulkCreateSubmitting] = useState(false);
    const [liveMessage, setLiveMessage] = useState('');
    const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
    const [mapSearch, setMapSearch] = useState('');
    const [mapSubmitting, setMapSubmitting] = useState(false);
    const [applySubmitting, setApplySubmitting] = useState(false);
    const [demotedFromAuto, setDemotedFromAuto] = useState<ProviderUser[]>([]);
    const [demotedFromReview, setDemotedFromReview] = useState<ProviderUser[]>(
        []
    );
    const [ambiguousSelections, setAmbiguousSelections] = useState<
        Record<string, number>
    >({});
    const [reviewResidentLabels, setReviewResidentLabels] = useState<
        Record<
            string,
            Pick<User, 'id' | 'name_first' | 'name_last' | 'username'>
        >
    >({});
    const [unmatchedToCreate, setUnmatchedToCreate] = useState<Set<string>>(
        new Set()
    );
    const [highlightedIds, setHighlightedIds] = useState<Set<string>>(
        new Set()
    );
    const [autoDemotePending, setAutoDemotePending] =
        useState<UserMatchResult | null>(null);
    const [mapModalSource, setMapModalSource] = useState<
        'unmatched' | 'review' | null
    >(null);
    const [userToUnlink, setUserToUnlink] = useState<User | null>(null);
    const [lastSynced, setLastSynced] = useState<Date | null>(null);
    const [showWorkflowHint, setShowWorkflowHint] = useState(
        () => !readSessionBool(sessionKey(providerId, 'hint-dismissed'), false)
    );

    const summaryRef = useRef<HTMLDivElement>(null);
    const linkedSectionRef = useRef<HTMLDivElement>(null);

    const {
        data: matchData,
        isLoading: matchLoading,
        mutate: mutateMatch
    } = useSWR<ServerResponseOne<MatchUsersResponse>>(
        providerId
            ? `/api/actions/provider-platforms/${providerId}/match-users`
            : null
    );
    const matchState = matchData?.data ?? null;

    const { data: unmappedResp, mutate: mutateUnmapped } = useSWR<
        ServerResponseMany<User>
    >(
        showMapModal
            ? `/api/users?include=only_unmapped&provider_id=${providerId}&per_page=50`
            : null
    );
    const unmappedUsers = unmappedResp?.data ?? [];

    const { data: mappedResp, mutate: mutateMapped } = useSWR<
        ServerResponseMany<User>
    >(
        providerId
            ? `/api/provider-platforms/${providerId}/mapped-users?per_page=50`
            : null
    );
    const mappedUsers = mappedResp?.data ?? [];

    const filteredUnmapped = mapSearch
        ? unmappedUsers.filter(
              (u) =>
                  u.username.toLowerCase().includes(mapSearch.toLowerCase()) ||
                  `${u.name_first} ${u.name_last}`
                      .toLowerCase()
                      .includes(mapSearch.toLowerCase())
          )
        : unmappedUsers;

    const derived = useMemo(() => {
        if (!matchState) return null;
        return deriveReconciliationState(matchState, mappedUsers, {
            demotedFromAuto,
            demotedFromReview,
            ambiguousSelections,
            reviewResidentLabels,
            unmatchedToCreate
        });
    }, [
        matchState,
        mappedUsers,
        demotedFromAuto,
        demotedFromReview,
        ambiguousSelections,
        reviewResidentLabels,
        unmatchedToCreate
    ]);

    const autoCount = derived?.autoCount ?? 0;
    const reviewCount = derived?.reviewCount ?? 0;
    const outstandingUnmatchedCount = derived?.outstandingUnmatchedCount ?? 0;
    const totalCanvasUsers = derived?.totalCanvasUsers ?? 0;
    const resolvedCount = derived?.resolvedCount ?? 0;
    const linkedCount = derived?.linkedCount ?? 0;
    const progressGreenCount = derived?.progressGreenCount ?? 0;
    const progressAmberCount = derived?.progressAmberCount ?? 0;

    const flashHighlight = useCallback((externalUserId: string) => {
        setHighlightedIds((prev) => new Set(prev).add(externalUserId));
        window.setTimeout(() => {
            setHighlightedIds((prev) => {
                const next = new Set(prev);
                next.delete(externalUserId);
                return next;
            });
        }, 2000);
    }, []);

    const announce = useCallback((message: string) => {
        setLiveMessage('');
        requestAnimationFrame(() => setLiveMessage(message));
    }, []);

    const [autoOpen, setAutoOpen] = useState(() =>
        readSessionBool(sessionKey(providerId, 'section-auto'), false)
    );
    const [reviewOpen, setReviewOpen] = useState(() =>
        readSessionBool(sessionKey(providerId, 'section-review'), false)
    );
    const [unmatchedOpen, setUnmatchedOpen] = useState(() =>
        readSessionBool(sessionKey(providerId, 'section-unmatched'), false)
    );

    useEffect(() => {
        if (!matchState || matchState.ambiguous.length === 0) return;
        try {
            if (
                sessionStorage.getItem(
                    sessionKey(providerId, 'section-review')
                ) === null
            ) {
                setReviewOpen(true);
            }
        } catch {
            setReviewOpen(true);
        }
    }, [matchState, providerId]);

    useEffect(() => {
        if (matchData) {
            setLastSynced(new Date());
        }
    }, [matchData]);

    useEffect(() => {
        const fetchProvider = async () => {
            const res = await API.get<ProviderPlatform>(
                `provider-platforms/${providerId}`
            );
            if (res.success) {
                setProvider(res.data as ProviderPlatform);
            } else {
                toast.error('Failed to fetch provider details.');
            }
            setProviderLoading(false);
        };
        void fetchProvider();
    }, [providerId]);

    const pendingApplyCount = useMemo(() => {
        if (!derived) return 0;
        return derived.pendingLinks.filter((l) => l.isPendingApply).length;
    }, [derived]);

    const needsAttentionCount = reviewCount + outstandingUnmatchedCount;

    const resolvedPercent =
        totalCanvasUsers > 0
            ? Math.round((resolvedCount / totalCanvasUsers) * 100)
            : 0;

    const prioritySection: MatchSectionId | null =
        reviewCount > 0
            ? 'needs-review'
            : outstandingUnmatchedCount > 0
              ? 'unmatched'
              : null;

    const scrollToSection = (section: MatchSectionId) => {
        document
            .getElementById(`section-${section}`)
            ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        if (section === 'auto-confirmed') setAutoOpen(true);
        if (section === 'needs-review') setReviewOpen(true);
        if (section === 'unmatched') setUnmatchedOpen(true);
    };

    const scrollToLinkedResidents = () => {
        linkedSectionRef.current?.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
        });
    };

    const scrollToWorkflowTarget = (target: WorkflowTarget) => {
        if (target === 'apply') {
            scrollToLinkedResidents();
            return;
        }
        scrollToSection(target);
    };

    const requestApplyMatches = () => {
        if (pendingApplyCount === 0 || applySubmitting) return;
        setShowApplyConfirm(true);
    };

    const handleApplyMatches = async () => {
        if (!matchState || pendingApplyCount === 0) return;
        setShowApplyConfirm(false);
        setApplySubmitting(true);

        const pendingExternalIds =
            derived?.pendingLinks
                .filter((l) => l.isPendingApply)
                .map((l) => l.externalUserId) ?? [];

        const confirmed: ConfirmedMatch[] = [
            ...(derived?.autoRows ?? [])
                .filter((r) => r.suggested_user)
                .map((r) => ({
                    canvas_user: r.canvas_user,
                    unlocked_user_id: r.suggested_user!.id
                })),
            ...matchState.ambiguous
                .filter(
                    (r) =>
                        ambiguousSelections[r.canvas_user.external_user_id] !=
                        null
                )
                .map((r) => ({
                    canvas_user: r.canvas_user,
                    unlocked_user_id:
                        ambiguousSelections[r.canvas_user.external_user_id]
                }))
        ];

        const toCreate: ProviderUser[] = (derived?.unmatchedRows ?? []).filter(
            (u) => unmatchedToCreate.has(u.external_user_id)
        );

        const req: ApplyMatchesRequest = { confirmed, to_create: toCreate };

        const res = await API.post<ApplyMatchesResponse, ApplyMatchesRequest>(
            `actions/provider-platforms/${providerId}/apply-matches`,
            req
        );
        setApplySubmitting(false);

        if (res.success) {
            const data = res.data as ApplyMatchesResponse;
            if (data.failed.length > 0) {
                toast.error(
                    `Some matches failed: ${data.failed.join(', ')}. Pending items remain — try again.`
                );
                announce('Some matches failed to apply');
            } else {
                const totalApplied = data.applied + data.created;
                toast.success(
                    `${totalApplied} match${totalApplied === 1 ? '' : 'es'} applied`
                );
                announce(
                    `${totalApplied} match${totalApplied === 1 ? '' : 'es'} applied`
                );
                setAppliedFlashIds(new Set(pendingExternalIds));
                window.setTimeout(() => setAppliedFlashIds(new Set()), 3000);
                setDemotedFromAuto([]);
                setDemotedFromReview([]);
                setAmbiguousSelections({});
                setReviewResidentLabels({});
                setUnmatchedToCreate(new Set());
            }
            void mutateMatch();
            void mutateMapped();
        } else {
            toast.error(
                'Failed to apply matches. Pending items remain — try again.'
            );
            announce('Failed to apply matches');
        }
    };

    const handleImportAll = async () => {
        const res = await API.post(
            `actions/provider-platforms/${providerId}/import-users`,
            {}
        );
        if (res.success) {
            toast.success(
                'Users imported successfully. Please check for accounts not created.'
            );
            void mutateMatch();
            void mutateMapped();
        } else {
            toast.error('Error importing users.');
        }
        setShowImportAllConfirm(false);
    };

    const handleMapUser = async () => {
        if (!userToMap || selectedUserId === null) return;

        const resident = filteredUnmapped.find((u) => u.id === selectedUserId);
        const residentName = resident ? formatResident(resident) : null;
        const canvasName = formatCanvasUser(userToMap);
        const externalId = userToMap.external_user_id;

        setMapSubmitting(true);
        const res = await API.post(
            `provider-platforms/${providerId}/map-user/${selectedUserId}`,
            userToMap
        );
        setMapSubmitting(false);
        if (res.success) {
            setUnmatchedToCreate((prev) => {
                const next = new Set(prev);
                next.delete(externalId);
                return next;
            });
            if (mapModalSource === 'review') {
                setAmbiguousSelections((prev) => {
                    const next = { ...prev };
                    delete next[externalId];
                    return next;
                });
                setReviewResidentLabels((prev) => {
                    const next = { ...prev };
                    delete next[externalId];
                    return next;
                });
            }
            setDemotedFromReview((prev) =>
                prev.filter((u) => u.external_user_id !== externalId)
            );
            toast.success(
                residentName
                    ? `${canvasName} linked to ${residentName}.`
                    : 'User mapped successfully.'
            );
            announce(
                residentName
                    ? `${canvasName} linked to ${residentName}`
                    : `${canvasName} linked`
            );
            flashHighlight(externalId);
            setShowMapModal(false);
            setUserToMap(undefined);
            setSelectedUserId(null);
            setMapSearch('');
            setMapModalSource(null);
            void mutateMatch();
            void mutateUnmapped();
            void mutateMapped();
        } else {
            toast.error('Failed to map user.');
        }
    };

    const handleUnlinkUser = async () => {
        if (!userToUnlink || !providerId) return;
        const res = await API.delete(
            `users/${userToUnlink.id}/logins/${providerId}`
        );
        if (res.success) {
            toast.success(
                `${userToUnlink.name_first} ${userToUnlink.name_last} unlinked.`
            );
            setUserToUnlink(null);
            void mutateMapped();
            void mutateMatch();
        } else {
            toast.error('Failed to unlink user.');
        }
    };

    const confirmDemoteFromAuto = () => {
        if (!autoDemotePending) return;
        const { canvas_user: canvasUser } = autoDemotePending;
        const canvasName = formatCanvasUser(canvasUser);
        const externalId = canvasUser.external_user_id;

        setDemotedFromAuto((prev) => {
            if (prev.some((u) => u.external_user_id === externalId)) {
                return prev;
            }
            return [...prev, canvasUser];
        });
        setAutoDemotePending(null);

        toast.success(`${canvasName} moved to Unmatched`, {
            action: {
                label: 'Undo',
                onClick: () => undoDemoteFromAuto(canvasUser)
            }
        });
        announce(`${canvasName} moved to Unmatched`);
        flashHighlight(externalId);
    };

    const undoDemoteFromAuto = (canvasUser: ProviderUser) => {
        const externalId = canvasUser.external_user_id;
        setDemotedFromAuto((prev) =>
            prev.filter((u) => u.external_user_id !== externalId)
        );
        announce(`${formatCanvasUser(canvasUser)} restored to Auto-confirmed`);
    };

    const confirmReviewMatch = (result: UserMatchResult) => {
        if (!result.suggested_user) return;
        const externalId = result.canvas_user.external_user_id;
        const canvasName = formatCanvasUser(result.canvas_user);
        const residentName = formatResident(result.suggested_user);

        setAmbiguousSelections((prev) => ({
            ...prev,
            [externalId]: result.suggested_user!.id
        }));
        setReviewResidentLabels((prev) => ({
            ...prev,
            [externalId]: {
                id: result.suggested_user!.id,
                name_first: result.suggested_user!.name_first,
                name_last: result.suggested_user!.name_last,
                username: result.suggested_user!.username
            }
        }));

        toast.success(`${canvasName} linked to ${residentName}`, {
            action: {
                label: 'Undo',
                onClick: () => undoConfirmReview(externalId, canvasName)
            }
        });
        announce(`${canvasName} linked to ${residentName}`);
        flashHighlight(externalId);
    };

    const undoConfirmReview = (externalId: string, canvasName: string) => {
        setAmbiguousSelections((prev) => {
            const next = { ...prev };
            delete next[externalId];
            return next;
        });
        setReviewResidentLabels((prev) => {
            const next = { ...prev };
            delete next[externalId];
            return next;
        });
        announce(`${canvasName} returned to Needs review`);
    };

    const demoteFromReview = (result: UserMatchResult) => {
        const canvasUser = result.canvas_user;
        const externalId = canvasUser.external_user_id;
        const canvasName = formatCanvasUser(canvasUser);

        setDemotedFromReview((prev) => {
            if (prev.some((u) => u.external_user_id === externalId)) {
                return prev;
            }
            return [...prev, canvasUser];
        });
        setAmbiguousSelections((prev) => {
            const next = { ...prev };
            delete next[externalId];
            return next;
        });
        setReviewResidentLabels((prev) => {
            const next = { ...prev };
            delete next[externalId];
            return next;
        });

        toast.success(`${canvasName} moved to Unmatched`, {
            action: {
                label: 'Undo',
                onClick: () => undoDemoteFromReview(canvasUser)
            }
        });
        announce(`${canvasName} moved to Unmatched`);
        flashHighlight(externalId);
    };

    const undoDemoteFromReview = (canvasUser: ProviderUser) => {
        const externalId = canvasUser.external_user_id;
        setDemotedFromReview((prev) =>
            prev.filter((u) => u.external_user_id !== externalId)
        );
        announce(`${formatCanvasUser(canvasUser)} restored to Needs review`);
    };

    const queueUnmatchedCreate = (externalUserId: string) => {
        const canvasUser = derived?.unmatchedRows.find(
            (u) => u.external_user_id === externalUserId
        );
        const canvasName = canvasUser ? formatCanvasUser(canvasUser) : 'User';

        setUnmatchedToCreate((prev) => new Set(prev).add(externalUserId));
        toast.success(`${canvasName} queued to create`, {
            action: {
                label: 'Undo',
                onClick: () => undoUnmatchedCreate(externalUserId)
            }
        });
        announce(`${canvasName} queued to create`);
        flashHighlight(externalUserId);
    };

    const undoUnmatchedCreate = (externalUserId: string) => {
        setUnmatchedToCreate((prev) => {
            const next = new Set(prev);
            next.delete(externalUserId);
            return next;
        });
        announce('Create action undone');
    };

    const openMapModal = (
        canvasUser: ProviderUser,
        source: 'unmatched' | 'review'
    ) => {
        setMapModalSource(source);
        setUserToMap(canvasUser);
        setSelectedUserId(null);
        setMapSearch('');
        setShowMapModal(true);
    };

    const handleConfirmAllReview = () => {
        if (!matchState) return;
        const nextSelections: Record<string, number> = {
            ...ambiguousSelections
        };
        const nextLabels = { ...reviewResidentLabels };
        let count = 0;

        for (const row of matchState.ambiguous) {
            if (!row.suggested_user) continue;
            const externalId = row.canvas_user.external_user_id;
            if (nextSelections[externalId] != null) continue;
            nextSelections[externalId] = row.suggested_user.id;
            nextLabels[externalId] = {
                id: row.suggested_user.id,
                name_first: row.suggested_user.name_first,
                name_last: row.suggested_user.name_last,
                username: row.suggested_user.username
            };
            count++;
        }

        setAmbiguousSelections(nextSelections);
        setReviewResidentLabels(nextLabels);
        toast.success(`Confirmed ${count} suggestion${count === 1 ? '' : 's'}`);
        announce(`${count} match${count === 1 ? '' : 'es'} confirmed`);
    };

    const handleConfirmCreateAllUnmatched = () => {
        if (!matchState) return;
        setBulkCreateSubmitting(true);

        const idsToQueue = (derived?.unmatchedRows ?? [])
            .filter((u) => !unmatchedToCreate.has(u.external_user_id))
            .map((u) => u.external_user_id);

        setUnmatchedToCreate((prev) => new Set([...prev, ...idsToQueue]));

        setBulkCreateSubmitting(false);
        setShowCreateAllConfirm(false);

        if (idsToQueue.length === 0) {
            toast.message('All unmatched users already have an action.');
            return;
        }

        toast.success(
            `Queued ${idsToQueue.length} resident${idsToQueue.length === 1 ? '' : 's'} to create.`
        );
        announce(
            `${idsToQueue.length} resident${idsToQueue.length === 1 ? '' : 's'} queued to create`
        );
    };

    const dismissWorkflowHint = () => {
        setShowWorkflowHint(false);
        writeSessionBool(sessionKey(providerId, 'hint-dismissed'), true);
    };

    const handleAutoOpenChange = (open: boolean) => {
        setAutoOpen(open);
        writeSessionBool(sessionKey(providerId, 'section-auto'), open);
    };

    const handleReviewOpenChange = (open: boolean) => {
        setReviewOpen(open);
        writeSessionBool(sessionKey(providerId, 'section-review'), open);
    };

    const handleUnmatchedOpenChange = (open: boolean) => {
        setUnmatchedOpen(open);
        writeSessionBool(sessionKey(providerId, 'section-unmatched'), open);
    };

    if (providerLoading) {
        return (
            <div className="bg-[#E2E7EA] min-h-screen p-6">
                <div className="max-w-7xl mx-auto space-y-6">
                    <Skeleton className="h-10 w-64" />
                    <Skeleton className="h-96 w-full rounded-lg" />
                </div>
            </div>
        );
    }

    if (provider?.type === ProviderPlatformType.KOLIBRI) {
        return (
            <div className="bg-[#E2E7EA] min-h-screen p-6">
                <div className="max-w-7xl mx-auto">
                    <div className="card-block p-8 text-center">
                        <p className="text-muted-foreground">
                            Kolibri users are managed automatically.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div
            className={cn(
                'bg-[#E2E7EA] min-h-screen p-6',
                pendingApplyCount > 0 && 'pb-28'
            )}
        >
            <div aria-live="polite" aria-atomic="true" className="sr-only">
                {liveMessage}
            </div>
            <div className="max-w-7xl mx-auto space-y-6">
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <button
                        type="button"
                        onClick={() =>
                            navigate(`/learning-platforms/${providerId}`)
                        }
                        className="flex items-center gap-1 hover:text-foreground transition-colors"
                    >
                        <ChevronLeftIcon className="size-4" />
                        {provider?.name ?? 'Learning Platform'}
                    </button>
                </div>

                <div className="mb-8">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-medium text-brand-dark">
                                Learning Platform Users
                            </h1>
                            <p className="mt-1 text-gray-600">
                                Match Canvas users to residents in your system.
                                Review each group below, then apply your
                                changes.
                            </p>
                            {lastSynced ? (
                                <p className="mt-1 text-sm text-gray-500">
                                    Last synced: {formatSyncedAt(lastSynced)}
                                </p>
                            ) : null}
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                className="gap-2"
                                onClick={() => void mutateMatch()}
                                disabled={matchLoading}
                            >
                                <ArrowPathIcon className="size-4" />
                                {matchLoading ? 'Syncing…' : 'Refresh'}
                            </Button>
                            <Button
                                variant="brand"
                                className="gap-2"
                                onClick={() => setShowImportAllConfirm(true)}
                                disabled={!provider}
                            >
                                <Upload className="size-4" />
                                Import All Users
                            </Button>
                        </div>
                    </div>
                </div>

                {showWorkflowHint && (
                    <WorkflowGuide
                        onDismiss={dismissWorkflowHint}
                        onStepClick={scrollToWorkflowTarget}
                    />
                )}

                {matchState && (
                    <div
                        id="section-apply"
                        ref={summaryRef}
                        className="card-block space-y-5 p-4 md:p-6"
                    >
                        <div className="flex flex-wrap items-start justify-between gap-4">
                            <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
                                <h2 className="text-lg font-semibold text-brand-dark">
                                    Reconciliation progress
                                </h2>
                                <p className="text-sm text-gray-600">
                                    {resolvedCount} of {totalCanvasUsers} Canvas
                                    users resolved
                                    {totalCanvasUsers > 0 ? (
                                        <span className="font-medium text-brand-dark">
                                            {' '}
                                            · {resolvedPercent}%
                                        </span>
                                    ) : null}
                                    {pendingApplyCount > 0 ? (
                                        <>
                                            {' · '}
                                            <button
                                                type="button"
                                                onClick={
                                                    scrollToLinkedResidents
                                                }
                                                className="font-medium text-brand hover:text-brand-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
                                            >
                                                {pendingApplyCount} ready to
                                                apply →
                                            </button>
                                        </>
                                    ) : null}
                                </p>
                            </div>
                        </div>

                        {totalCanvasUsers > 0 ? (
                            <ReconciliationProgressBar
                                total={totalCanvasUsers}
                                resolved={resolvedCount}
                                greenCount={progressGreenCount}
                                amberCount={progressAmberCount}
                            />
                        ) : null}

                        <div className="grid gap-4 sm:grid-cols-3">
                            <ReconciliationStatTile
                                tone="green"
                                label="Auto-matched"
                                count={autoCount}
                                isPriority={false}
                                onClick={() =>
                                    scrollToSection('auto-confirmed')
                                }
                                ariaLabel={`${autoCount} auto-matched. View section.`}
                            />
                            <ReconciliationStatTile
                                tone="amber"
                                label="Needs review"
                                count={reviewCount}
                                isPriority={prioritySection === 'needs-review'}
                                onClick={() => scrollToSection('needs-review')}
                                ariaLabel={`${reviewCount} need review. View section.`}
                            />
                            <ReconciliationStatTile
                                tone="red"
                                label="Unmatched"
                                count={outstandingUnmatchedCount}
                                isPriority={prioritySection === 'unmatched'}
                                onClick={() => scrollToSection('unmatched')}
                                ariaLabel={`${outstandingUnmatchedCount} unmatched. View section.`}
                            />
                        </div>
                    </div>
                )}

                {matchLoading && !matchState ? (
                    <div className="space-y-3">
                        <Skeleton className="h-12 w-full rounded-lg" />
                        <Skeleton className="h-32 w-full rounded-lg" />
                        <Skeleton className="h-32 w-full rounded-lg" />
                    </div>
                ) : matchState ? (
                    <div className="space-y-4">
                        <MatchSectionCard
                            id="auto-confirmed"
                            tone="green"
                            icon={<CheckCircle2 className="size-5" />}
                            title="Auto-confirmed"
                            count={autoCount}
                            instruction="Matched automatically. Expand to verify or remove incorrect pairs."
                            open={autoOpen}
                            onOpenChange={handleAutoOpenChange}
                            emptyTitle="No items in this group ✓"
                            isEmpty={autoCount === 0}
                        >
                            <AutoConfirmedTable
                                rows={derived?.autoRows ?? []}
                                highlightedIds={highlightedIds}
                                onRemove={(row) => setAutoDemotePending(row)}
                            />
                        </MatchSectionCard>

                        <MatchSectionCard
                            id="needs-review"
                            tone="amber"
                            icon={<AlertTriangle className="size-5" />}
                            title="Needs review"
                            count={reviewCount}
                            instruction="Possible matches we aren't sure about. Confirm or choose a different resident for each."
                            open={reviewOpen}
                            onOpenChange={handleReviewOpenChange}
                            headerAction={
                                reviewCount > 0 ? (
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={handleConfirmAllReview}
                                    >
                                        Confirm all suggestions
                                    </Button>
                                ) : undefined
                            }
                            emptyTitle="No items in this group ✓"
                            isEmpty={reviewCount === 0}
                        >
                            <NeedsReviewTable
                                rows={derived?.reviewRows ?? []}
                                highlightedIds={highlightedIds}
                                onConfirm={confirmReviewMatch}
                                onReject={demoteFromReview}
                                onLinkExisting={(user) =>
                                    openMapModal(user, 'review')
                                }
                            />
                        </MatchSectionCard>

                        <MatchSectionCard
                            id="unmatched"
                            tone="red"
                            icon={<UserX className="size-5" />}
                            title="Unmatched"
                            count={outstandingUnmatchedCount}
                            instruction="No match found. Create a new resident or link to an existing one."
                            open={unmatchedOpen}
                            onOpenChange={handleUnmatchedOpenChange}
                            headerAction={
                                outstandingUnmatchedCount > 0 ? (
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        disabled={bulkCreateSubmitting}
                                        onClick={() =>
                                            setShowCreateAllConfirm(true)
                                        }
                                    >
                                        {bulkCreateSubmitting
                                            ? 'Queuing…'
                                            : 'Create all as residents'}
                                    </Button>
                                ) : undefined
                            }
                            emptyTitle="All Canvas users have been matched ✓"
                            isEmpty={(derived?.unmatchedRows.length ?? 0) === 0}
                        >
                            {outstandingUnmatchedCount === 0 &&
                            (derived?.unmatchedRows.length ?? 0) > 0 ? (
                                <div className="mb-4 flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
                                    <CheckCircle2 className="size-4 shrink-0" />
                                    All unmatched users have an action. Apply
                                    from Linked residents below.
                                </div>
                            ) : null}
                            <UnmatchedTable
                                rows={derived?.unmatchedRows ?? []}
                                unmatchedToCreate={unmatchedToCreate}
                                highlightedIds={highlightedIds}
                                onCreate={queueUnmatchedCreate}
                                onUndoCreate={undoUnmatchedCreate}
                                onLinkExisting={(user) =>
                                    openMapModal(user, 'unmatched')
                                }
                            />
                        </MatchSectionCard>
                    </div>
                ) : null}

                <div
                    id="section-linked"
                    ref={linkedSectionRef}
                    className="card-block scroll-mt-24"
                >
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-6 py-3">
                        <div className="flex items-center gap-2">
                            <Users className="size-4 text-gray-500" />
                            <div>
                                <h2 className="text-sm font-medium text-brand-dark">
                                    Linked residents ({linkedCount})
                                </h2>
                                {pendingApplyCount > 0 ? (
                                    <p className="text-xs text-muted-foreground">
                                        {pendingApplyCount} pending apply
                                    </p>
                                ) : null}
                            </div>
                        </div>
                        <ApplyMatchesAction
                            pendingApplyCount={pendingApplyCount}
                            applySubmitting={applySubmitting}
                            onApplyClick={requestApplyMatches}
                        />
                    </div>
                    {linkedCount === 0 ? (
                        <p className="px-6 py-4 text-sm text-muted-foreground">
                            No residents are linked to this platform yet.
                            Confirm or link users above — they will appear here
                            as pending until you apply.
                        </p>
                    ) : (
                        <div className="px-6 pb-4">
                            <LinkedResidentsTable
                                entries={derived?.linkedEntries ?? []}
                                highlightedIds={highlightedIds}
                                appliedFlashIds={appliedFlashIds}
                                applySubmitting={applySubmitting}
                                onUnlink={setUserToUnlink}
                            />
                        </div>
                    )}
                </div>

                {pendingApplyCount > 0 ? (
                    <div
                        role="region"
                        aria-label="Apply matches action bar"
                        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card shadow-lg animate-in slide-in-from-bottom duration-300"
                    >
                        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-6 py-4">
                            <p className="text-sm text-gray-600">
                                {pendingApplyCount} match
                                {pendingApplyCount === 1 ? '' : 'es'} ready to
                                apply
                                {needsAttentionCount > 0
                                    ? ` · ${needsAttentionCount} user${needsAttentionCount === 1 ? '' : 's'} still need attention`
                                    : ''}
                            </p>
                            <ApplyMatchesAction
                                pendingApplyCount={pendingApplyCount}
                                applySubmitting={applySubmitting}
                                onApplyClick={requestApplyMatches}
                            />
                        </div>
                    </div>
                ) : null}

                <FormModal
                    open={showMapModal}
                    onOpenChange={(open) => {
                        setShowMapModal(open);
                        if (!open) {
                            setUserToMap(undefined);
                            setSelectedUserId(null);
                            setMapSearch('');
                            setMapModalSource(null);
                        }
                    }}
                    title="Select resident"
                    description={
                        userToMap
                            ? `Link Canvas user ${formatCanvasUser(userToMap)} to an existing resident.`
                            : 'Link this Canvas user to an existing resident.'
                    }
                    className="max-w-lg"
                >
                    <div className="space-y-4">
                        <SearchInput
                            value={mapSearch}
                            onChange={setMapSearch}
                            placeholder="Search by name or username…"
                        />
                        <div
                            className="scroll-panel max-h-64"
                            role="listbox"
                            aria-label="Unmapped residents"
                        >
                            {filteredUnmapped.length === 0 ? (
                                <p className="py-6 text-center text-sm text-muted-foreground">
                                    No unmapped residents found.
                                </p>
                            ) : (
                                filteredUnmapped.map((u) => {
                                    const selected = selectedUserId === u.id;
                                    return (
                                        <button
                                            key={u.id}
                                            type="button"
                                            role="option"
                                            aria-selected={selected}
                                            onClick={() =>
                                                setSelectedUserId(u.id)
                                            }
                                            className={cn(
                                                'flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition-colors',
                                                selected
                                                    ? 'bg-brand/10 text-brand-dark'
                                                    : 'hover:bg-gray-100'
                                            )}
                                        >
                                            <span>
                                                <span className="font-medium">
                                                    {u.name_first} {u.name_last}
                                                </span>
                                                <span className="ml-2 text-muted-foreground">
                                                    ({u.username})
                                                </span>
                                            </span>
                                            {selected ? (
                                                <Badge
                                                    variant="outline"
                                                    className="bg-brand/10 text-brand border-brand/30"
                                                >
                                                    Selected
                                                </Badge>
                                            ) : null}
                                        </button>
                                    );
                                })
                            )}
                        </div>
                        <div className="section-footer -mx-6 -mb-6 mt-2 flex justify-end gap-2 rounded-b-lg">
                            <Button
                                variant="outline"
                                onClick={() => setShowMapModal(false)}
                            >
                                Cancel
                            </Button>
                            <Button
                                variant="brand"
                                onClick={() => void handleMapUser()}
                                disabled={
                                    mapSubmitting || selectedUserId === null
                                }
                            >
                                {mapSubmitting ? 'Linking…' : 'Link resident'}
                            </Button>
                        </div>
                    </div>
                </FormModal>

                <FormModal
                    open={showImportedModal}
                    onOpenChange={setShowImportedModal}
                    title="Imported Users"
                    description="These accounts have been created. Please save the temporary passwords."
                >
                    <div className="max-h-96 space-y-2 overflow-y-auto">
                        {importedUsers.map((u) => (
                            <div
                                key={u.username}
                                className="flex items-center justify-between rounded-md bg-surface-hover p-3"
                            >
                                <span className="text-sm font-medium text-foreground">
                                    {u.username}
                                </span>
                                <div className="text-right">
                                    {u.error ? (
                                        <span className="text-xs text-destructive">
                                            {u.error}
                                        </span>
                                    ) : (
                                        <span className="font-mono text-xs text-muted-foreground">
                                            {u.temp_password}
                                        </span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="flex justify-end pt-4">
                        <Button
                            variant="brand"
                            onClick={() => {
                                setShowImportedModal(false);
                                setImportedUsers([]);
                            }}
                        >
                            Close
                        </Button>
                    </div>
                </FormModal>

                <ConfirmDialog
                    open={showImportAllConfirm}
                    onOpenChange={setShowImportAllConfirm}
                    title="Import All Users"
                    description="This will import all users from the provider platform. Are you sure you want to continue?"
                    confirmLabel="Import All"
                    onConfirm={() => void handleImportAll()}
                />

                <ConfirmDialog
                    open={showApplyConfirm}
                    onOpenChange={setShowApplyConfirm}
                    title={`Apply ${pendingApplyCount} match${pendingApplyCount === 1 ? '' : 'es'}?`}
                    description={`This links ${pendingApplyCount} Canvas user${pendingApplyCount === 1 ? '' : 's'} to their residents.${needsAttentionCount > 0 ? ` ${needsAttentionCount} other user${needsAttentionCount === 1 ? '' : 's'} still need attention and will remain in their sections.` : ''}`}
                    confirmLabel="Apply matches"
                    onConfirm={() => void handleApplyMatches()}
                />

                <ConfirmDialog
                    open={showCreateAllConfirm}
                    onOpenChange={setShowCreateAllConfirm}
                    title="Create all as residents"
                    description={`Create ${outstandingUnmatchedCount} new resident${outstandingUnmatchedCount === 1 ? '' : 's'} from unmatched Canvas users? They will be queued until you apply matches.`}
                    confirmLabel="Queue all"
                    onConfirm={handleConfirmCreateAllUnmatched}
                />

                <ConfirmDialog
                    open={autoDemotePending !== null}
                    onOpenChange={(open) => {
                        if (!open) setAutoDemotePending(null);
                    }}
                    title="Remove auto-confirmed match?"
                    description={
                        autoDemotePending
                            ? `This will unlink ${formatCanvasUser(autoDemotePending.canvas_user)} from ${formatResident(autoDemotePending.suggested_user)} and move them to Unmatched.`
                            : ''
                    }
                    confirmLabel="Move to Unmatched"
                    onConfirm={confirmDemoteFromAuto}
                />

                <ConfirmDialog
                    open={userToUnlink !== null}
                    onOpenChange={(open) => {
                        if (!open) setUserToUnlink(null);
                    }}
                    title="Unlink Resident"
                    description={`Are you sure you want to unlink ${userToUnlink ? `${userToUnlink.name_first} ${userToUnlink.name_last}` : 'this resident'} from ${provider?.name ?? 'this platform'}?`}
                    confirmLabel="Unlink"
                    onConfirm={() => void handleUnlinkUser()}
                    variant="destructive"
                />
            </div>
        </div>
    );
}

function AutoConfirmedTable({
    rows,
    highlightedIds,
    onRemove
}: {
    rows: UserMatchResult[];
    highlightedIds: Set<string>;
    onRemove: (row: UserMatchResult) => void;
}) {
    return (
        <>
            <div className="hidden md:block">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="pl-0">Canvas user</TableHead>
                            <TableHead>Resident</TableHead>
                            <TableHead className="text-right">Score</TableHead>
                            <TableHead className="text-right pr-0">
                                Action
                            </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {rows.map((r) => (
                            <TableRow
                                key={r.canvas_user.external_user_id}
                                className={cn(
                                    'transition-colors hover:bg-muted/50',
                                    highlightRowClass(
                                        r.canvas_user.external_user_id,
                                        highlightedIds
                                    )
                                )}
                            >
                                <TableCell className="pl-0 font-medium text-brand-dark">
                                    {formatCanvasUser(r.canvas_user)}
                                </TableCell>
                                <TableCell>
                                    {formatResident(r.suggested_user)}
                                </TableCell>
                                <TableCell className="text-right text-muted-foreground">
                                    {Math.round(r.score * 100)}%
                                </TableCell>
                                <TableCell className="text-right pr-0">
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => onRemove(r)}
                                        className="text-muted-foreground hover:text-destructive"
                                    >
                                        Remove
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
            <div className="space-y-3 md:hidden">
                {rows.map((r) => (
                    <div
                        key={r.canvas_user.external_user_id}
                        className={cn(
                            'rounded-lg border border-gray-200 p-3',
                            highlightRowClass(
                                r.canvas_user.external_user_id,
                                highlightedIds
                            )
                        )}
                    >
                        <div className="font-medium text-brand-dark">
                            {formatCanvasUser(r.canvas_user)}
                        </div>
                        <div className="mt-1 text-sm text-gray-600">
                            → {formatResident(r.suggested_user)}
                        </div>
                        <div className="mt-2 flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">
                                {Math.round(r.score * 100)}% match
                            </span>
                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => onRemove(r)}
                                className="text-muted-foreground hover:text-destructive"
                            >
                                Remove
                            </Button>
                        </div>
                    </div>
                ))}
            </div>
        </>
    );
}

function NeedsReviewTable({
    rows,
    highlightedIds,
    onConfirm,
    onReject,
    onLinkExisting
}: {
    rows: UserMatchResult[];
    highlightedIds: Set<string>;
    onConfirm: (result: UserMatchResult) => void;
    onReject: (result: UserMatchResult) => void;
    onLinkExisting: (user: ProviderUser) => void;
}) {
    return (
        <>
            <div className="hidden md:block">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="pl-0">Canvas user</TableHead>
                            <TableHead>Suggested resident</TableHead>
                            <TableHead className="text-right">Score</TableHead>
                            <TableHead className="text-right pr-0">
                                Action
                            </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {rows.map((r) => (
                            <TableRow
                                key={r.canvas_user.external_user_id}
                                className={cn(
                                    'transition-colors hover:bg-muted/50',
                                    highlightRowClass(
                                        r.canvas_user.external_user_id,
                                        highlightedIds
                                    )
                                )}
                            >
                                <TableCell className="pl-0 font-medium text-brand-dark">
                                    {formatCanvasUser(r.canvas_user)}
                                </TableCell>
                                <TableCell>
                                    {formatResident(r.suggested_user)}
                                </TableCell>
                                <TableCell className="text-right text-muted-foreground">
                                    {Math.round(r.score * 100)}%
                                </TableCell>
                                <TableCell className="text-right pr-0">
                                    <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-end">
                                        {r.suggested_user ? (
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant="brand"
                                                className="sm:min-w-[5.5rem]"
                                                onClick={() => onConfirm(r)}
                                            >
                                                Confirm
                                            </Button>
                                        ) : null}
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            className="sm:min-w-[5.5rem]"
                                            onClick={() =>
                                                onLinkExisting(r.canvas_user)
                                            }
                                        >
                                            Link existing
                                        </Button>
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="ghost"
                                            className="text-muted-foreground hover:text-destructive"
                                            onClick={() => onReject(r)}
                                        >
                                            Remove
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
            <div className="space-y-3 md:hidden">
                {rows.map((r) => (
                    <div
                        key={r.canvas_user.external_user_id}
                        className={cn(
                            'rounded-lg border border-gray-200 p-3',
                            highlightRowClass(
                                r.canvas_user.external_user_id,
                                highlightedIds
                            )
                        )}
                    >
                        <div className="font-medium text-brand-dark">
                            {formatCanvasUser(r.canvas_user)}
                        </div>
                        <div className="mt-1 text-sm text-gray-600">
                            Suggested: {formatResident(r.suggested_user)}
                        </div>
                        <div className="mt-2 text-xs text-muted-foreground">
                            {Math.round(r.score * 100)}% match
                        </div>
                        <div className="mt-3 flex flex-col items-stretch gap-2">
                            {r.suggested_user ? (
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="brand"
                                    onClick={() => onConfirm(r)}
                                >
                                    Confirm
                                </Button>
                            ) : null}
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => onLinkExisting(r.canvas_user)}
                            >
                                Link existing
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="text-muted-foreground hover:text-destructive"
                                onClick={() => onReject(r)}
                            >
                                Remove
                            </Button>
                        </div>
                    </div>
                ))}
            </div>
        </>
    );
}

function UnmatchedTable({
    rows,
    unmatchedToCreate,
    highlightedIds,
    onCreate,
    onUndoCreate,
    onLinkExisting
}: {
    rows: ProviderUser[];
    unmatchedToCreate: Set<string>;
    highlightedIds: Set<string>;
    onCreate: (externalUserId: string) => void;
    onUndoCreate: (externalUserId: string) => void;
    onLinkExisting: (user: ProviderUser) => void;
}) {
    const renderQueuedStatus = (externalUserId: string) => (
        <div className="flex flex-wrap items-center justify-end gap-2">
            <span className="inline-flex items-center gap-1.5 text-sm text-green-700">
                <CheckCircle2 className="size-4 shrink-0 text-green-600" />
                Queued to create
            </span>
            <Button
                type="button"
                size="sm"
                variant="ghost"
                className="text-muted-foreground hover:text-brand-dark"
                onClick={() => onUndoCreate(externalUserId)}
            >
                <Undo2 className="size-4" />
                Undo
            </Button>
        </div>
    );

    const renderActions = (user: ProviderUser) => {
        if (unmatchedToCreate.has(user.external_user_id)) {
            return renderQueuedStatus(user.external_user_id);
        }

        return (
            <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-end">
                <Button
                    type="button"
                    size="sm"
                    variant="brand"
                    className="sm:min-w-[5.5rem]"
                    onClick={() => onCreate(user.external_user_id)}
                >
                    Create
                </Button>
                <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="sm:min-w-[5.5rem]"
                    onClick={() => onLinkExisting(user)}
                >
                    Link existing
                </Button>
            </div>
        );
    };

    const rowClassName = (externalUserId: string) =>
        cn(
            'transition-colors hover:bg-muted/50',
            unmatchedToCreate.has(externalUserId) &&
                'bg-muted/30 text-muted-foreground'
        );

    return (
        <>
            <div className="hidden md:block">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="pl-0">Canvas user</TableHead>
                            <TableHead>Username</TableHead>
                            <TableHead className="text-right pr-0">
                                Action
                            </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {rows.map((u) => {
                            const queued = unmatchedToCreate.has(
                                u.external_user_id
                            );
                            return (
                                <TableRow
                                    key={u.external_user_id}
                                    className={cn(
                                        rowClassName(u.external_user_id),
                                        highlightRowClass(
                                            u.external_user_id,
                                            highlightedIds
                                        )
                                    )}
                                >
                                    <TableCell
                                        className={cn(
                                            'pl-0 font-medium',
                                            queued
                                                ? 'text-muted-foreground'
                                                : 'text-brand-dark'
                                        )}
                                    >
                                        {formatCanvasUser(u)}
                                    </TableCell>
                                    <TableCell className="text-muted-foreground">
                                        {u.username}
                                    </TableCell>
                                    <TableCell className="text-right pr-0">
                                        {renderActions(u)}
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </div>
            <div className="space-y-3 md:hidden">
                {rows.map((u) => {
                    const queued = unmatchedToCreate.has(u.external_user_id);
                    return (
                        <div
                            key={u.external_user_id}
                            className={cn(
                                'rounded-lg border border-gray-200 p-3 transition-colors',
                                queued && 'bg-muted/30',
                                highlightRowClass(
                                    u.external_user_id,
                                    highlightedIds
                                )
                            )}
                        >
                            <div
                                className={cn(
                                    'font-medium',
                                    queued
                                        ? 'text-muted-foreground'
                                        : 'text-brand-dark'
                                )}
                            >
                                {formatCanvasUser(u)}
                            </div>
                            <div className="mt-1 text-sm text-muted-foreground">
                                {u.username}
                            </div>
                            <div className="mt-3">{renderActions(u)}</div>
                        </div>
                    );
                })}
            </div>
        </>
    );
}

function LinkedResidentsTable({
    entries,
    highlightedIds,
    appliedFlashIds,
    applySubmitting,
    onUnlink
}: {
    entries: LinkedResidentEntry[];
    highlightedIds: Set<string>;
    appliedFlashIds: Set<string>;
    applySubmitting: boolean;
    onUnlink: (user: User) => void;
}) {
    const statusBadge = (entry: LinkedResidentEntry) => {
        if (entry.externalUserId && appliedFlashIds.has(entry.externalUserId)) {
            return (
                <Badge
                    variant="outline"
                    className="ml-2 bg-green-50 text-green-700 border-green-200"
                >
                    Applied
                </Badge>
            );
        }
        if (entry.isPending && applySubmitting) {
            return (
                <Badge variant="outline" className="ml-2 badge-amber border">
                    Applying…
                </Badge>
            );
        }
        if (entry.isPending) {
            return (
                <Badge
                    variant="outline"
                    className="ml-2 bg-green-50 text-green-700 border-green-200"
                >
                    Pending apply
                </Badge>
            );
        }
        return null;
    };

    return (
        <>
            <div className="hidden md:block">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="pl-0">Canvas user</TableHead>
                            <TableHead>Resident</TableHead>
                            <TableHead>Username</TableHead>
                            <TableHead className="text-right pr-0">
                                Action
                            </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {entries.map((entry) => (
                            <TableRow
                                key={entry.key}
                                className={cn(
                                    'transition-colors hover:bg-muted/50',
                                    entry.isPending &&
                                        applySubmitting &&
                                        'opacity-60',
                                    entry.isPending &&
                                        highlightRowClass(
                                            entry.externalUserId ??
                                                entry.key.replace(
                                                    'pending-',
                                                    ''
                                                ),
                                            highlightedIds
                                        )
                                )}
                            >
                                <TableCell className="pl-0 font-medium text-brand-dark">
                                    {entry.canvasLabel}
                                </TableCell>
                                <TableCell>
                                    <span className="font-medium text-brand-dark">
                                        {entry.residentName}
                                    </span>
                                    {statusBadge(entry)}
                                </TableCell>
                                <TableCell className="text-muted-foreground">
                                    {entry.residentUsername}
                                </TableCell>
                                <TableCell className="text-right pr-0">
                                    {entry.mappedUser ? (
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() =>
                                                onUnlink(entry.mappedUser!)
                                            }
                                            className="text-destructive hover:text-destructive"
                                        >
                                            <LinkSlashIcon className="size-4" />
                                            Unlink
                                        </Button>
                                    ) : null}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
            <div className="space-y-3 md:hidden">
                {entries.map((entry) => (
                    <div
                        key={entry.key}
                        className={cn(
                            'rounded-lg border border-gray-200 p-3',
                            entry.isPending && applySubmitting && 'opacity-60',
                            entry.isPending &&
                                highlightRowClass(
                                    entry.externalUserId ??
                                        entry.key.replace('pending-', ''),
                                    highlightedIds
                                )
                        )}
                    >
                        <div className="text-xs text-muted-foreground">
                            Canvas: {entry.canvasLabel}
                        </div>
                        <div className="mt-1 font-medium text-brand-dark">
                            {entry.residentName}
                            {statusBadge(entry)}
                        </div>
                        <div className="mt-1 text-sm text-muted-foreground">
                            {entry.residentUsername}
                        </div>
                        {entry.mappedUser ? (
                            <Button
                                size="sm"
                                variant="ghost"
                                className="mt-2 text-destructive hover:text-destructive"
                                onClick={() => onUnlink(entry.mappedUser!)}
                            >
                                <LinkSlashIcon className="size-4" />
                                Unlink
                            </Button>
                        ) : null}
                    </div>
                ))}
            </div>
        </>
    );
}
