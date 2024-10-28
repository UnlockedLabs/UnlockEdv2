import { useState } from 'react';
import API from '@/api/api';
import { Video } from '@/common';
import PrimaryButton from '../PrimaryButton';

interface EditVideoFormProps {
    video: Video;
    onSuccess: () => void;
    onCancel: () => void;
}

export default function EditVideoForm({
    video,
    onSuccess,
    onCancel
}: EditVideoFormProps) {
    const [title, setTitle] = useState(video.title);
    const [visibilityStatus, setVisibilityStatus] = useState(
        video.visibility_status
    );
    const [loading, setLoading] = useState(false);

    const handleEditVideo = async () => {
        setLoading(true);
        const response = await API.put(`/videos/${video.id}`, {
            title,
            visibility_status: visibilityStatus
        });

        if (response.success) {
            onSuccess();
        } else {
            setLoading(false);
            onCancel();
        }
    };

    return (
        <div className="flex flex-col space-y-4">
            <label className="label">
                <span className="label-text">Video Title</span>
            </label>
            <input
                type="text"
                className="input input-bordered w-full"
                placeholder="Video Title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
            />
            <div className="flex items-center space-x-2">
                <label className="label cursor-pointer">
                    <span className="label-text">Visibility</span>
                </label>
                <input
                    type="checkbox"
                    className="toggle toggle-primary"
                    checked={visibilityStatus}
                    onChange={(e) => setVisibilityStatus(e.target.checked)}
                />
            </div>
            <button
                className={`btn btn-primary ${loading ? 'loading' : ''}`}
                onClick={void handleEditVideo}
                disabled={loading}
            >
                Save Changes
            </button>
            <PrimaryButton onClick={onCancel}> Cancel </PrimaryButton>
        </div>
    );
}
