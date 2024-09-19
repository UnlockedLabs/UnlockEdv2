import { ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';
import { ReactNode } from 'react';

export default function ExternalLink({
    children,
    url
}: {
    children: ReactNode;
    url: string;
}) {
    return (
        <a
            className="flex gap-2 body-small text-body-text items-center"
            href={url}
            target="_blank"
            rel="noopener noreferrer"
        >
            <ArrowTopRightOnSquareIcon className="w-4" />
            {children}
        </a>
    );
}
