import { ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';
import { ReactNode } from 'react';
import { Link } from 'react-router-dom';

export default function InternalLink({
    children,
    url
}: {
    children: ReactNode;
    url: string;
}) {
    return (
        <Link
            className="flex gap-2 body-small text-body-text items-center"
            to={url}
        >
            <ArrowTopRightOnSquareIcon className="w-4" />
            {children}
        </Link>
    );
}
