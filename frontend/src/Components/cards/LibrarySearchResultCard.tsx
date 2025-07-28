import { SearchResultItem } from '@/common';

export default function LibrarySearchResultCard({
    item,
    onItemClick
}: {
    item: SearchResultItem;
    onItemClick: (kind: string, url: string, title: string, id: number) => void;
}) {
    const boldKeywords = (description: string) => {
        // Truncates description. Chose ~60 words to be similar to Google search results
        const truncateDescription = (text: string, wordLimit = 60) => {
            const words = text.split(/\s+/);
            if (words.length <= wordLimit) return text;

            let wordCount = 0;
            let result = '';
            let inBoldTag = false;

            for (const word of words) {
                if (word.includes('<b>')) inBoldTag = true;
                if (!inBoldTag || word.includes('</b>')) wordCount++;
                if (word.includes('</b>')) inBoldTag = false;

                result += word + ' ';

                if (wordCount >= wordLimit) {
                    result += '...';
                    break;
                }
            }

            return result.trim();
        };

        const truncated = truncateDescription(description);
        const rawPieces = truncated.split(/<b>(.*?)<\/b>/g);
        const elements = rawPieces.map((word, index) =>
            index % 2 === 1 ? <strong key={index}>{word}</strong> : word
        );
        return <>{elements}</>;
    };
    return (
        <div
            className="card cursor-pointer p-3 hover:bg-grey-1 rounded-md"
            onClick={() =>
                onItemClick(
                    item.content_type,
                    item.url,
                    item.title,
                    item.content_id
                )
            }
        >
            <div className="mb-2">
                <div className="flex items-center gap-2 mb-1">
                    <figure className="w-[24px] h-[24px] flex-shrink-0 bg-cover rounded overflow-hidden">
                        <img
                            src={item.thumbnail_url ?? '/kiwix.jpg'}
                            alt={`${item.title} thumbnail`}
                            className="w-full h-full object-cover"
                        />
                    </figure>
                    <p className="body text-grey-4">{item.title}</p>
                </div>

                <h3 className="text-lg text-teal-3 hover:underline mb-2 leading-tight">
                    {item.page_title}
                </h3>

                <p className="body text-body-text">
                    {item.description ? boldKeywords(item.description) : null}
                </p>
            </div>
        </div>
    );
}
