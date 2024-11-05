import { ChangeEvent, useState } from 'react';
import API from '@/api/api';
import { ToastState } from '@/common';

interface AddVideoFormProps {
    onSuccess: (msg: string, state: ToastState) => void;
}

export default function AddVideosForm({ onSuccess }: AddVideoFormProps) {
    const [videoUrls, setVideoUrls] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | undefined>();
    const [badLinks, setBadLinks] = useState<string[]>([]);

    const clearState = () => {
        setLoading(false);
        setVideoUrls('');
        setError(undefined);
        setBadLinks([]);
    };

    const renderBadLinks = () => {
        return (
            <span>
                {badLinks.map((link) => (
                    <p id={link} className="text-red-500">
                        {link}
                    </p>
                ))}
            </span>
        );
    };

    const getInvalidValidURLs = (urls: string[]): string[] | undefined => {
        const badLinks: string[] = [];
        urls.forEach((url) => {
            if (
                url.includes('youtube') &&
                !url.includes('watch?v=') &&
                !url.includes('youtu.be')
            ) {
                badLinks.push(url);
            }
        });
        return badLinks.length > 0 ? badLinks : undefined;
    };

    const handleSetVideoUrl = (e: ChangeEvent<HTMLTextAreaElement>) => {
        // make sure that if they urls added are youtube URL's, that they are valid
        //if not, display an error message
        const videoUrls = e.target.value;
        const urls = videoUrls.split(',');
        const invalid = getInvalidValidURLs(urls);
        if (invalid) {
            setBadLinks([...invalid]);
            setError(`The following links entered are not valid YouTube links`);
        } else if (error) {
            setBadLinks([]);
            setError(undefined);
        }
        setVideoUrls(urls.join(','));
    };

    const handleAddVideos = async () => {
        setLoading(true);
        const urls = videoUrls
            .split(',')
            .map((url) => url.trim())
            .filter((url) => url !== '');

        if (urls.length === 0) {
            onSuccess('Please enter at least one valid URL.', ToastState.error);
            setLoading(false);
            return;
        }
        const response = await API.post('videos', { video_urls: urls });

        const state = response.success ? ToastState.success : ToastState.error;
        const msg = response.success
            ? `Downloading currently in progress: It may take several minutes for all videos to appear`
            : response.message;
        onSuccess(msg, state);
        clearState();
    };

    return (
        <div className="flex flex-col space-y-4">
            <p className="text-sm m-2 text-wrap">
                This will begin to attempt to download videos. You can enter
                links from youtube or any other popular video hosting site. If
                there is an error: downloads will be attempted up to 5 times,
                after which time you will need to re-add the video.
            </p>
            <textarea
                className="textarea textarea-bordered w-full"
                placeholder="Enter YouTube or other video URLs, separated by commas"
                value={videoUrls}
                onChange={(e) => handleSetVideoUrl(e)}
                rows={4}
            />
            {error && (
                <div>
                    <p className="text-red-500">{error}</p> {renderBadLinks()}
                    <button
                        className="btn btn-ghost"
                        onClick={() => {
                            setBadLinks([]);
                            setError(undefined);
                        }}
                    >
                        ignore?
                    </button>
                </div>
            )}
            <button
                className={`btn btn-primary ${loading ? 'loading' : ''}`}
                onClick={() => {
                    void handleAddVideos();
                }}
                disabled={loading}
            >
                Add Videos
            </button>
            <button
                className="btn btn-neutral"
                onClick={() => {
                    clearState();
                    onSuccess('', ToastState.null);
                }}
            >
                Cancel
            </button>
        </div>
    );
}
