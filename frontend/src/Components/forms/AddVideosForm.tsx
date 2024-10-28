import { useState } from 'react';
import API from '@/api/api';
import { ToastState } from '@/common';

interface AddVideoFormProps {
    onSuccess: (msg: string, state: ToastState) => void;
}

export default function AddVideosForm({ onSuccess }: AddVideoFormProps) {
    const [videoUrls, setVideoUrls] = useState('');
    const [loading, setLoading] = useState(false);

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
            ? 'Videos added successfully: Downloading currently in progress, they will be available soon'
            : response.message;
        onSuccess(msg, state);
        setLoading(false);
        setVideoUrls('');
    };

    return (
        <div className="flex flex-col space-y-4">
            <textarea
                className="textarea textarea-bordered w-full"
                placeholder="Enter YouTube or other video URLs, separated by commas"
                value={videoUrls}
                onChange={(e) => setVideoUrls(e.target.value)}
                rows={4}
            />
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
                    onSuccess('', ToastState.null);
                }}
            >
                Cancel
            </button>
        </div>
    );
}
