import { OpenContentFavorite, OpenContentItem } from '@/common';
import { useNavigate } from 'react-router-dom';

export default function OpenContentCardRow({
    content
}: {
    content: OpenContentItem | OpenContentFavorite;
}) {
    const navigate = useNavigate();
    function redirectToViewer() {
        if ('url' in content) {
            if (content.type === 'video') {
                navigate(`/viewer/videos/${content.content_id}`);
            } else if (content.type === 'library') {
                navigate(`/viewer/libraries/${content.content_id}`);
            }
        }
    }

    return (
        <div
            className="card flex flex-row w-full gap-3 px-4 py-2"
            onClick={redirectToViewer}
        >
            <div className="w-[100px]">
                <img
                    className="h-12 mx-auto object-contain"
                    src={content.thumbnail_url ?? ''}
                ></img>
            </div>
            <h3 className="my-auto w-full">{content.name ?? 'Untitled'}</h3>
        </div>
    );
}
