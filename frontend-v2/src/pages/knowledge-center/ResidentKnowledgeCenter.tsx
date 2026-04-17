import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTourContext } from '@/contexts/TourContext';
import { targetToStepIndexMap } from '@/components/UnlockEdTour';
import useSWR from 'swr';
import {
    Search,
    Star,
    BookOpen,
    Video,
    Link as LinkIcon
} from 'lucide-react';
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
import { Pagination } from '@/components/shared/Pagination';
import { useDebounceValue } from 'usehooks-ts';
import {
    Library,
    Video as VideoType,
    HelpfulLinkAndSort,
    ServerResponseMany,
    ServerResponseOne,
    Option
} from '@/types';
import { formatVideoDuration } from '@/lib/formatters';
import API from '@/api/api';

const ITEMS_PER_PAGE = 10;

interface ContentItem {
    id: number;
    type: 'library' | 'video' | 'link';
    title: string;
    description: string;
    featured: boolean;
    imageUrl?: string | null;
    thumbnailUrl?: string | null;
    author?: string;
    duration?: number;
    url?: string;
    categories?: string[];
}

export default function ResidentKnowledgeCenter() {
    const navigate = useNavigate();
    const { tourState, setTourState } = useTourContext();

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
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(ITEMS_PER_PAGE);

    const { data: tagsData } = useSWR<ServerResponseMany<Option>>(
        '/api/tags'
    );
    const categories = tagsData?.data ?? [];

    const categoryParam =
        categoryFilter !== 'all' ? `&tag=${categoryFilter}` : '';

    const { data: libData } = useSWR<
        ServerResponseMany<Library>
    >(
        `/api/libraries?visibility=visible&per_page=500&order_by=title&order=asc&search=${searchQuery}${categoryParam}`
    );

    const { data: vidData } = useSWR<
        ServerResponseMany<VideoType>
    >(
        `/api/videos?visibility=visible&per_page=500&order_by=title&order=asc&search=${searchQuery}`
    );

    const { data: linkData } = useSWR<
        ServerResponseOne<HelpfulLinkAndSort>
    >(
        `/api/helpful-links?visibility=true&per_page=500&order_by=title&order=asc&search=${searchQuery}`
    );

    const allContent: ContentItem[] = useMemo(() => {
        const libs: ContentItem[] = (libData?.data ?? []).map((lib) => ({
            id: lib.id,
            type: 'library' as const,
            title: lib.title,
            description: lib.description ?? '',
            featured: lib.is_favorited,
            imageUrl: lib.thumbnail_url,
            url: lib.url
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
                featured: vid.is_favorited,
                thumbnailUrl: `/api/photos/${vid.external_id}.jpg`,
                author: vid.channel_title,
                duration: vid.duration
            }));

        const links: ContentItem[] = (
            linkData?.data?.helpful_links ?? []
        ).map((link) => ({
            id: link.id,
            type: 'link' as const,
            title: link.title,
            description: link.description,
            featured: link.is_favorited,
            url: link.url
        }));

        return [...libs, ...vids, ...links];
    }, [libData?.data, vidData?.data, linkData?.data?.helpful_links]);

    const filteredContent = useMemo(() => {
        return allContent
            .filter((item) => {
                if (
                    contentTypeFilter !== 'all' &&
                    item.type !== contentTypeFilter
                ) {
                    return false;
                }
                return true;
            })
            .sort((a, b) => {
                if (a.featured && !b.featured) return -1;
                if (!a.featured && b.featured) return 1;
                return a.title.localeCompare(b.title);
            });
    }, [allContent, contentTypeFilter]);

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
                (resp.data as { url: string }).url ?? link.url,
                '_blank'
            );
        } else {
            window.open(link.url ?? '', '_blank');
        }
    };

    const ContentCard = ({ item }: { item: ContentItem }) => {
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
                className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-lg hover:border-[#556830] transition-all cursor-pointer group relative"
                onClick={handleClick}
            >
                {item.featured && (
                    <div className="absolute top-3 right-3">
                        <Star className="size-5 text-[#F1B51C] fill-[#F1B51C]" />
                    </div>
                )}

                <div className="absolute top-3 left-3">
                    {item.type === 'library' && (
                        <div className="bg-[#556830] text-white px-2 py-1 rounded text-xs flex items-center gap-1">
                            <BookOpen className="size-3" />
                            <span>Library</span>
                        </div>
                    )}
                    {item.type === 'video' && (
                        <div className="bg-[#556830] text-white px-2 py-1 rounded text-xs flex items-center gap-1">
                            <Video className="size-3" />
                            <span>Video</span>
                        </div>
                    )}
                    {item.type === 'link' && (
                        <div className="bg-[#556830] text-white px-2 py-1 rounded text-xs flex items-center gap-1">
                            <LinkIcon className="size-3" />
                            <span>Link</span>
                        </div>
                    )}
                </div>

                <div className="flex items-start gap-3 mb-3 mt-8">
                    {item.type === 'library' && item.imageUrl && (
                        <img
                            src={item.imageUrl}
                            alt={item.title}
                            className="size-12 rounded flex-shrink-0 border border-gray-200"
                        />
                    )}
                    {item.type === 'video' && item.thumbnailUrl && (
                        <div className="relative flex-shrink-0">
                            <img
                                src={item.thumbnailUrl}
                                alt={item.title}
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
                        <h3 className="text-[#203622] group-hover:text-[#556830] transition-colors line-clamp-1">
                            {item.title}
                        </h3>
                        {item.author && (
                            <p className="text-sm text-gray-500">
                                {item.author}
                            </p>
                        )}
                    </div>
                </div>

                <p className="text-sm text-gray-600 line-clamp-2 mb-3">
                    {item.description}
                </p>

                {item.type === 'library' && item.categories && item.categories.length > 0 && (
                    <div className="pt-3 border-t border-gray-100 flex flex-wrap gap-2">
                        <Badge
                            variant="secondary"
                            className="bg-[#E2E7EA] text-gray-700 hover:bg-[#E2E7EA] text-xs"
                        >
                            {item.categories[0]}
                        </Badge>
                        {item.categories.length > 1 && (
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Badge
                                            variant="secondary"
                                            className="bg-[#556830]/10 text-[#556830] hover:bg-[#556830]/10 text-xs cursor-help"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            +{item.categories.length - 1} more
                                        </Badge>
                                    </TooltipTrigger>
                                    <TooltipContent side="top" className="bg-gray-900 text-white max-w-xs">
                                        <div className="space-y-1">
                                            {item.categories.slice(1).map((cat, idx) => (
                                                <p key={idx} className="text-sm">{cat}</p>
                                            ))}
                                        </div>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        )}
                    </div>
                )}

                {item.type === 'link' && item.url && (
                    <div className="pt-3 border-t border-gray-100">
                        <p className="text-sm text-[#556830] truncate">
                            {item.url}
                        </p>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="-mx-6 -mt-4 -mb-4 min-h-[calc(100vh-4rem)] bg-[#E2E7EA]" id="knowledge-center-landing">
        <div className="max-w-7xl mx-auto px-6 py-8">
            <div className="mb-8">
                <h1 className="text-[#203622] mb-2">Knowledge Center</h1>
                <p className="text-gray-600">
                    Explore libraries, videos, and helpful resources.
                </p>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6" id="knowledge-center-search">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-gray-400" />
                    <Input
                        placeholder="Search for resources..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                    />
                </div>
            </div>

            <div className="flex items-center justify-between mb-6">
                <div id="knowledge-center-tabs" className="flex items-center gap-3">
                    <button
                        onClick={() => {
                            setContentTypeFilter('all');
                            setCategoryFilter('all');
                            setCurrentPage(1);
                        }}
                        className={`px-4 py-2.5 rounded-lg transition-all duration-200 ${
                            contentTypeFilter === 'all'
                                ? 'bg-[#556830] text-white shadow-sm'
                                : 'bg-white text-gray-600 hover:text-[#203622] hover:bg-gray-50 border border-gray-200'
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
                                ? 'bg-[#556830] text-white shadow-sm'
                                : 'bg-white text-gray-600 hover:text-[#203622] hover:bg-gray-50 border border-gray-200'
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
                                ? 'bg-[#556830] text-white shadow-sm'
                                : 'bg-white text-gray-600 hover:text-[#203622] hover:bg-gray-50 border border-gray-200'
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
                                ? 'bg-[#556830] text-white shadow-sm'
                                : 'bg-white text-gray-600 hover:text-[#203622] hover:bg-gray-50 border border-gray-200'
                        }`}
                    >
                        Helpful Links ({counts.link})
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
                        <SelectTrigger id="knowledge-center-filters" className="w-[280px]">
                            <SelectValue placeholder="Filter by category" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">
                                All Categories
                            </SelectItem>
                            {categories.map((cat) => (
                                <SelectItem
                                    key={String(cat.key)}
                                    value={String(cat.value)}
                                >
                                    {String(cat.value)}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                )}
            </div>

            {paginatedContent.length === 0 ? (
                <div className="text-center py-12 bg-white border border-gray-200 rounded-lg">
                    <p className="text-gray-500">No resources found.</p>
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
                            >
                                <ContentCard item={item} />
                            </div>
                        ))}
                    </div>
                    {filteredContent.length > 10 && (
                        <Pagination
                            currentPage={currentPage}
                            totalItems={filteredContent.length}
                            itemsPerPage={itemsPerPage}
                            onPageChange={setCurrentPage}
                            onItemsPerPageChange={(v) => {
                            setItemsPerPage(v);
                            setCurrentPage(1);
                        }}
                        />
                    )}
                </>
            )}
        </div>
        </div>
    );
}
