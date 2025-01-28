import { KiwixItem } from '@/common';

export default function LibrarySearchResultCard({
    item,
    onItemClick
}: {
    item: KiwixItem;
    onItemClick: (url: string, title: string, id?: number) => void;
}) {
    const boldKeywords = (description: string) => {
        const rawPieces = description.split(/<b>(.*?)<\/b>/g);
        const elements = rawPieces.map((word, index) =>
            index % 2 === 1 ? <strong key={index}>{word}</strong> : word
        );
        return <>{elements}</>;
    };
    return (
        <div
            className="card card-row-padding cursor-pointer"
            onClick={() => onItemClick(item.url, item.title, item.id)}
        >
            <div className="flex items-center gap-4 border-b pb-2 mb-2">
                <div className="flex p-4 gap-2">
                    <figure className="w-[48px] h-[48px] bg-cover rounded-md overflow-hidden">
                        <img
                            src={item.thumbnail_url ?? '/kiwix.jpg'}
                            alt={`${item.title} thumbnail`}
                            className="w-full h-full object-cover"
                        />
                    </figure>
                </div>
                <div>
                    <h3 className="text-lg font-bold">{item.page_title}</h3>
                    <p className="body">{item.title}</p>
                </div>
            </div>
            <div className="mt-2">
                <p className="body-small">
                    {item.description ? boldKeywords(item.description) : null}
                </p>
            </div>
        </div>
    );
}
