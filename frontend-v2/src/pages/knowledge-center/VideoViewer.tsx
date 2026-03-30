import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Video, ServerResponseOne } from '@/types';
import { useAuth, isAdministrator } from '@/auth/useAuth';
import { useBreadcrumb } from '@/contexts/BreadcrumbContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatVideoDuration } from '@/lib/formatters';
import API from '@/api/api';

export default function VideoViewer() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { id: videoId } = useParams();
    const { setBreadcrumbItems } = useBreadcrumb();
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [video, setVideo] = useState<Video | undefined>();

    const isAdmin = user ? isAdministrator(user) : false;
    const backPath = isAdmin
        ? '/knowledge-center-management'
        : '/knowledge-center';

    useEffect(() => {
        setBreadcrumbItems([
            { label: 'Knowledge Center', href: backPath },
            { label: video?.title ?? 'Video' }
        ]);
        return () => setBreadcrumbItems([]);
    }, [video?.title, setBreadcrumbItems, backPath]);

    useEffect(() => {
        const fetchVideoData = async () => {
            const resp = (await API.get(
                `videos/${videoId}`
            )) as ServerResponseOne<Video>;
            if (resp.success) {
                setIsLoading(false);
                setVideo(resp.data);
            } else {
                setError(resp.message);
                setIsLoading(false);
            }
        };
        void fetchVideoData();
    }, [videoId]);

    const handleError = () => {
        setError('Video Currently Unavailable');
    };

    if (isLoading) {
        return (
            <div className="space-y-4">
                <Skeleton className="w-2/3 h-[400px] rounded-lg" />
                <Skeleton className="w-1/3 h-8" />
                <Skeleton className="w-2/3 h-20" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center gap-4 py-12">
                <p className="text-sm text-destructive">
                    Video currently unavailable or unauthorized to view
                </p>
                <Button
                    onClick={() => navigate(backPath)}
                    className="bg-[#203622] text-white hover:bg-[#203622]/90"
                >
                    Back to Knowledge Center
                </Button>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full">
            <div className="px-6 py-3 border-b border-gray-200 bg-white">
                <div className="flex items-center justify-between">
                    <div />
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(backPath)}
                    >
                        <ArrowLeft className="size-4 mr-2" />
                        Back
                    </Button>
                </div>
                <div className="flex items-start justify-between mt-2">
                    <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                            <h2 className="text-xl font-semibold text-[#203622]">
                                {video?.title}
                            </h2>
                            {isAdmin && video && (
                                <>
                                    <Badge
                                        variant="outline"
                                        className={
                                            video.visibility_status
                                                ? 'bg-green-50 text-[#556830] border-green-200 text-xs'
                                                : 'bg-gray-50 text-gray-600 border-gray-200 text-xs'
                                        }
                                    >
                                        {video.visibility_status
                                            ? 'Visible'
                                            : 'Hidden'}
                                    </Badge>
                                    {video.is_favorited && (
                                        <Badge
                                            variant="outline"
                                            className="bg-amber-50 text-amber-700 border-amber-200 text-xs"
                                        >
                                            Featured
                                        </Badge>
                                    )}
                                </>
                            )}
                        </div>
                        <p className="text-sm text-gray-600 line-clamp-1">
                            {video?.description}
                        </p>
                        {video?.channel_title && (
                            <p className="text-xs text-gray-500 mt-0.5">
                                By {video.channel_title}
                                {video.duration
                                    ? ` - ${formatVideoDuration(video.duration)}`
                                    : ''}
                            </p>
                        )}
                    </div>
                </div>
            </div>

            <div className="flex-1 bg-[#E2E7EA] flex items-center justify-center p-6">
                <div className="max-w-4xl w-full space-y-4">
                    <video
                        width="100%"
                        height="auto"
                        controls
                        onError={handleError}
                        src={`/api/proxy/videos/${video?.id}`}
                        className="rounded-lg border border-border"
                    >
                        Your browser does not support the video tag.
                    </video>
                </div>
            </div>
        </div>
    );
}
