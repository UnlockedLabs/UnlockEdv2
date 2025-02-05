import { forwardRef } from 'react';
import { CRUDModalProps, FormModal, videoInputs } from '.';
import { Video } from '@/common';
import API from '@/api/api';
import { FieldValues, SubmitHandler } from 'react-hook-form';
import { useCheckResponse } from '@/Hooks/useCheckResponse';

export const AddVideoModal = forwardRef(function (
    { mutate }: CRUDModalProps<Video>,
    addVideoModal: React.ForwardedRef<HTMLDialogElement>
) {
    const checkResponse = useCheckResponse({
        mutate: mutate,
        refModal: addVideoModal
    });
    const addVideos: SubmitHandler<FieldValues> = async (data) => {
        const videoURLsArray =
            typeof data.videoURLs === 'string'
                ? data.videoURLs.split(',').map((url: string) => url.trim())
                : [];
        const response = await API.post('videos', {
            video_urls: videoURLsArray
        });
        checkResponse(
            response.success,
            'Error downloading videos',
            'Video downloading in progress, this may take several minutes'
        );
    };

    return (
        <FormModal
            ref={addVideoModal}
            title={'Add Videos'}
            inputs={videoInputs}
            onSubmit={addVideos}
        />
    );
});
