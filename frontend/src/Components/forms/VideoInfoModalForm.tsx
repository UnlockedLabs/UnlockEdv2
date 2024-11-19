import { getVideoErrorMessage, MAX_DOWNLOAD_ATTEMPTS, Video } from '@/common';
import { CloseX } from '../inputs';
import { isAdministrator, useAuth } from '@/useAuth';

export interface VideoErrorFormProps {
    video: Video;
    onClose: () => void;
}

export default function VideoInfoModalForm({
    video,
    onClose
}: VideoErrorFormProps) {
    const { user } = useAuth();
    if (!user || isAdministrator(user)) {
        return null;
    }

    const prepError = () => {
        return video.video_download_attempts.length >= MAX_DOWNLOAD_ATTEMPTS
            ? `This video has reached the maximum download attempts. Please remove and try again`
            : `Download is processsing: ${getVideoErrorMessage(video) ?? ''}
               The video download will be retried every 3 hours`;
    };

    return (
        <div>
            <CloseX close={() => onClose()} />
            <div className="flex flex-row">
                <div className="stats shadow mx-auto">
                    <div className="stat">
                        <div className="stat-title">Video download info</div>
                        <div className="pt-5 text-sm text-wrap">
                            {prepError()}
                        </div>
                    </div>
                </div>
            </div>
            <p className="py-4"></p>
        </div>
    );
}
