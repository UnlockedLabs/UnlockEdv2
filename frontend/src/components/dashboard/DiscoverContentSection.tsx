import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, BookOpen, ExternalLink, Star, Video } from 'lucide-react';
import { HelpfulLink, OpenContentItem, ServerResponseOne } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import API from '@/api/api';

// -----------------------------------------------------------------------------
// Discover section — Scenario A (Knowledge Center enabled) only
// -----------------------------------------------------------------------------

export interface DiscoverContentItem {
    id: string;
    title: string;
    description: string | null;
    contentType: string;
    href: string;
    external?: boolean;
    thumbnailUrl?: string | null;
    /** Set for helpful links so clicks can be tracked before opening externally. */
    helpfulLinkId?: number;
}

export interface DiscoverContentSectionProps {
    /** Scenario A — entire section renders only when true (Knowledge Center enabled). */
    scenarioA: boolean;
    /** Emphasize the primary discover grid for first-time residents. */
    isNewResident: boolean;
    /** Curated discover items (3–4 max); primary Tier 2 content. */
    discoverItems: DiscoverContentItem[];
    /**
     * Admin-flagged items for this resident; Tier 3 — minimal pointer only.
     * Can be relocated into the Knowledge Center and omitted from the homepage.
     */
    flaggedContent: DiscoverContentItem[];
    /** Helpful links merged into the discover content grid. */
    helpfulLinks: HelpfulLink[];
}

const PREVIEW_DISCOVER_ITEMS: DiscoverContentItem[] = [
    {
        id: 'preview-ged-prep',
        title: 'GED Prep Basics',
        description: 'Study guides and practice for your high school equivalency exam.',
        contentType: 'library',
        href: '/knowledge-center'
    },
    {
        id: 'preview-job-search',
        title: 'Job Search 101',
        description: 'Tips for resumes, interviews, and finding work after release.',
        contentType: 'video',
        href: '/knowledge-center'
    },
    {
        id: 'preview-financial',
        title: 'Financial Literacy',
        description: 'Budgeting, banking, and building credit on the outside.',
        contentType: 'library',
        href: '/knowledge-center'
    },
    {
        id: 'preview-wellness',
        title: 'Health & Wellness',
        description: 'Short videos on stress, sleep, and staying healthy.',
        contentType: 'video',
        href: '/knowledge-center'
    }
];

function openContentKey(item: Pick<OpenContentItem, 'content_id' | 'content_type'>) {
    return `${item.content_type}-${item.content_id}`;
}

function resolveContentHref(item: OpenContentItem): {
    href: string;
    external: boolean;
} {
    if (item.content_type === 'video') {
        return {
            href: `/viewer/videos/${item.content_id}`,
            external: false
        };
    }
    if (item.content_type === 'library') {
        return {
            href: `/viewer/libraries/${item.content_id}`,
            external: false
        };
    }
    return { href: item.url, external: true };
}

export function mapOpenContentToDiscoverItems(
    items: OpenContentItem[],
    max = 4
): DiscoverContentItem[] {
    return items.slice(0, max).map((item) => {
        const { href, external } = resolveContentHref(item);
        return {
            id: openContentKey(item),
            title: item.title,
            description: item.description?.trim() || item.provider_name?.trim() || null,
            contentType: item.content_type,
            href,
            external,
            thumbnailUrl: item.thumbnail_url
        };
    });
}

function mapHelpfulLinksToDiscoverItems(links: HelpfulLink[]): DiscoverContentItem[] {
    return links.map((link) => ({
        id: `helpful-link-${link.id}`,
        title: link.title,
        description: link.description?.trim() || null,
        contentType: 'helpful_link',
        href: link.url,
        external: true,
        thumbnailUrl: link.thumbnail_url || null,
        helpfulLinkId: link.id
    }));
}

function ContentThumbnail({
    item,
    className
}: {
    item: DiscoverContentItem;
    className?: string;
}) {
    if (item.thumbnailUrl) {
        return (
            <img
                src={item.thumbnailUrl}
                alt=""
                className={cn('size-10 shrink-0 rounded object-cover', className)}
            />
        );
    }

    const Icon =
        item.contentType === 'video'
            ? Video
            : item.contentType === 'helpful_link'
              ? ExternalLink
              : BookOpen;

    return (
        <div
            className={cn(
                'flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted',
                className
            )}
        >
            <Icon
                className="size-5 text-[#556830] dark:text-primary"
                aria-hidden
            />
        </div>
    );
}

function DiscoverContentCard({ item }: { item: DiscoverContentItem }) {
    const navigate = useNavigate();

    const handleClick = async () => {
        if (item.helpfulLinkId != null) {
            const resp = (await API.put<{ url: string }, object>(
                `helpful-links/activity/${item.helpfulLinkId}`,
                {}
            )) as ServerResponseOne<{ url: string }>;
            const url = resp.success && resp.data?.url ? resp.data.url : item.href;
            window.open(url, '_blank', 'noopener,noreferrer');
            return;
        }
        if (item.external) {
            window.open(item.href, '_blank', 'noopener,noreferrer');
            return;
        }
        navigate(item.href);
    };

    return (
        <button
            type="button"
            onClick={() => void handleClick()}
            className={cn(
                'flex w-full items-start gap-3 rounded-lg border border-border bg-card p-3 text-left',
                'transition-shadow hover:shadow-md',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
            )}
        >
            <ContentThumbnail item={item} />
            <div className="min-w-0 flex-1 space-y-0.5">
                <p className="text-sm font-medium text-foreground line-clamp-2">
                    {item.title}
                </p>
                {item.description ? (
                    <p className="text-xs leading-relaxed text-muted-foreground line-clamp-2">
                        {item.description}
                    </p>
                ) : null}
            </div>
        </button>
    );
}

