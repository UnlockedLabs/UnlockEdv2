import { ResourceLink } from '@/common';
import { useState } from 'react';

export default function LinkItem({
    linkName,
    linkURL,
    callUpdateLink
}: {
    linkName: string;
    linkURL: string;
    callUpdateLink: (newLinkPair: CategoryLink) => void;
}) {
    const [name, setName] = useState(linkName);
    const [url, setURL] = useState(linkURL);

    return (
        <li className="flex flex-cols-2 gap-2 w-full">
            <input
                type="text"
                defaultValue={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={() => {
                    const newLinkPair: ResourceLink = {};
                    newLinkPair[name] = url;
                    callUpdateLink(newLinkPair);
                }}
                className="input input-bordered w-1/3"
            />
            <input
                type="text"
                defaultValue={url}
                onChange={(e) => setURL(e.target.value)}
                onBlur={() => {
                    const newLinkPair: ResourceLink = {};
                    newLinkPair[name] = url;
                    callUpdateLink(newLinkPair);
                }}
                className="input input-bordered w-2/3"
            />
        </li>
    );
}
