import { useState, useMemo, useEffect } from 'react';
import { useUrlPagination } from '@/hooks/useUrlPagination';
import { toExternalUrl } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { useTourContext } from '@/contexts/useTourContext';
import { targetToStepIndexMap } from '@/contexts/tourState';
import useSWR from 'swr';
import { Search, Star, BookOpen, Video, Link as LinkIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger
} from '@/components/ui/tooltip';
import { Pagination } from '@/components/Pagination';
import { useDebounceValue } from 'usehooks-ts';
import {
    Library,
    Video as VideoType,
    HelpfulLinkAndSort,
    ServerResponseMany,
    ServerResponseOne,
    OpenContentItem,
    Option
} from '@/types';
import { formatVideoDuration } from '@/lib/formatters';
import { isAdministrator, useAuth } from '@/auth/useAuth';
import { toast } from 'sonner';
import API from '@/api/api';
import { decodeHtmlEntities } from '@/lib/decodeHtmlEntities';

const ITEMS_PER_PAGE = 20;

interface ContentItem {
    id: number;
    type: 'library' | 'video' | 'link';
    title: string;
    description: string;
    featured: boolean;
    favorited: boolean;
    openContentProviderId?: number;
    imageUrl?: string | null;
    thumbnailUrl?: string | null;
    author?: string;
    duration?: number;
    url?: string;
    categories?: string[];
}

