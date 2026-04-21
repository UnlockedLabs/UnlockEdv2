import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import useSWR from 'swr';
import { Search, Plus, Star } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger
} from '@/components/ui/tooltip';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Pagination } from '@/components/shared/Pagination';
import { useDebounceValue } from 'usehooks-ts';
import { useToast } from '@/contexts/ToastContext';
import {
    Library,
    Video,
    HelpfulLink,
    HelpfulLinkAndSort,
    ServerResponseMany,
    ServerResponseOne,
    ToastState,
    Option,
    MAX_DOWNLOAD_ATTEMPTS
} from '@/types';
import {
    videoIsAvailable,
    getVideoErrorMessage,
    formatVideoDuration
} from '@/lib/formatters';
import API from '@/api/api';


interface CardHandlers {
    onToggleFeatured: (id: number, type: 'library' | 'video' | 'link', isFeatured: boolean) => void;
    onToggleVisibility: (id: number, type: 'library' | 'video' | 'link', isVisible: boolean) => void;
    onNavigate: (path: string) => void;
}

function LibraryCard({ library, handlers }: { library: Library; handlers: CardHandlers }) {
    return (
        <div
            className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-lg hover:border-[#556830] transition-all cursor-pointer group relative"
            onClick={() => handlers.onNavigate(`/viewer/libraries/${library.id}`)}
        >
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                handlers.onToggleFeatured(library.id, 'library', library.is_favorited);
                            }}
                            className="absolute top-3 right-3 p-1.5 rounded hover:bg-gray-100 transition-colors"
                        >
                            <Star
                                className={`size-4 ${library.is_favorited ? 'text-[#F1B51C] fill-[#F1B51C]' : 'text-gray-300'}`}
                            />
                        </button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p className="text-sm">
                            Featured content appears at the top for residents
                        </p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
            <div className="flex items-start gap-3 mb-3">
                <img
                    src={library.thumbnail_url ?? ''}
                    alt={library.title}
                    className="size-12 rounded flex-shrink-0 border border-gray-200"
                />
                <div className="flex-1 min-w-0 pr-8">
                    <h3 className="text-[#203622] group-hover:text-[#556830] transition-colors line-clamp-2 min-h-[3rem]">
                        {library.title}
                    </h3>
                </div>
            </div>
            <p className="text-sm text-gray-600 line-clamp-2 mb-3 min-h-[2.5rem]">
                {library.description}
            </p>
            <div
                className="flex items-center justify-between pt-3 border-t border-gray-100"
                onClick={(e) => e.stopPropagation()}
            >
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <Switch
                        checked={library.visibility_status}
                        onCheckedChange={() =>
                            handlers.onToggleVisibility(library.id, 'library', library.visibility_status)
                        }
                    />
                    <span className="text-gray-700">Visible</span>
                </label>
                <Badge
                    variant={library.visibility_status ? 'default' : 'secondary'}
                    className={
                        library.visibility_status
                            ? 'bg-green-100 text-green-800 hover:bg-green-100'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-100'
                    }
                >
                    {library.visibility_status ? 'Visible' : 'Hidden'}
                </Badge>
            </div>
        </div>
    );
}

interface VideoCardProps {
    video: Video;
    handlers: CardHandlers;
    onRetry: (video: Video) => void;
    onViewStatus: (video: Video) => void;
}

