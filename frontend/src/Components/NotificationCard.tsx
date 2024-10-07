import { Announcement, NotificationType } from '@/common.ts';

export default function NotificationCard({
    cardInfo,
    type
}: {
    cardInfo: Announcement;
    type: NotificationType;
}) {
    return (
        <a className="bg-base-teal p-4 card" href={cardInfo.url}>
            <h3 className="body text-teal-4">
                {cardInfo.course_name && cardInfo.course_name + ': '}
                {cardInfo.title}
            </h3>
            {type == NotificationType.Announcement ? (
                <p className="body-small mt-2">{cardInfo.message}</p>
            ) : (
                <>
                    <p className="body-small mt-2">
                        {cardInfo.course_name +
                            ' | ' +
                            cardInfo.provider_platform}
                    </p>
                    <p className="body-small mt-2">
                        {cardInfo.due.toUTCString()}
                    </p>
                </>
            )}
        </a>
    );
}
