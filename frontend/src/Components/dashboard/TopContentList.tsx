import { OpenContentItem } from '@/common';
import OpenContentCard from '../cards/OpenContentCard';
import ULIComponent from '../ULIComponent';
import { ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';
import ClampedText from '../ClampedText';

export default function TopContentList({
    heading,
    items,
    navigateToOpenContent
}: {
    heading: string;
    items: OpenContentItem[];
    navigateToOpenContent: () => void;
}) {
    return (
        <div className="card card-row-padding flex flex-col gap-3">
            <h2>{heading}</h2>
            {items.map((item: OpenContentItem) => {
                return (
                    <OpenContentCard
                        key={item.content_id + item.url}
                        content={item}
                    />
                );
            })}
            {items.length < 5 && (
                <div
                    className="card cursor-pointer px-4 py-2 flex flex-row gap-2 items-center"
                    onClick={navigateToOpenContent}
                >
                    <ULIComponent
                        tooltipClassName="h-8 flex items-center"
                        icon={ArrowTopRightOnSquareIcon}
                    />
                    <ClampedText as="h3" className="body font-normal">
                        Explore other content offered
                    </ClampedText>
                </div>
            )}
        </div>
    );
}