function VideoCard({ video, handlers, onRetry, onViewStatus }: VideoCardProps) {
    const available = videoIsAvailable(video);
    return (
        <div
            className={`bg-white rounded-lg border ${!available ? 'border-red-300' : 'border-gray-200'} p-4 hover:shadow-lg hover:border-[#556830] transition-all cursor-pointer group relative`}
            onClick={() => {
                if (available) handlers.onNavigate(`/viewer/videos/${video.id}`);
            }}
        >
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                handlers.onToggleFeatured(video.id, 'video', video.is_favorited);
                            }}
                            className="absolute top-3 right-3 p-1.5 rounded hover:bg-gray-100 transition-colors"
                        >
                            <Star
                                className={`size-4 ${video.is_favorited ? 'text-[#F1B51C] fill-[#F1B51C]' : 'text-gray-300'}`}
                            />
                        </button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p className="text-sm">
                            Featured content appears at the top for residents
                        </p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
            <div className="flex items-start gap-3 mb-3">
                <div className="relative flex-shrink-0">
                    <img
                        src={`/api/photos/${video.external_id}.jpg`}
                        alt={video.title}
                        className="size-12 rounded object-cover border border-gray-200"
                    />
                    <div className="absolute -bottom-1 -right-1 bg-black/80 text-white text-[10px] px-1 py-0.5 rounded">
                        {formatVideoDuration(video.duration)}
                    </div>
                </div>
                <div className="flex-1 min-w-0 pr-8">
                    <h3 className="text-[#203622] group-hover:text-[#556830] transition-colors line-clamp-2 min-h-[3rem]">
                        {video.title}
                    </h3>
                    <p className="text-sm text-gray-500">
                        {video.channel_title}
                    </p>
                </div>
            </div>
            {available ? (
                <p className="text-sm text-gray-600 line-clamp-2 mb-3 min-h-[2.5rem]">
                    {video.description}
                </p>
            ) : (
                <div className="mb-3" onClick={(e) => e.stopPropagation()}>
                    <p className="text-sm text-red-600 mb-2">
                        {getVideoErrorMessage(video) ?? 'Video is processing...'}
                    </p>
                    {video.video_download_attempts.length < MAX_DOWNLOAD_ATTEMPTS && (
                        <Button
                            variant="outline"
                            size="sm"
                            className="text-xs"
                            onClick={() => onRetry(video)}
                        >
                            Try Again
                        </Button>
                    )}
                    <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs ml-2"
                        onClick={() => onViewStatus(video)}
                    >
                        View Status
                    </Button>
                </div>
            )}
            <div
                className="flex items-center justify-between pt-3 border-t border-gray-100"
                onClick={(e) => e.stopPropagation()}
            >
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <Switch
                        checked={video.visibility_status}
                        onCheckedChange={() =>
                            handlers.onToggleVisibility(video.id, 'video', video.visibility_status)
                        }
                    />
                    <span className="text-gray-700">Visible</span>
                </label>
                <Badge
                    variant={video.visibility_status ? 'default' : 'secondary'}
                    className={
                        video.visibility_status
                            ? 'bg-green-100 text-green-800 hover:bg-green-100'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-100'
                    }
                >
                    {video.visibility_status ? 'Visible' : 'Hidden'}
                </Badge>
            </div>
        </div>
    );
}

function LinkCard({ link, handlers, onLinkClick }: { link: HelpfulLink; handlers: CardHandlers; onLinkClick: (link: HelpfulLink) => void }) {
    return (
        <div
            className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-lg hover:border-[#556830] transition-all cursor-pointer group relative"
            onClick={() => onLinkClick(link)}
        >
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                handlers.onToggleFeatured(link.id, 'link', link.is_favorited);
                            }}
                            className="absolute top-3 right-3 p-1.5 rounded hover:bg-gray-100 transition-colors"
                        >
                            <Star
                                className={`size-4 ${link.is_favorited ? 'text-[#F1B51C] fill-[#F1B51C]' : 'text-gray-300'}`}
                            />
                        </button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p className="text-sm">
                            Featured content appears at the top for residents
                        </p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
            <div className="pr-8 mb-2">
                <h3 className="text-[#203622] group-hover:text-[#556830] transition-colors line-clamp-2 min-h-[3rem]">
                    {link.title}
                </h3>
            </div>
            <p className="text-sm text-[#556830] mb-2 truncate">{link.url}</p>
            <p className="text-sm text-gray-600 line-clamp-2 mb-3 min-h-[2.5rem]">
                {link.description}
            </p>
            <div
                className="flex items-center justify-between pt-3 border-t border-gray-100"
                onClick={(e) => e.stopPropagation()}
            >
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <Switch
                        checked={link.visibility_status}
                        onCheckedChange={() =>
                            handlers.onToggleVisibility(link.id, 'link', link.visibility_status)
                        }
                    />
                    <span className="text-gray-700">Visible</span>
                </label>
                <Badge
                    variant={link.visibility_status ? 'default' : 'secondary'}
                    className={
                        link.visibility_status
                            ? 'bg-green-100 text-green-800 hover:bg-green-100'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-100'
                    }
                >
                    {link.visibility_status ? 'Visible' : 'Hidden'}
                </Badge>
            </div>
        </div>
    );
}

