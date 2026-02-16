import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Video, ServerResponseOne } from '@/types';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import API from '@/api/api';

export default function VideoViewer() {
    const navigate = useNavigate();
    const { id: videoId } = useParams();
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [video, setVideo] = useState<Video | undefined>();

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
                    onClick={() => navigate('/authcallback')}
                    className="bg-[#203622] text-white hover:bg-[#203622]/90"
                >
                    Back to Dashboard
                </Button>
            </div>
        );
    }

    return (
        <div className="max-w-4xl space-y-4">
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
            <h2 className="text-lg font-semibold text-foreground">
                {video?.title}
            </h2>
            {video?.channel_title && (
                <p className="text-sm text-muted-foreground">
                    {video.channel_title}
                </p>
            )}
            <p className="text-sm text-muted-foreground">
                {video?.description}
            </p>
        </div>
    );
}
