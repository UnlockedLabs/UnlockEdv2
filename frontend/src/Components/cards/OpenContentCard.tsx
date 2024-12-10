import { OpenContentFavorite, OpenContentItem } from '@/common';
import { useNavigate } from 'react-router-dom';

export default function OpenContentCardRow({
    content
}: {
    content: OpenContentItem | OpenContentFavorite;
}) {
    const navigate = useNavigate();
    function redirectToViewer() {
        const isFavorite = !('url' in content);
        const type = isFavorite ? content.content_type : content.type;
        const basePath =
            type === 'video'
                ? `/viewer/videos/${content.content_id}`
                : `/viewer/libraries/${content.content_id}`;

        navigate(basePath);
    }

    return (
        <div
            className="card cursor-pointer flex flex-row w-full gap-3 px-4 py-2"
            onClick={redirectToViewer}
        >
            <div className="w-[100px]">
                <img
                    className="h-12 mx-auto object-contain"
                    src={content.thumbnail_url ?? ''}
                ></img>
            </div>
            <h3 className="my-auto w-full body font-normal">
                {content.name ?? 'Untitled'}
            </h3>
        </div>
    );
}