export default function KnowledgeCenterManagement() {
    const navigate = useNavigate();
    const { toaster } = useToast();

    const [searchTerm, setSearchTerm] = useState('');
    const [searchQuery] = useDebounceValue(searchTerm, 500);
    const [visibilityFilter, setVisibilityFilter] = useState<string>('all');
    const [categoryFilter, setCategoryFilter] = useState<string>('all');
    const [currentTab, setCurrentTab] = useState('libraries');
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(20);

    const [showAddVideo, setShowAddVideo] = useState(false);
    const [showAddLink, setShowAddLink] = useState(false);
    const [videoFormData, setVideoFormData] = useState({ url: '' });
    const [linkFormData, setLinkFormData] = useState({
        title: '',
        url: '',
        description: ''
    });

    const [polling, setPolling] = useState(false);
    const pollingRef = useRef(false);
    const recentToggles = useRef(new Set<string>());
    const [statusDialogOpen, setStatusDialogOpen] = useState(false);
    const [targetVideo, setTargetVideo] = useState<Video | null>(null);

    useEffect(() => {
        if (currentTab !== 'libraries') {
            setCategoryFilter('all');
        }
        setCurrentPage(1);
    }, [currentTab]);

    const visibilityParam = useMemo(() => {
        if (visibilityFilter === 'not-featured')
            return '&visibility=all';
        if (visibilityFilter === 'all') return '&visibility=all';
        return `&visibility=${visibilityFilter}`;
    }, [visibilityFilter]);

    const categoryParam = useMemo(() => {
        if (categoryFilter === 'all') return '';
        return `&tags=${categoryFilter}`;
    }, [categoryFilter]);

    const { data: tagsData } = useSWR<ServerResponseMany<Option>>(
        '/api/tags'
    );
    const categories = tagsData?.data ?? [];

    const {
        data: libData,
        mutate: mutateLibs
    } = useSWR<ServerResponseMany<Library>>(
        `/api/libraries?page=1&per_page=500&order_by=title&order=asc${visibilityParam}&search=${searchQuery}${categoryParam}`
    );

    const {
        data: vidData,
        mutate: mutateVids
    } = useSWR<ServerResponseMany<Video>>(
        `/api/videos?page=1&per_page=500&order_by=title&order=asc${visibilityParam}&search=${searchQuery}`
    );

    const {
        data: linkData,
        mutate: mutateLinks
    } = useSWR<ServerResponseOne<HelpfulLinkAndSort>>(
        `/api/helpful-links?search=${searchQuery}&page=1&per_page=500&order_by=title&order=asc`
    );

    const libraries = useMemo(() => {
        const items = libData?.data ?? [];
        if (visibilityFilter === 'not-featured') {
            return items.filter((lib) => !lib.is_favorited);
        }
        return items;
    }, [libData?.data, visibilityFilter]);

    const libTotal = useMemo(() => {
        if (visibilityFilter === 'not-featured') return libraries.length;
        return libData?.meta?.total ?? 0;
    }, [libData?.meta?.total, visibilityFilter, libraries.length]);

    const videos = useMemo(() => {
        const items = vidData?.data ?? [];
        if (visibilityFilter === 'not-featured') {
            return items.filter((vid) => !vid.is_favorited);
        }
        return items;
    }, [vidData?.data, visibilityFilter]);

    const vidTotal = useMemo(() => {
        if (visibilityFilter === 'not-featured') return videos.length;
        return vidData?.meta?.total ?? 0;
    }, [vidData?.meta?.total, visibilityFilter, videos.length]);

    const helpfulLinks = useMemo(() => {
        const items = linkData?.data?.helpful_links ?? [];
        if (visibilityFilter !== 'all' && visibilityFilter !== 'not-featured') {
            const vis =
                visibilityFilter === 'visible'
                    ? true
                    : visibilityFilter === 'hidden'
                      ? false
                      : null;
            if (vis !== null) {
                return items.filter(
                    (link) => link.visibility_status === vis
                );
            }
            if (visibilityFilter === 'featured') {
                return items.filter((link) => link.is_favorited);
            }
        }
        if (visibilityFilter === 'not-featured') {
            return items.filter((link) => !link.is_favorited);
        }
        return items;
    }, [linkData?.data?.helpful_links, visibilityFilter]);

    const linkTotal = useMemo(() => {
        if (visibilityFilter !== 'all') return helpfulLinks.length;
        return linkData?.data?.meta?.total ?? 0;
    }, [linkData?.data?.meta?.total, visibilityFilter, helpfulLinks.length]);

    const paginatedLibraries = libraries.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    const paginatedVideos = videos.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    const paginatedLinks = helpfulLinks.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    const handleItemsPerPageChange = (v: number) => {
        setItemsPerPage(v);
        setCurrentPage(1);
    };

    const pollVideos = (delay: number) => {
        if (!pollingRef.current) return;
        void mutateVids().then(() => {
            if (delay > 10000) {
                pollingRef.current = false;
                setPolling(false);
                return;
            }
            setTimeout(() => pollVideos(delay * 2), delay);
        });
    };

    const guardToggle = (key: string): boolean => {
        if (recentToggles.current.has(key)) return false;
        recentToggles.current.add(key);
        setTimeout(() => recentToggles.current.delete(key), 1000);
        return true;
    };

    const handleToggleFeatured = async (
        id: number,
        type: 'library' | 'video' | 'link',
        isFeatured: boolean
    ) => {
        if (!guardToggle(`featured-${type}-${id}`)) return;
        const endpoints: Record<string, string> = {
            library: `libraries/${id}/favorite`,
            video: `videos/${id}/favorite`,
            link: `helpful-links/favorite/${id}`
        };
        const typeLabel: Record<string, string> = {
            library: 'Library',
            video: 'Video',
            link: 'Helpful link'
        };
        const actionString = isFeatured ? 'unfeatured' : 'featured';
        const resp = await API.put<null, object>(endpoints[type], {});
        if (resp.success) {
            toaster(`${typeLabel[type]} ${actionString}`, ToastState.success);
            if (type === 'library') void mutateLibs();
            else if (type === 'video') void mutateVids();
            else void mutateLinks();
        } else {
            toaster(`${typeLabel[type]} ${actionString}`, ToastState.error);
        }
    };

    const handleToggleVisibility = async (
        id: number,
        type: 'library' | 'video' | 'link',
        isVisible: boolean
    ) => {
        if (!guardToggle(`visibility-${type}-${id}`)) return;
        const endpoints: Record<string, string> = {
            library: `libraries/${id}/toggle`,
            video: `videos/${id}/visibility`,
            link: `helpful-links/toggle/${id}`
        };
        const typeLabel: Record<string, string> = {
            library: 'Library',
            video: 'Video',
            link: 'Helpful link'
        };
        const actionString = isVisible ? 'is now hidden' : 'is now visible';
        const resp = await API.put<null, object>(endpoints[type], {});
        if (resp.success) {
            toaster(`${typeLabel[type]} ${actionString}`, ToastState.success);
            if (type === 'library') void mutateLibs();
            else if (type === 'video') void mutateVids();
            else void mutateLinks();
        } else {
            toaster(`${typeLabel[type]} ${actionString}`, ToastState.error);
        }
    };

    const handleAddVideo = async () => {
        const resp = await API.post<null, object>('videos', {
            video_urls: [videoFormData.url]
        });
        if (resp.success) {
            toaster('Video added successfully', ToastState.success);
            setShowAddVideo(false);
            setVideoFormData({ url: '' });
            pollingRef.current = true;
            setPolling(true);
            setTimeout(() => pollVideos(1000), 1000);
            void mutateVids();
        } else {
            toaster(resp.message ?? 'Failed to add video', ToastState.error);
        }
    };

    const handleAddLink = async () => {
        const resp = await API.put<null, object>(
            'helpful-links',
            linkFormData
        );
        if (resp.success) {
            toaster('Link added successfully', ToastState.success);
            setShowAddLink(false);
            setLinkFormData({ title: '', url: '', description: '' });
            void mutateLinks();
        } else {
            toaster(resp.message ?? 'Failed to add link', ToastState.error);
        }
    };

    const handleRetryVideo = async (video: Video) => {
        if (polling) {
            toaster('Please wait before retrying again', ToastState.error);
            return;
        }
        const resp = await API.put<null, object>(
            `videos/${video.id}/retry`,
            {}
        );
        if (resp.success) {
            toaster('Video retry started', ToastState.success);
            pollingRef.current = true;
            setPolling(true);
            setTimeout(() => pollVideos(1000), 1000);
        } else {
            toaster('Error retrying video', ToastState.error);
        }
    };

    const handleLinkClick = async (link: HelpfulLink) => {
        const resp = await API.put<
            { url: string },
            object
        >(`helpful-links/activity/${link.id}`, {});
        if (resp.success && resp.data) {
            window.open(
                (resp.data as { url: string }).url ?? link.url,
                '_blank'
            );
        } else {
            window.open(link.url, '_blank');
        }
    };

    const getStatusText = () => {
        if (!targetVideo) return '';
        return targetVideo.video_download_attempts.length >=
            MAX_DOWNLOAD_ATTEMPTS
            ? 'This video has reached the maximum download attempts. Please remove and try again.'
            : `Download is processing: ${getVideoErrorMessage(targetVideo) ?? ''}\nThe video download will be retried every 3 hours.`;
    };

    const cardHandlers: CardHandlers = {
        onToggleFeatured: (id, type, isFeatured) => void handleToggleFeatured(id, type, isFeatured),
        onToggleVisibility: (id, type, isVisible) => void handleToggleVisibility(id, type, isVisible),
        onNavigate: (path) => navigate(path)
    };

    return (
        <div className="max-w-7xl mx-auto px-6 py-8">
            <div className="mb-8">
                <h1 className="text-[#203622] mb-2">Knowledge Center</h1>
                <p className="text-gray-600">
                    Manage libraries, videos, and helpful links for residents.
                </p>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
                <div className="flex gap-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-gray-400" />
                        <Input
                            placeholder="Search across all content..."
                            value={searchTerm}
                            onChange={(e) => {
                                setSearchTerm(e.target.value);
                                setCurrentPage(1);
                            }}
                            className="pl-10"
                        />
                    </div>
                    <Select
                        value={visibilityFilter}
                        onValueChange={(v) => {
                            setVisibilityFilter(v);
                            setCurrentPage(1);
                        }}
                    >
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Filter by" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Content</SelectItem>
                            <SelectItem value="visible">
                                Visible Only
                            </SelectItem>
                            <SelectItem value="hidden">
                                Hidden Only
                            </SelectItem>
                            <SelectItem value="featured">
                                Featured Only
                            </SelectItem>
                            <SelectItem value="not-featured">
                                Not Featured
                            </SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <Tabs
                value={currentTab}
                onValueChange={setCurrentTab}
                className="space-y-6"
            >
                <div className="flex items-center justify-between">
                    <TabsList className="bg-white border border-gray-200 p-1 h-auto gap-1">
                        <TabsTrigger
                            value="libraries"
                            className="data-[state=active]:bg-[#556830] data-[state=active]:text-white data-[state=active]:shadow-sm data-[state=inactive]:text-gray-600 data-[state=inactive]:hover:text-[#203622] data-[state=inactive]:hover:bg-gray-50 px-4 py-2.5 rounded-lg transition-all duration-200"
                        >
                            Libraries ({libTotal})
                        </TabsTrigger>
                        <TabsTrigger
                            value="videos"
                            className="data-[state=active]:bg-[#556830] data-[state=active]:text-white data-[state=active]:shadow-sm data-[state=inactive]:text-gray-600 data-[state=inactive]:hover:text-[#203622] data-[state=inactive]:hover:bg-gray-50 px-4 py-2.5 rounded-lg transition-all duration-200"
                        >
                            Videos ({vidTotal})
                        </TabsTrigger>
                        <TabsTrigger
                            value="links"
                            className="data-[state=active]:bg-[#556830] data-[state=active]:text-white data-[state=active]:shadow-sm data-[state=inactive]:text-gray-600 data-[state=inactive]:hover:text-[#203622] data-[state=inactive]:hover:bg-gray-50 px-4 py-2.5 rounded-lg transition-all duration-200"
                        >
                            Helpful Links ({linkTotal})
                        </TabsTrigger>
                    </TabsList>

                    {currentTab === 'libraries' && (
                        <Select
                            value={categoryFilter}
                            onValueChange={(v) => {
                                setCategoryFilter(v);
                                setCurrentPage(1);
                            }}
                        >
                            <SelectTrigger className="w-[280px]">
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
                    {currentTab === 'videos' && (
                        <Button
                            className="bg-[#556830] hover:bg-[#203622] text-white"
                            onClick={() => setShowAddVideo(true)}
                        >
                            <Plus className="size-4 mr-2" />
                            Add Video
                        </Button>
                    )}
                    {currentTab === 'links' && (
                        <Button
                            className="bg-[#556830] hover:bg-[#203622] text-white"
                            onClick={() => setShowAddLink(true)}
                        >
                            <Plus className="size-4 mr-2" />
                            Add Link
                        </Button>
                    )}
                </div>

                <TabsContent value="libraries" className="space-y-4">
                    {libraries.length === 0 ? (
                        <div className="text-center py-12 bg-white border border-gray-200 rounded-lg">
                            <p className="text-gray-500">
                                No libraries found.
                            </p>
                        </div>
                    ) : (
                        <>
                            <div className="grid grid-cols-3 gap-6">
                                {paginatedLibraries.map((library) => (
                                    <LibraryCard
                                        key={library.id}
                                        library={library}
                                        handlers={cardHandlers}
                                    />
                                ))}
                            </div>
                            <Pagination
                                currentPage={currentPage}
                                totalItems={libraries.length}
                                itemsPerPage={itemsPerPage}
                                onPageChange={setCurrentPage}
                                onItemsPerPageChange={handleItemsPerPageChange}
                            />
                        </>
                    )}
                </TabsContent>

                <TabsContent value="videos" className="space-y-4">
                    {videos.length === 0 ? (
                        <div className="text-center py-12 bg-white border border-gray-200 rounded-lg">
                            <p className="text-gray-500">No videos found.</p>
                        </div>
                    ) : (
                        <>
                            <div className="grid grid-cols-3 gap-6">
                                {paginatedVideos.map((video) => (
                                    <VideoCard
                                        key={video.id}
                                        video={video}
                                        handlers={cardHandlers}
                                        onRetry={(v) => void handleRetryVideo(v)}
                                        onViewStatus={(v) => {
                                            setTargetVideo(v);
                                            setStatusDialogOpen(true);
                                        }}
                                    />
                                ))}
                            </div>
                            <Pagination
                                currentPage={currentPage}
                                totalItems={videos.length}
                                itemsPerPage={itemsPerPage}
                                onPageChange={setCurrentPage}
                                onItemsPerPageChange={handleItemsPerPageChange}
                            />
                        </>
                    )}
                </TabsContent>

                <TabsContent value="links" className="space-y-4">
                    {helpfulLinks.length === 0 ? (
                        <div className="text-center py-12 bg-white border border-gray-200 rounded-lg">
                            <p className="text-gray-500">
                                No helpful links found.
                            </p>
                        </div>
                    ) : (
                        <>
                            <div className="grid grid-cols-3 gap-6">
                                {paginatedLinks.map((link) => (
                                    <LinkCard
                                        key={link.id}
                                        link={link}
                                        handlers={cardHandlers}
                                        onLinkClick={(l) => void handleLinkClick(l)}
                                    />
                                ))}
                            </div>
                            <Pagination
                                currentPage={currentPage}
                                totalItems={helpfulLinks.length}
                                itemsPerPage={itemsPerPage}
                                onPageChange={setCurrentPage}
                                onItemsPerPageChange={handleItemsPerPageChange}
                            />
                        </>
                    )}
                </TabsContent>
            </Tabs>

            <Dialog open={showAddVideo} onOpenChange={setShowAddVideo}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add YouTube Video</DialogTitle>
                        <DialogDescription>
                            Enter a YouTube URL to add a video to the Knowledge
                            Center.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                        <div>
                            <Label htmlFor="video-url">YouTube URL</Label>
                            <Input
                                id="video-url"
                                placeholder="https://www.youtube.com/watch?v=..."
                                value={videoFormData.url}
                                onChange={(e) =>
                                    setVideoFormData({ url: e.target.value })
                                }
                            />
                        </div>
                        <div className="flex justify-end gap-2">
                            <Button
                                variant="outline"
                                onClick={() => setShowAddVideo(false)}
                            >
                                Cancel
                            </Button>
                            <Button
                                className="bg-[#556830] hover:bg-[#203622] text-white"
                                onClick={() => void handleAddVideo()}
                                disabled={!videoFormData.url}
                            >
                                Add Video
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={showAddLink} onOpenChange={setShowAddLink}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add Helpful Link</DialogTitle>
                        <DialogDescription>
                            Add a whitelisted website link for residents to
                            access.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                        <div>
                            <Label htmlFor="link-title">Title *</Label>
                            <Input
                                id="link-title"
                                placeholder="Enter link title"
                                value={linkFormData.title}
                                onChange={(e) =>
                                    setLinkFormData({
                                        ...linkFormData,
                                        title: e.target.value
                                    })
                                }
                            />
                        </div>
                        <div>
                            <Label htmlFor="link-url">URL *</Label>
                            <Input
                                id="link-url"
                                placeholder="https://example.com"
                                value={linkFormData.url}
                                onChange={(e) =>
                                    setLinkFormData({
                                        ...linkFormData,
                                        url: e.target.value
                                    })
                                }
                            />
                        </div>
                        <div>
                            <Label htmlFor="link-description">
                                Description *
                            </Label>
                            <Textarea
                                id="link-description"
                                placeholder="Enter a brief description of this resource"
                                value={linkFormData.description}
                                onChange={(e) =>
                                    setLinkFormData({
                                        ...linkFormData,
                                        description: e.target.value
                                    })
                                }
                                rows={3}
                            />
                        </div>
                        <div className="flex justify-end gap-2">
                            <Button
                                variant="outline"
                                onClick={() => setShowAddLink(false)}
                            >
                                Cancel
                            </Button>
                            <Button
                                className="bg-[#556830] hover:bg-[#203622] text-white"
                                onClick={() => void handleAddLink()}
                                disabled={
                                    !linkFormData.title ||
                                    !linkFormData.url ||
                                    !linkFormData.description
                                }
                            >
                                Add Link
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog
                open={statusDialogOpen}
                onOpenChange={setStatusDialogOpen}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Video Status</DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-muted-foreground whitespace-pre-line">
                        {getStatusText()}
                    </p>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => {
                                setStatusDialogOpen(false);
                                setTargetVideo(null);
                            }}
                        >
                            Close
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
