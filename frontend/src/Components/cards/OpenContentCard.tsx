import { OpenContentItem, ServerResponseOne } from '@/common';
import { useNavigate } from 'react-router-dom';
import ClampedText from '../ClampedText';
import API from '@/api/api';

async function handleHelpfulLinkClick(id: number): Promise<void> {
    const resp = (await API.put<{ url: string }, object>(
        `helpful-links/activity/${id}`,
        {}
    )) as ServerResponseOne<{ url: string }>;
    if (resp.success) {
        window.open(resp.data.url, '_blank');
    }
}
export default function OpenContentCardRow({
    content
}: {
    content: OpenContentItem;
}) {
    const navigate = useNavigate();
    function redirectToViewer() {
        if (content.visibility_status != null && !content.visibility_status)
            return;
        if (content.content_type === 'helpful_link') {
            void handleHelpfulLinkClick(content.content_id);
            return;
        }
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
                    src={content.thumbnail_url ?? ''}
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
