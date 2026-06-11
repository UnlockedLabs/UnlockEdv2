import { useNavigate } from 'react-router-dom';
import { BookOpen, Video } from 'lucide-react';
import { OpenContentItem } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export interface ContinueLearningItem {
    id: string;
    title: string;
    statusLabel: string;
    contentType: string;
    contentTypeLabel: string;
    durationLabel?: string;
    progressPercent: number;
    href: string;
    external?: boolean;
    thumbnailUrl?: string | null;
}

const PREVIEW_ITEMS: ContinueLearningItem[] = [
    {
        id: 'preview-resume-writing',
        title: 'Resume Writing Basics',
        statusLabel: 'Your progress',
        contentType: 'video',
        contentTypeLabel: 'Video',
        durationLabel: '12 min',
        progressPercent: 60,
        href: '/knowledge-center'
    },
    {
        id: 'preview-interview-skills',
        title: 'Interview Skills',
        statusLabel: 'Not started yet',
        contentType: 'library',
        contentTypeLabel: 'Article',
        durationLabel: '8 min',
        progressPercent: 0,
        href: '/knowledge-center'
    }
];

function contentTypeLabel(contentType: string): string {
    switch (contentType) {
        case 'video':
            return 'Video';
        case 'library':
            return 'Article';
        case 'helpful_link':
            return 'Link';
        default:
            return 'Resource';
    }
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

export function mapOpenContentToContinueItems(
    items: OpenContentItem[]
): ContinueLearningItem[] {
    return items.slice(0, 2).map((item, index) => {
        const { href, external } = resolveContentHref(item);
        return {
            id: `${item.content_id}-${item.content_type}`,
            title: item.title,
            statusLabel: index === 0 ? 'Your progress' : 'Not started yet',
            contentType: item.content_type,
            contentTypeLabel: contentTypeLabel(item.content_type),
            progressPercent: 0,
            href,
            external,
            thumbnailUrl: item.thumbnail_url
        };
    });
}

function ContentThumbnail({ item }: { item: ContinueLearningItem }) {
    if (item.thumbnailUrl) {
        return (
            <img
                src={item.thumbnailUrl}
                alt=""
                className="size-10 shrink-0 rounded object-cover"
            />
        );
    }

    const Icon = item.contentType === 'video' ? Video : BookOpen;

    return (
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
            <Icon
                className="size-5 text-[#556830] dark:text-primary"
                aria-hidden
            />
        </div>
    );
}

function ContinueLearningRow({ item }: { item: ContinueLearningItem }) {
    const navigate = useNavigate();
    const metaLabel = item.durationLabel
        ? `${item.contentTypeLabel} · ${item.durationLabel}`
        : item.contentTypeLabel;
    const clampedProgress = Math.min(100, Math.max(0, item.progressPercent));

    const handleClick = () => {
        if (item.external) {
            window.open(item.href, '_blank', 'noopener,noreferrer');
            return;
        }
        navigate(item.href);
    };

    return (
        <button
            type="button"
            onClick={handleClick}
            className={cn(
                'w-full rounded-lg border border-border bg-card p-3 text-left',
                'transition-shadow hover:shadow-md',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
            )}
        >
            <div className="flex items-start gap-3">
                <ContentThumbnail item={item} />
                <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-medium text-foreground line-clamp-2">
                            {item.title}
                        </p>
                        <span className="shrink-0 text-xs text-muted-foreground">
                            {metaLabel}
                        </span>
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-3">
                        <p className="text-xs text-muted-foreground">
                            {item.statusLabel}
                        </p>
                        {!(
                            item.statusLabel === 'Not started yet' &&
                            clampedProgress === 0
                        ) ? (
                            <span className="text-xs tabular-nums text-muted-foreground">
                                {clampedProgress}%
                            </span>
                        ) : null}
                    </div>
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div
                            className="h-full rounded-full bg-[#556830] dark:bg-primary"
                            style={{ width: `${clampedProgress}%` }}
                        />
                    </div>
                </div>
            </div>
        </button>
    );
}

export interface ContinueLearningSectionProps {
    items: ContinueLearningItem[];
}

export default function ContinueLearningSection({
    items
}: ContinueLearningSectionProps) {
    const displayItems = items.length > 0 ? items : PREVIEW_ITEMS;

    return (
        <section
            aria-labelledby="home-continue-learning-heading"
            className="space-y-3"
            id="popular-content"
        >
            <div>
                <h2
                    id="home-continue-learning-heading"
                    className="text-xl font-semibold text-foreground"
                >
                    Continue learning
                </h2>
                <p className="text-sm text-muted-foreground">
                    Keep going
                </p>
            </div>

            <Card
                className="border border-gray-200 p-0 shadow-sm dark:border-border"
                id="end-tour"
            >
                <CardContent className="space-y-3 p-4">
                    {displayItems.map((item) => (
                        <ContinueLearningRow key={item.id} item={item} />
                    ))}
                </CardContent>
            </Card>
        </section>
    );
}