/**
 * Tier 2/3 Knowledge Center discovery — subordinate to Learning Records.
 * Renders nothing in Scenario B or when all sub-sections lack data.
 */
export default function DiscoverContentSection({
    scenarioA,
    isNewResident,
    discoverItems,
    flaggedContent,
    helpfulLinks
}: DiscoverContentSectionProps) {
    /** Design preview when API data is empty — replaced by live data when available. */
    const displayDiscoverItems =
        discoverItems.length > 0 ? discoverItems : PREVIEW_DISCOVER_ITEMS;

    /** Show admin-flagged pointer only when flagged items exist. */
    const hasFlaggedContent = flaggedContent.length > 0;

    const helpfulLinkItems = mapHelpfulLinksToDiscoverItems(helpfulLinks);
    const hasHelpfulLinks = helpfulLinkItems.length > 0;

    const hasDiscoverContent = displayDiscoverItems.length > 0;

    if (!scenarioA) {
        return null;
    }

    if (!hasDiscoverContent && !hasFlaggedContent && !hasHelpfulLinks) {
        return null;
    }

    const usingDiscoverPreview = discoverItems.length === 0;

    const showPrimaryDiscover =
        hasDiscoverContent && (isNewResident || usingDiscoverPreview);

    const showDiscoverCard = showPrimaryDiscover || hasHelpfulLinks;

    return (
        <section
            aria-labelledby="home-discover-content-heading"
            className="space-y-4"
        >
            {showDiscoverCard ? (
                <div className="space-y-3">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <h2
                                id="home-discover-content-heading"
                                className="text-xl font-semibold text-foreground"
                            >
                                Things to explore
                            </h2>
                            <p className="text-sm text-muted-foreground">
                                A few things to look at — go at your own pace.
                            </p>
                        </div>
                        <Link
                            to="/knowledge-center"
                            className="inline-flex shrink-0 items-center gap-1 text-sm text-[#556830] hover:underline"
                        >
                            Go to the Knowledge Center
                            <ArrowRight className="size-4" aria-hidden />
                        </Link>
                    </div>

                    <Card className="border border-gray-200 p-0 shadow-sm dark:border-border">
                        <CardContent className="grid gap-3 p-4 sm:grid-cols-2">
                            {showPrimaryDiscover
                                ? displayDiscoverItems.map((item) => (
                                      <DiscoverContentCard key={item.id} item={item} />
                                  ))
                                : null}
                            {hasHelpfulLinks ? (
                                <h3 className="col-span-full text-sm font-semibold text-foreground">
                                    Helpful Links
                                </h3>
                            ) : null}
                            {helpfulLinkItems.map((item) => (
                                <DiscoverContentCard key={item.id} item={item} />
                            ))}
                        </CardContent>
                    </Card>
                    {usingDiscoverPreview && showPrimaryDiscover ? (
                        <p className="sr-only">Showing sample discover content</p>
                    ) : null}
                </div>
            ) : (
                <div className="sr-only" id="home-discover-content-heading">
                    Things to explore
                </div>
            )}

            {/*
             * Admin-flagged pointer — lowest priority; relocate into Knowledge Center
             * when a dedicated flagged feed exists there.
             */}
            {hasFlaggedContent ? (
                <Card className="border border-border/70 bg-muted/30 p-0 shadow-none">
                    <CardContent className="flex items-center justify-between gap-3 px-4 py-3">
                        <div className="flex min-w-0 items-center gap-2">
                            <Star
                                className="size-4 shrink-0 text-[#F1B51C]"
                                aria-hidden
                            />
                            <p className="truncate text-sm text-muted-foreground">
                                Flagged for you:{' '}
                                <span className="font-medium text-foreground">
                                    {flaggedContent[0]?.title}
                                </span>
                                {flaggedContent.length > 1
                                    ? ` +${flaggedContent.length - 1} more`
                                    : null}
                            </p>
                        </div>
                        <Link
                            to="/knowledge-center"
                            className="inline-flex shrink-0 items-center gap-0.5 text-xs text-[#556830] hover:underline"
                        >
                            View
                            <ArrowRight className="size-3.5" aria-hidden />
                        </Link>
                    </CardContent>
                </Card>
            ) : null}
        </section>
    );
}

export function buildDiscoverSectionData(
    topUserContent: OpenContentItem[],
    topFacilityContent: OpenContentItem[],
    flaggedContent: OpenContentItem[] = []
) {
    const continueKeys = new Set(topUserContent.map(openContentKey));
    const excludeKeys = (item: OpenContentItem) => !continueKeys.has(openContentKey(item));

    const discoverSource = topFacilityContent.filter(excludeKeys);
    const discoverItems = mapOpenContentToDiscoverItems(discoverSource, 4);

    const flaggedItems = mapOpenContentToDiscoverItems(flaggedContent, 3);

    return { discoverItems, flaggedContent: flaggedItems };
}
