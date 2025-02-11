import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import API from '@/api/api';
import { Video, ServerResponseOne } from '@/common';
import { usePathValue } from '@/Context/PathValueCtx';
import useWebSocketTracker from './useWebSocket';
import { useAuth } from '@/useAuth';

export default function VideoViewer() {
        const { user } = useAuth();
        if (!user) {
            return null;
        }
    const navigate = useNavigate();
    const { id: videoId } = useParams();
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const { setPathVal } = usePathValue();
    const [video, setVideo] = useState<Video | undefined>();

        const { activityID, isConnected } = useWebSocketTracker(user.id, videoId, (newActivityId) => {
            console.log("Activity Updated:", newActivityId);
        });
    useEffect(() => {
            if (!videoId) return;
    console.log("Fetching video data for:", videoId); 
        const fetchVideoData = async () => {
            const resp = (await API.get(
                `videos/${videoId}`
            )) as ServerResponseOne<Video>;
            if (resp.success) {
                setIsLoading(false);
                setPathVal([
                    {
                        path_id: ':video_name',
                        value: resp.data.channel_title
                    }
                ]);
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
    return (
        <div className="px-5 pb-4">
            <div className="w-2/3 pt-4 justify-center">
            <p>WebSocket Status: {isConnected ? "Connected" : "Disconnected"}</p>
            <p>Current Activity ID: {activityID}</p>
                {isLoading ? (
                    <div className="flex h-screen gap-4 justify-center content-center">
                        <span className="my-auto loading loading-spinner loading-lg"></span>
                        <p className="my-auto text-lg">Loading...</p>
                    </div>
                ) : (
                    <div className="video-player">
                        {error ? (
                            <div className="error-message">
                                Video Currently Unavailable or unauthorized to
                                view
                                <button
                                    onClick={() => navigate('/authcallback')}
                                    className="button"
                                >
                                    Back to Dashboard
                                </button>
                            </div>
                        ) : (
                            <div className="video-details">
                                <video
                                    width="100%"
                                    height="auto"
                                    controls
                                    onError={handleError}
                                    src={`/api/proxy/videos/${video?.id}`}
                                >
                                    Your browser does not support the video tag.
                                </video>
                                <div className="video-title">
                                    {video?.title}
                                </div>
                                <div className="video-description">
                                    {video?.description}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
