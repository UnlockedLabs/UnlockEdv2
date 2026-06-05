import { useEffect, useState } from 'react';
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
} from '@/types';
import API from '@/api/api';
import { PageHeader } from '@/components/shared/PageHeader';
import { FormModal } from '@/components/shared/FormModal';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { ArrowPathIcon, ChevronLeftIcon, LinkSlashIcon } from '@heroicons/react/24/outline';

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
    const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
    const [mapSearch, setMapSearch] = useState('');
    const [mapSubmitting, setMapSubmitting] = useState(false);
    const [applySubmitting, setApplySubmitting] = useState(false);
    const [removedConfirmed, setRemovedConfirmed] = useState<Set<string>>(new Set());
    const [ambiguousSelections, setAmbiguousSelections] = useState<Record<string, number>>({});
    const [unmatchedToCreate, setUnmatchedToCreate] = useState<Set<string>>(new Set());
    const [userToUnlink, setUserToUnlink] = useState<User | null>(null);

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
    >(providerId ? `/api/provider-platforms/${providerId}/mapped-users?per_page=50` : null);
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

    const handleApplyMatches = async () => {
        if (!matchState) return;
        setApplySubmitting(true);

        const confirmed: ConfirmedMatch[] = [
            ...matchState.auto_confirmed
                .filter((r) => !removedConfirmed.has(r.canvas_user.external_user_id))
                .map((r) => ({
                    canvas_user: r.canvas_user,
                    unlocked_user_id: r.suggested_user!.id,
                })),
            ...matchState.ambiguous
                .filter((r) => ambiguousSelections[r.canvas_user.external_user_id] != null)
                .map((r) => ({
                    canvas_user: r.canvas_user,
                    unlocked_user_id: ambiguousSelections[r.canvas_user.external_user_id],
                })),
        ];

        const toCreate: ProviderUser[] = matchState.unmatched.filter((u) =>
            unmatchedToCreate.has(u.external_user_id)
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
                toast.error(`Some users failed: ${data.failed.join(', ')}`);
            } else {
                toast.success(
                    `Applied ${data.applied} mappings, created ${data.created} users.`
                );
            }
            setRemovedConfirmed(new Set());
            setAmbiguousSelections({});
            setUnmatchedToCreate(new Set());
            void mutateMatch();
        } else {
            toast.error('Failed to apply matches.');
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
            window.location.reload();
        } else {
            toast.error('Error importing users.');
        }
        setShowImportAllConfirm(false);
    };

    const handleMapUser = async () => {
        if (!userToMap || selectedUserId === null) return;
        setMapSubmitting(true);
        const res = await API.post(
            `provider-platforms/${providerId}/map-user/${selectedUserId}`,
            userToMap
        );
        setMapSubmitting(false);
        if (res.success) {
            toast.success('User mapped successfully.');
            setShowMapModal(false);
            setUserToMap(undefined);
            setSelectedUserId(null);
            setMapSearch('');
            void mutateMatch();
            void mutateUnmapped();
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
            toast.success(`${userToUnlink.name_first} ${userToUnlink.name_last} unlinked.`);
            setUserToUnlink(null);
            void mutateMapped();
            void mutateMatch();
        } else {
            toast.error('Failed to unlink user.');
        }
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
                    <div className="bg-card rounded-lg border border-border p-8 text-center">
                        <p className="text-muted-foreground">
                            Kolibri users are managed automatically.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-[#E2E7EA] min-h-screen p-6">
            <div className="max-w-7xl mx-auto space-y-6">
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <button
                        onClick={() =>
                            navigate(`/learning-platforms/${providerId}`)
                        }
                        className="flex items-center gap-1 hover:text-foreground transition-colors"
                    >
                        <ChevronLeftIcon className="size-4" />
                        {provider?.name ?? 'Learning Platform'}
                    </button>
                </div>
                <PageHeader
                    title={provider?.name ?? 'Provider Users'}
                    subtitle="Manage and import users from the external platform"
                />

                <div className="flex justify-end gap-2">
                    <Button
                        variant="outline"
                        onClick={() => void mutateMatch()}
                        disabled={matchLoading}
                        className="text-foreground border-border"
                    >
                        <ArrowPathIcon className="size-4 mr-1" />
                        {matchLoading ? 'Matching...' : 'Refresh'}
                    </Button>
                    <Button
                        variant="outline"
                        onClick={() => setShowImportAllConfirm(true)}
                        disabled={!provider}
                        className="text-foreground border-border"
                    >
                        Import All Users
                    </Button>
                </div>

                {matchState && (
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-3">
                        <div className="flex flex-wrap gap-2 text-sm">
                            <span className="rounded-full bg-green-100 px-3 py-1 font-medium text-green-800">
                                ✓ Auto-matched:{' '}
                                {matchState.auto_confirmed.length -
                                    removedConfirmed.size}
                            </span>
                            <span className="rounded-full bg-yellow-100 px-3 py-1 font-medium text-yellow-800">
                                ~ Needs review: {matchState.ambiguous.length}
                            </span>
                            <span className="rounded-full bg-red-100 px-3 py-1 font-medium text-red-800">
                                ✗ Unmatched: {matchState.unmatched.length}
                            </span>
                        </div>
                        <div className="flex gap-2">
                            <Button
                                onClick={() => void handleApplyMatches()}
                                disabled={
                                    applySubmitting ||
                                    (matchState.auto_confirmed.length -
                                        removedConfirmed.size ===
                                        0 &&
                                        Object.keys(ambiguousSelections)
                                            .length === 0 &&
                                        unmatchedToCreate.size === 0)
                                }
                                className="bg-[#203622] text-white hover:bg-[#203622]/90"
                            >
                                {applySubmitting
                                    ? 'Applying...'
                                    : 'Apply Matches'}
                            </Button>
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
                        {/* Section A: Auto-confirmed */}
                        <details className="rounded-lg border border-green-200 bg-green-50">
                            <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium text-green-800">
                                ✓ Auto-confirmed (
                                {matchState.auto_confirmed.length -
                                    removedConfirmed.size}{' '}
                                matches) — click to review
                            </summary>
                            <div className="border-t border-green-200">
                                {matchState.auto_confirmed.length === 0 ? (
                                    <p className="p-4 text-sm text-muted-foreground">
                                        No auto-confirmed matches.
                                    </p>
                                ) : (
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b border-green-200 text-left text-xs text-green-700">
                                                <th className="px-4 py-2">
                                                    Canvas user
                                                </th>
                                                <th className="px-4 py-2"></th>
                                                <th className="px-4 py-2">
                                                    UnlockEd user
                                                </th>
                                                <th className="px-4 py-2 text-right">
                                                    Score
                                                </th>
                                                <th className="px-4 py-2"></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {matchState.auto_confirmed.map(
                                                (r) => {
                                                    const removed =
                                                        removedConfirmed.has(
                                                            r.canvas_user
                                                                .external_user_id
                                                        );
                                                    return (
                                                        <tr
                                                            key={
                                                                r.canvas_user
                                                                    .external_user_id
                                                            }
                                                            className={`border-b border-green-100 last:border-b-0 ${removed ? 'opacity-40 line-through' : ''}`}
                                                        >
                                                            <td className="px-4 py-2 font-medium text-foreground">
                                                                {
                                                                    r.canvas_user
                                                                        .name_first
                                                                }{' '}
                                                                {
                                                                    r.canvas_user
                                                                        .name_last
                                                                }
                                                            </td>
                                                            <td className="px-4 py-2 text-muted-foreground">
                                                                →
                                                            </td>
                                                            <td className="px-4 py-2 text-foreground">
                                                                {
                                                                    r.suggested_user
                                                                        ?.name_first
                                                                }{' '}
                                                                {
                                                                    r.suggested_user
                                                                        ?.name_last
                                                                }
                                                            </td>
                                                            <td className="px-4 py-2 text-right text-muted-foreground">
                                                                {Math.round(
                                                                    r.score *
                                                                        100
                                                                )}
                                                                %
                                                            </td>
                                                            <td className="px-4 py-2 text-right">
                                                                <Button
                                                                    size="sm"
                                                                    variant="ghost"
                                                                    onClick={() =>
                                                                        setRemovedConfirmed(
                                                                            (
                                                                                prev
                                                                            ) => {
                                                                                const next =
                                                                                    new Set(
                                                                                        prev
                                                                                    );
                                                                                if (
                                                                                    next.has(
                                                                                        r.canvas_user.external_user_id
                                                                                    )
                                                                                ) {
                                                                                    next.delete(
                                                                                        r.canvas_user.external_user_id
                                                                                    );
                                                                                } else {
                                                                                    next.add(
                                                                                        r.canvas_user.external_user_id
                                                                                    );
                                                                                }
                                                                                return next;
                                                                            }
                                                                        )
                                                                    }
                                                                    className="text-xs text-muted-foreground hover:text-destructive"
                                                                >
                                                                    {removed
                                                                        ? 'Undo'
                                                                        : '✕ Remove'}
                                                                </Button>
                                                            </td>
                                                        </tr>
                                                    );
                                                }
                                            )}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </details>

                        {/* Section B: Needs review */}
                        <div className="rounded-lg border border-yellow-200 bg-yellow-50">
                            <div className="flex items-center justify-between px-4 py-3">
                                <span className="text-sm font-medium text-yellow-800">
                                    ~ Needs review ({matchState.ambiguous.length})
                                </span>
                                {matchState.ambiguous.length > 0 && (
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() =>
                                            setAmbiguousSelections(
                                                Object.fromEntries(
                                                    matchState.ambiguous
                                                        .filter((r) => r.suggested_user)
                                                        .map((r) => [
                                                            r.canvas_user.external_user_id,
                                                            r.suggested_user!.id,
                                                        ])
                                                )
                                            )
                                        }
                                        className="text-yellow-800 border-yellow-400 bg-yellow-100 hover:bg-yellow-200"
                                    >
                                        Confirm All
                                    </Button>
                                )}
                            </div>
                            <div className="border-t border-yellow-200">
                                {matchState.ambiguous.length === 0 ? (
                                    <p className="p-4 text-sm text-muted-foreground">
                                        No ambiguous matches.
                                    </p>
                                ) : (
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b border-yellow-200 text-left text-xs text-yellow-700">
                                                <th className="px-4 py-2">
                                                    Canvas user
                                                </th>
                                                <th className="px-4 py-2">
                                                    Suggested match
                                                </th>
                                                <th className="px-4 py-2 text-right">
                                                    Score
                                                </th>
                                                <th className="px-4 py-2 text-right">
                                                    Action
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {matchState.ambiguous.map((r) => {
                                                const confirmed =
                                                    ambiguousSelections[
                                                        r.canvas_user
                                                            .external_user_id
                                                    ] != null;
                                                return (
                                                    <tr
                                                        key={
                                                            r.canvas_user
                                                                .external_user_id
                                                        }
                                                        className="border-b border-yellow-100 last:border-b-0"
                                                    >
                                                        <td className="px-4 py-2 font-medium text-foreground">
                                                            {
                                                                r.canvas_user
                                                                    .name_first
                                                            }{' '}
                                                            {
                                                                r.canvas_user
                                                                    .name_last
                                                            }
                                                        </td>
                                                        <td className="px-4 py-2 text-foreground">
                                                            {r.suggested_user
                                                                ? `${r.suggested_user.name_first} ${r.suggested_user.name_last}`
                                                                : '—'}
                                                        </td>
                                                        <td className="px-4 py-2 text-right text-muted-foreground">
                                                            {Math.round(
                                                                r.score * 100
                                                            )}
                                                            %
                                                        </td>
                                                        <td className="px-4 py-2 text-right">
                                                            <div className="flex justify-end gap-1">
                                                                {r.suggested_user && (
                                                                    <Button
                                                                        size="sm"
                                                                        variant={
                                                                            confirmed
                                                                                ? 'default'
                                                                                : 'outline'
                                                                        }
                                                                        onClick={() =>
                                                                            setAmbiguousSelections(
                                                                                (
                                                                                    prev
                                                                                ) => {
                                                                                    if (
                                                                                        confirmed
                                                                                    ) {
                                                                                        const next =
                                                                                            {
                                                                                                ...prev,
                                                                                            };
                                                                                        delete next[
                                                                                            r.canvas_user.external_user_id
                                                                                        ];
                                                                                        return next;
                                                                                    }
                                                                                    return {
                                                                                        ...prev,
                                                                                        [r.canvas_user
                                                                                            .external_user_id]:
                                                                                            r
                                                                                                .suggested_user!
                                                                                                .id,
                                                                                    };
                                                                                }
                                                                            )
                                                                        }
                                                                        className={
                                                                            confirmed
                                                                                ? 'bg-[#203622] text-white'
                                                                                : 'text-foreground border-border'
                                                                        }
                                                                    >
                                                                        {confirmed
                                                                            ? '✓ Confirmed'
                                                                            : 'Confirm'}
                                                                    </Button>
                                                                )}
                                                                <Button
                                                                    size="sm"
                                                                    variant="ghost"
                                                                    onClick={() => {
                                                                        setUserToMap(
                                                                            r.canvas_user
                                                                        );
                                                                        setSelectedUserId(
                                                                            null
                                                                        );
                                                                        setMapSearch(
                                                                            ''
                                                                        );
                                                                        setShowMapModal(
                                                                            true
                                                                        );
                                                                    }}
                                                                    className="text-foreground border-border"
                                                                >
                                                                    Change
                                                                </Button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </div>

                        {/* Section C: Unmatched */}
                        <div className="rounded-lg border border-red-200 bg-red-50">
                            <div className="px-4 py-3 text-sm font-medium text-red-800">
                                ✗ Unmatched ({matchState.unmatched.length})
                            </div>
                            <div className="border-t border-red-200">
                                {matchState.unmatched.length === 0 ? (
                                    <p className="p-4 text-sm text-muted-foreground">
                                        No unmatched users.
                                    </p>
                                ) : (
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b border-red-200 text-left text-xs text-red-700">
                                                <th className="px-4 py-2">
                                                    Canvas user
                                                </th>
                                                <th className="px-4 py-2">
                                                    Username
                                                </th>
                                                <th className="px-4 py-2 text-right">
                                                    Action
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {matchState.unmatched.map((u) => {
                                                const queued =
                                                    unmatchedToCreate.has(
                                                        u.external_user_id
                                                    );
                                                return (
                                                    <tr
                                                        key={u.external_user_id}
                                                        className="border-b border-red-100 last:border-b-0"
                                                    >
                                                        <td className="px-4 py-2 font-medium text-foreground">
                                                            {u.name_first}{' '}
                                                            {u.name_last}
                                                        </td>
                                                        <td className="px-4 py-2 text-muted-foreground">
                                                            {u.username}
                                                        </td>
                                                        <td className="px-4 py-2 text-right">
                                                            <div className="flex justify-end gap-1">
                                                                <Button
                                                                    size="sm"
                                                                    variant={
                                                                        queued
                                                                            ? 'default'
                                                                            : 'outline'
                                                                    }
                                                                    onClick={() =>
                                                                        setUnmatchedToCreate(
                                                                            (
                                                                                prev
                                                                            ) => {
                                                                                const next =
                                                                                    new Set(
                                                                                        prev
                                                                                    );
                                                                                if (
                                                                                    next.has(
                                                                                        u.external_user_id
                                                                                    )
                                                                                ) {
                                                                                    next.delete(
                                                                                        u.external_user_id
                                                                                    );
                                                                                } else {
                                                                                    next.add(
                                                                                        u.external_user_id
                                                                                    );
                                                                                }
                                                                                return next;
                                                                            }
                                                                        )
                                                                    }
                                                                    className={
                                                                        queued
                                                                            ? 'bg-[#203622] text-white'
                                                                            : 'text-foreground border-border'
                                                                    }
                                                                >
                                                                    {queued
                                                                        ? '✓ Will create'
                                                                        : 'Create resident'}
                                                                </Button>
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline"
                                                                    onClick={() => {
                                                                        setUserToMap(
                                                                            u
                                                                        );
                                                                        setSelectedUserId(
                                                                            null
                                                                        );
                                                                        setMapSearch(
                                                                            ''
                                                                        );
                                                                        setShowMapModal(
                                                                            true
                                                                        );
                                                                    }}
                                                                    className="text-foreground border-border"
                                                                >
                                                                    Select resident
                                                                </Button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </div>
                    </div>
                ) : null}

                {/* Linked Users Section */}
                <div className="rounded-lg border border-border bg-card">
                    <div className="px-4 py-3 text-sm font-medium text-foreground border-b border-border">
                        Linked Residents ({mappedUsers.length})
                    </div>
                    {mappedUsers.length === 0 ? (
                        <p className="p-4 text-sm text-muted-foreground">
                            No residents are currently linked to this platform.
                        </p>
                    ) : (
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                                    <th className="px-4 py-2">Name</th>
                                    <th className="px-4 py-2">Username</th>
                                    <th className="px-4 py-2 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {mappedUsers.map((u) => (
                                    <tr
                                        key={u.id}
                                        className="border-b border-border last:border-b-0"
                                    >
                                        <td className="px-4 py-2 font-medium text-foreground">
                                            {u.name_first} {u.name_last}
                                        </td>
                                        <td className="px-4 py-2 text-muted-foreground">
                                            {u.username}
                                        </td>
                                        <td className="px-4 py-2 text-right">
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => setUserToUnlink(u)}
                                                className="text-destructive hover:text-destructive"
                                            >
                                                <LinkSlashIcon className="size-4 mr-1" />
                                                Unlink
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                <FormModal
                    open={showMapModal}
                    onOpenChange={setShowMapModal}
                    title="Map User"
                    description={`Associate ${userToMap ? `${userToMap.name_first} ${userToMap.name_last}` : ''} with an existing UnlockEd account.`}
                >
                    <div className="space-y-4">
                        <input
                            type="text"
                            value={mapSearch}
                            onChange={(e) => setMapSearch(e.target.value)}
                            placeholder="Search by name or username..."
                            className="w-full rounded-md border border-border px-3 py-2 text-sm"
                        />
                        <div className="max-h-64 overflow-y-auto border rounded-md">
                            {filteredUnmapped.length === 0 ? (
                                <p className="text-sm text-muted-foreground p-3 text-center">
                                    No unmapped users found.
                                </p>
                            ) : (
                                filteredUnmapped.map((u) => (
                                    <div
                                        key={u.id}
                                        onClick={() => setSelectedUserId(u.id)}
                                        className={`flex items-center justify-between px-3 py-2 cursor-pointer text-sm border-b last:border-b-0 ${
                                            selectedUserId === u.id
                                                ? 'bg-[#556830]/10'
                                                : 'hover:bg-[#E2E7EA]'
                                        }`}
                                    >
                                        <div>
                                            <span className="font-medium text-foreground">
                                                {u.name_first} {u.name_last}
                                            </span>
                                            <span className="text-muted-foreground ml-2">
                                                ({u.username})
                                            </span>
                                        </div>
                                        {selectedUserId === u.id && (
                                            <span className="text-[#556830] font-medium text-xs">
                                                Selected
                                            </span>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                            <Button
                                variant="outline"
                                onClick={() => setShowMapModal(false)}
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={() => void handleMapUser()}
                                disabled={
                                    mapSubmitting || selectedUserId === null
                                }
                                className="bg-[#203622] text-white hover:bg-[#203622]/90"
                            >
                                {mapSubmitting ? 'Mapping...' : 'Map User'}
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
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                        {importedUsers.map((u) => (
                            <div
                                key={u.username}
                                className="flex items-center justify-between rounded-md bg-[#E2E7EA] p-3"
                            >
                                <span className="text-sm font-medium text-foreground">
                                    {u.username}
                                </span>
                                <div className="text-right">
                                    {u.error ? (
                                        <span className="text-xs text-red-600">
                                            {u.error}
                                        </span>
                                    ) : (
                                        <span className="text-xs font-mono text-muted-foreground">
                                            {u.temp_password}
                                        </span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="flex justify-end pt-4">
                        <Button
                            onClick={() => {
                                setShowImportedModal(false);
                                setImportedUsers([]);
                            }}
                            className="bg-[#203622] text-white hover:bg-[#203622]/90"
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
                    open={userToUnlink !== null}
                    onOpenChange={(open) => { if (!open) setUserToUnlink(null); }}
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
