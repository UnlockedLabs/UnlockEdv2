import { OpenContentItem } from '@/common';
import {
    ChevronRightIcon,
    VideoCameraIcon,
    BookOpenIcon,
    InformationCircleIcon
} from '@heroicons/react/24/solid';
import React, { useState } from 'react';
import OpenContentCard from './cards/OpenContentCard';

type OpenContentItemMap = Record<string, OpenContentItem[]>;

export default function OpenContentItemAccordion({
    items
}: {
    items: OpenContentItem[];
}) {
    const contentMap: OpenContentItemMap = {};
    items.forEach((item) => {
        let sectionKey;
        switch (item.content_type) {
            case 'video':
                sectionKey = 'Videos';
                break;
            case 'library':
                sectionKey = 'Libraries';
                break;
            case 'helpful_link':
                sectionKey = 'Helpful Links';
                break;
            default:
                sectionKey = 'All Others';
                break;
        }
        if (!contentMap[sectionKey]) {
            contentMap[sectionKey] = [];
        }
        contentMap[sectionKey].push(item);
    });
    const [activeKey, setActiveKey] = useState<string | null>(null);
    const toggleAccordion = (key: string) => {
        setActiveKey(activeKey === key ? null : key);
    };
    const displayIconByTitle = (title: string) => {
        let icon = null;
        switch (title) {
            case 'Videos':
                icon = <VideoCameraIcon className="w-4" />;
                break;
            case 'Libraries':
                icon = <BookOpenIcon className="w-4" />;
                break;
            case 'Helpful Links':
                icon = <InformationCircleIcon className="w-4" />;
                break;
            default:
                break;
        }
        return icon;
    };
    return (
        <div className="w-full max-w-md mx-auto">
            {Object.entries(contentMap).map(([title, contentItems]) => (
                <div key={title} className="border-b">
                    <button
                        className="flex items-center w-full px-4 py-3 text-left"
                        onClick={() => toggleAccordion(title)}
                    >
                        <ChevronRightIcon
                            className={`w-4 mr-3 transform transition-transform ${
                                activeKey === title ? 'rotate-90' : ''
                            }`}
                        />
                        {displayIconByTitle(title)}
                        <span className="flex-1 text-lg font-medium ml-2">
                            {title}
                        </span>
                    </button>
                    <div
                        className={`overflow-hidden transition-[max-height] duration-700 ${
                            activeKey === title ? 'max-h-[800px]' : 'max-h-0'
                        }`}
                    >
                        {contentItems.map((item) => (
                            <OpenContentCard
                                key={item.content_id}
                                content={item}
                            />
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}
