import { OpenContentItem } from '@/common';
import { useNavigate } from 'react-router-dom';

export default function OpenContentCardRow({
    content
}: {
    content: OpenContentItem;
}) {
    const navigate = useNavigate();
    function redirectToViewer() {
        if (content.visibility_status != null && !content.visibility_status) return;
        const basePath =
            content.content_type === 'video'
                ? `/viewer/videos/${content.content_id}`
                : `/viewer/libraries/${content.content_id}`;
        navigate(basePath);
    }
    return (
        <div
            className={`card ${content.visibility_status == null || content.visibility_status ? 'cursor-pointer' : 'bg-grey-2 cursor-not-allowed'} flex flex-row w-full gap-3 px-4 py-2 tooltip`}
            {...((content.visibility_status != null && !content.visibility_status) && {
                'data-tip': 'This content is no longer accessible'
            })}
            onClick={redirectToViewer}
        >
            <div className="w-[100px]">
                <img
                    className="h-12 mx-auto object-contain"
                    src={content.thumbnail_url ?? ''}
                ></img>
            </div>
            <h3 className="my-auto w-full body font-normal">
                {content.title ?? 'Untitled'}
            </h3>
        </div>
    );
}