export default function ResidentKnowledgeCenter() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const isAdminPreview = user ? isAdministrator(user) : false;
    const { tourState, setTourState } = useTourContext();
    const [pendingFavorites, setPendingFavorites] = useState<
        Map<string, boolean>
    >(new Map());

    useEffect(() => {
        if (tourState?.tourActive) {
            if (tourState.target === '#visit-knowledge-center') {
                setTourState({
                    stepIndex:
                        targetToStepIndexMap['#knowledge-center-landing'],
                    target: '#knowledge-center-landing'
                });
            }
        }
    }, [tourState, setTourState]);

    const [searchTerm, setSearchTerm] = useState('');
    const [searchQuery] = useDebounceValue(searchTerm, 500);
    const [contentTypeFilter, setContentTypeFilter] = useState<string>('all');
    const [categoryFilter, setCategoryFilter] = useState<string>('all');
    const {
        page: currentPage,
        perPage: itemsPerPage,
        setPage: setCurrentPage,
        setPerPage
    } = useUrlPagination(1, ITEMS_PER_PAGE);

    const { data: tagsData } = useSWR<ServerResponseMany<Option>>('/api/tags');
    const categories = tagsData?.data ?? [];

    const categoryParam =
        categoryFilter !== 'all' ? `&tags=${categoryFilter}` : '';

    const { data: libData } = useSWR<ServerResponseMany<Library>>(
        `/api/libraries?visibility=visible&per_page=500&order_by=title&order=asc&search=${searchQuery}${categoryParam}`
    );

    const { data: vidData } = useSWR<ServerResponseMany<VideoType>>(
        `/api/videos?visibility=visible&per_page=500&order_by=title&order=asc&search=${searchQuery}`
    );

    const { data: linkData } = useSWR<ServerResponseOne<HelpfulLinkAndSort>>(
        `/api/helpful-links?visibility=true&per_page=500&order_by=title&order=asc&search=${searchQuery}`
    );

    const isFavoritesTab = contentTypeFilter === 'favorites';

    const { data: favData, mutate: mutateFavorites } = useSWR<
        ServerResponseMany<OpenContentItem>
    >(
        // Always fetched (like the other tabs) so the Favorites count shows
        // even when the tab isn't active.
        `/api/open-content/favorites?page=1&per_page=500&search=${searchQuery}`
    );

    const favoritesContent: ContentItem[] = useMemo(
        () =>
            (favData?.data ?? []).map((f) => ({
                id: f.content_id,
                type:
                    f.content_type === 'helpful_link'
                        ? ('link' as const)
                        : (f.content_type as 'library' | 'video'),
                title: f.title,
                description: f.description ?? '',
                featured: false,
                favorited: true,
                openContentProviderId: f.open_content_provider_id,
                imageUrl:
                    f.content_type === 'library' ? f.thumbnail_url : undefined,
                thumbnailUrl:
                    f.content_type === 'video'
                        ? `/api/photos/${f.external_id}.jpg`
                        : undefined,
                author: f.channel_title,
                url: f.url
            })),
        [favData?.data]
    );

    const allContent: ContentItem[] = useMemo(() => {
        const libs: ContentItem[] = (libData?.data ?? []).map((lib) => ({
            id: lib.id,
            type: 'library' as const,
            title: lib.title,
            description: lib.description ?? '',
            featured: !!lib.is_featured,
            favorited: lib.is_favorited,
            openContentProviderId: lib.open_content_provider_id,
            imageUrl: lib.thumbnail_url,
            url: lib.url,
            categories: lib.tags ?? []
        }));

        const vids: ContentItem[] = (vidData?.data ?? [])
            .filter(
                (vid) =>
                    vid.availability === 'available' && vid.visibility_status
            )
            .map((vid) => ({
                id: vid.id,
                type: 'video' as const,
                title: vid.title,
                description: vid.description,
                featured: !!vid.is_featured,
                favorited: vid.is_favorited,
                thumbnailUrl: `/api/photos/${vid.external_id}.jpg`,
                author: vid.channel_title,
                duration: vid.duration
            }));

        const links: ContentItem[] = (linkData?.data?.helpful_links ?? []).map(
            (link) => ({
                id: link.id,
                type: 'link' as const,
                title: link.title,
                description: link.description,
                featured: !!link.is_featured,
                favorited: link.is_favorited,
                url: link.url
            })
        );

        return [...libs, ...vids, ...links];
    }, [libData?.data, vidData?.data, linkData?.data?.helpful_links]);

    const filteredContent = useMemo(() => {
        if (isFavoritesTab) {
            // Favorites are cross-type and returned in server order
            // (most recent first); no content-type/category filtering.
            return favoritesContent;
        }
        return allContent
            .filter((item) => {
                if (
                    contentTypeFilter !== 'all' &&
                    item.type !== contentTypeFilter
                ) {
                    return false;
                }
                if (categoryFilter !== 'all' && item.type !== 'library') {
                    return false;
                }
                return true;
            })
            .sort((a, b) => {
                if (a.featured && !b.featured) return -1;
                if (!a.featured && b.featured) return 1;
                return a.title.localeCompare(b.title);
            });
    }, [
        isFavoritesTab,
        favoritesContent,
        allContent,
        contentTypeFilter,
        categoryFilter
    ]);

    const paginatedContent = filteredContent.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    const counts = useMemo(
        () => ({
            all: allContent.length,
            library: allContent.filter((i) => i.type === 'library').length,
            video: allContent.filter((i) => i.type === 'video').length,
            link: allContent.filter((i) => i.type === 'link').length
        }),
        [allContent]
    );

    const handleLinkClick = async (link: ContentItem) => {
        const resp = await API.put<{ url: string }, object>(
            `helpful-links/activity/${link.id}`,
            {}
        );
        if (resp.success && resp.data) {
            window.open(
                toExternalUrl((resp.data as { url: string }).url ?? link.url),
                '_blank'
            );
        } else {
            window.open(toExternalUrl(link.url ?? ''), '_blank');
        }
    };

    const handleToggleFavorite = async (item: ContentItem) => {
        const key = `${item.type}-${item.id}`;
        const current = pendingFavorites.has(key)
            ? pendingFavorites.get(key)!
            : item.favorited;
        const next = !current;

        setPendingFavorites((prev) => {
            const m = new Map(prev);
            m.set(key, next);
            return m;
        });

        let endpoint = '';
        let payload: object = {};
        if (item.type === 'video') {
            endpoint = `videos/${item.id}/favorite`;
        } else if (item.type === 'link') {
            endpoint = `helpful-links/favorite/${item.id}`;
        } else if (
            item.url?.includes('/api/proxy/') &&
            item.openContentProviderId
        ) {
            endpoint = `open-content/${item.id}/bookmark`;
            payload = {
                open_content_provider_id: item.openContentProviderId,
                content_url: item.url
            };
        } else {
            endpoint = `libraries/${item.id}/favorite`;
        }

        const resp = await API.put<object, object>(endpoint, payload);
        if (!resp.success) {
            setPendingFavorites((prev) => {
                const m = new Map(prev);
                m.set(key, current);
                return m;
            });
            toast.error('Failed to update favorites');
        } else {
            // Refresh so the Favorites count (and the tab's list, when active)
            // stays in sync after favoriting/unfavoriting from any tab.
            await mutateFavorites();
        }
    };

    const ContentCard = ({ item }: { item: ContentItem }) => {
        const favKey = `${item.type}-${item.id}`;
        const favorited = pendingFavorites.has(favKey)
            ? pendingFavorites.get(favKey)!
            : item.favorited;
        const title = decodeHtmlEntities(item.title);
        const description = decodeHtmlEntities(item.description);
        const author = item.author ? decodeHtmlEntities(item.author) : '';
        const handleClick = () => {
            if (item.type === 'library') {
                navigate(`/viewer/libraries/${item.id}`);
            } else if (item.type === 'video') {
                navigate(`/viewer/videos/${item.id}`);
            } else {
                void handleLinkClick(item);
            }
        };

        return (
            <div
                className="media-card group h-full flex flex-col"
                onClick={handleClick}
            >
                {isAdminPreview ? (
                    item.featured && (
                        <div className="absolute top-3 right-3">
                            <Star className="size-5 text-brand-gold fill-brand-gold" />
                        </div>
                    )
                ) : (
                    <button
                        type="button"
                        className="absolute top-3 right-3 p-1 rounded hover:bg-gray-100 transition-colors"
                        onClick={(e) => {
                            e.stopPropagation();
                            void handleToggleFavorite(item);
                        }}
                        aria-label={
                            favorited
                                ? 'Remove from favorites'
                                : 'Add to favorites'
                        }
                    >
                        <Star
                            className={
                                favorited
                                    ? 'size-5 text-brand-gold fill-brand-gold'
                                    : 'size-5 text-gray-400'
                            }
                        />
                    </button>
                )}

                <div className="absolute top-3 left-3">
                    {item.type === 'library' && (
                        <div className="brand-tag">
                            <BookOpen className="size-3" />
                            <span>Library</span>
                        </div>
                    )}
                    {item.type === 'video' && (
                        <div className="brand-tag">
                            <Video className="size-3" />
                            <span>Video</span>
                        </div>
                    )}
                    {item.type === 'link' && (
                        <div className="brand-tag">
                            <LinkIcon className="size-3" />
                            <span>Link</span>
                        </div>
                    )}
                </div>

                <div className="flex items-start gap-3 mb-3 mt-8">
                    {item.type === 'library' && item.imageUrl && (
                        <img
                            src={item.imageUrl}
                            alt={title}
                            className="size-12 rounded shrink-0 border border-gray-200"
                        />
                    )}
                    {item.type === 'video' && item.thumbnailUrl && (
                        <div className="relative shrink-0">
                            <img
                                src={item.thumbnailUrl}
                                alt={title}
                                className="size-12 rounded object-cover border border-gray-200"
                            />
                            {item.duration != null && (
                                <div className="absolute -bottom-1 -right-1 bg-black/80 text-white text-[10px] px-1 py-0.5 rounded">
                                    {formatVideoDuration(item.duration)}
                                </div>
                            )}
                        </div>
                    )}
                    <div className="flex-1 min-w-0 pr-8">
                        <h3 className="card-title-link">{title}</h3>
                        {author && (
                            <p className="text-sm text-gray-500">{author}</p>
                        )}
                        {!author && (
                            <p className="text-sm text-gray-500 invisible">
                                placeholder
                            </p>
                        )}
                    </div>
                </div>

                <p className="text-sm text-gray-600 line-clamp-2 mb-3 min-h-10">
                    {description}
                </p>

                {item.type === 'library' &&
                    item.categories &&
                    item.categories.length > 0 && (
                        <div className="mt-auto pt-3 border-t border-gray-100 flex items-center gap-2 overflow-hidden min-h-10">
                            <Badge
                                variant="secondary"
                                className="bg-surface-hover text-gray-700 hover:bg-surface-hover text-xs shrink-0 max-w-48 truncate"
                            >
                                {item.categories[0]}
                            </Badge>
                            {item.categories.length > 1 && (
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Badge
                                                variant="secondary"
                                                className="bg-brand/10 text-brand hover:bg-brand/10 text-xs cursor-help shrink-0"
                                                onClick={(e) =>
                                                    e.stopPropagation()
                                                }
                                            >
                                                +{item.categories.length - 1}{' '}
                                                more
                                            </Badge>
                                        </TooltipTrigger>
                                        <TooltipContent
                                            side="top"
                                            className="bg-gray-900 text-white max-w-xs"
                                        >
                                            <div className="space-y-1">
                                                {item.categories
                                                    .slice(1)
                                                    .map((cat, idx) => (
                                                        <p
                                                            key={idx}
                                                            className="text-sm"
                                                        >
                                                            • {cat}
                                                        </p>
                                                    ))}
                                            </div>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            )}
                        </div>
                    )}

                {item.type === 'link' && item.url && (
                    <div className="mt-auto pt-3 border-t border-gray-100 min-h-10 flex items-center">
                        <p className="text-sm text-brand truncate">
                            {item.url}
                        </p>
                    </div>
                )}

                {item.type === 'video' && (
                    <div className="mt-auto pt-3 border-t border-gray-100 min-h-10" />
                )}
            </div>
        );
    };

    return (
        <div id="knowledge-center-landing">
            <div className="max-w-7xl mx-auto px-6 py-8">
                <div className="mb-8">
                    <h1 className="text-brand-dark mb-2">Knowledge Center</h1>
                    <p className="text-gray-600">
                        Explore libraries, videos, and helpful resources.
                    </p>
                </div>

                <div
                    className="card-block p-4 mb-6"
                    id="knowledge-center-search"
                >
                    <div className="relative">
                        <Search className="input-icon-left size-5" />
                        <Input
                            placeholder="Search for resources..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10"
                        />
                    </div>
                </div>

                <div className="flex items-center justify-between mb-6">
                    <div
                        id="knowledge-center-tabs"
                        className="flex items-center gap-3"
                    >
                        <button
                            onClick={() => {
                                setContentTypeFilter('all');
                                setCategoryFilter('all');
                                setCurrentPage(1);
                            }}
                            className={`px-4 py-2.5 rounded-lg transition-all duration-200 ${
                                contentTypeFilter === 'all'
                                    ? 'bg-brand text-white shadow-sm'
                                    : 'bg-white text-gray-600 hover:text-brand-dark hover:bg-gray-50 border border-gray-200'
                            }`}
                        >
                            All ({counts.all})
                        </button>
                        <button
                            onClick={() => {
                                setContentTypeFilter('library');
                                setCurrentPage(1);
                            }}
                            className={`px-4 py-2.5 rounded-lg transition-all duration-200 ${
                                contentTypeFilter === 'library'
                                    ? 'bg-brand text-white shadow-sm'
                                    : 'bg-white text-gray-600 hover:text-brand-dark hover:bg-gray-50 border border-gray-200'
                            }`}
                        >
                            Libraries ({counts.library})
                        </button>
                        <button
                            onClick={() => {
                                setContentTypeFilter('video');
                                setCategoryFilter('all');
                                setCurrentPage(1);
                            }}
                            className={`px-4 py-2.5 rounded-lg transition-all duration-200 ${
                                contentTypeFilter === 'video'
                                    ? 'bg-brand text-white shadow-sm'
                                    : 'bg-white text-gray-600 hover:text-brand-dark hover:bg-gray-50 border border-gray-200'
                            }`}
                        >
                            Videos ({counts.video})
                        </button>
                        <button
                            onClick={() => {
                                setContentTypeFilter('link');
                                setCategoryFilter('all');
                                setCurrentPage(1);
                            }}
                            className={`px-4 py-2.5 rounded-lg transition-all duration-200 ${
                                contentTypeFilter === 'link'
                                    ? 'bg-brand text-white shadow-sm'
                                    : 'bg-white text-gray-600 hover:text-brand-dark hover:bg-gray-50 border border-gray-200'
                            }`}
                        >
                            Helpful Links ({counts.link})
                        </button>
                        <button
                            onClick={() => {
                                setContentTypeFilter('favorites');
                                setCategoryFilter('all');
                                setCurrentPage(1);
                            }}
                            className={`px-4 py-2.5 rounded-lg transition-all duration-200 flex items-center gap-1.5 ${
                                contentTypeFilter === 'favorites'
                                    ? 'bg-brand text-white shadow-sm'
                                    : 'bg-white text-gray-600 hover:text-brand-dark hover:bg-gray-50 border border-gray-200'
                            }`}
                        >
                            <Star
                                className={`size-4 ${
                                    contentTypeFilter === 'favorites'
                                        ? 'fill-white'
                                        : 'fill-brand-gold text-brand-gold'
                                }`}
                            />
                            Favorites ({favData?.data?.length ?? 0})
                        </button>
                    </div>

                    {(contentTypeFilter === 'library' ||
                        contentTypeFilter === 'all') && (
                        <Select
                            value={categoryFilter}
                            onValueChange={(value) => {
                                setCategoryFilter(value);
                                setCurrentPage(1);
                            }}
                        >
                            <SelectTrigger
                                id="knowledge-center-filters"
                                className="w-70"
                            >
                                <SelectValue placeholder="Filter by category" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">
                                    All Categories
                                </SelectItem>
                                {categories.map((cat) => (
                                    <SelectItem
                                        key={String(cat.key)}
                                        value={String(cat.key)}
                                    >
                                        {String(cat.value)}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                </div>

                {paginatedContent.length === 0 ? (
                    <div className="empty-state">
                        <p className="text-gray-500">
                            {isFavoritesTab
                                ? 'No favorites yet. Tap the star on any resource to add it here.'
                                : 'No resources found.'}
                        </p>
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-3 gap-6 mb-6">
                            {paginatedContent.map((item, index) => (
                                <div
                                    key={`${item.type}-${item.id}`}
                                    id={
                                        index === 0
                                            ? 'knowledge-center-enter-library'
                                            : undefined
                                    }
                                    className="h-full"
                                >
                                    <ContentCard item={item} />
                                </div>
                            ))}
                        </div>
                        <Pagination
                            currentPage={currentPage}
                            totalItems={filteredContent.length}
                            itemsPerPage={itemsPerPage}
                            onPageChange={setCurrentPage}
                            onItemsPerPageChange={setPerPage}
                        />
                    </>
                )}
            </div>
        </div>
    );
}
