import { OpenContentItem } from '@/common';
import { useNavigate } from 'react-router-dom';
import ClampedText from '../ClampedText';

export default function OpenContentCardRow({
    content
}: {
    content: OpenContentItem;
}) {
    const navigate = useNavigate();
    function redirectToViewer() {
        if (content.visibility_status != null && !content.visibility_status)
            return;
        const basePath =
            content.content_type === 'video'
                ? `/viewer/videos/${content.content_id}`
                : `/viewer/libraries/${content.content_id}`;
        const obj =
            content.content_type === 'library'
                ? { state: { url: content.url, title: content.title } }
                : {};
        navigate(basePath, obj);
    }
    function getThumbnailUrl(oc: OpenContentItem): string {
        switch (oc.content_type) {
            case 'video':
                return `/api/photos/${oc.external_id}.jpg`;
            default:
                return oc.thumbnail_url ?? '/ul-logo.png';
        }
    }
    return (
        <div
            className={`card ${content.visibility_status == null || content.visibility_status ? 'cursor-pointer' : 'bg-grey-2 cursor-not-allowed'} flex flex-row w-full gap-3 px-4 py-2 tooltip`}
            {...(content.visibility_status != null &&
                !content.visibility_status && {
                    'data-tip': 'This content is no longer accessible'
                })}
            onClick={redirectToViewer}
        >
            <div>
                <img
                    className="h-8 mx-auto object-contain"
                    src={getThumbnailUrl(content)}
                ></img>
            </div>
            <ClampedText
                as="h3"
                lines={1}
                className="my-auto w-full body font-normal text-left"
            >
                {content.title ?? 'Untitled'}
            </ClampedText>
        </div>
    );
}
