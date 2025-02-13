import { isAdministrator, useAuth } from '@/useAuth';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function ExpandableCardGrid<T>({
    items,
    children,
    emptyStateText,
    emptyStateLink,
    title,
    cols = 4
}: {
    items: T[];
    children: (item: T) => React.ReactNode; // Child function to render each item
    emptyStateText?: string;
    emptyStateLink?: string;
    title?: string;
    cols?: number;
}) {
    const { user } = useAuth();
    const [expanded, setExpanded] = useState<boolean>(false);
    const slice = expanded ? items.length : cols;
    const isAdmin = isAdministrator(user);
    const navigate = useNavigate();

    const handleEmptyStateClick = () => {
        if (isAdmin && emptyStateLink) {
            navigate(emptyStateLink, {
                replace: true
            });
        }
    };

    if (!items.length && !isAdmin) {
        return null;
    }

    return (
        <>
            <h2>{title}</h2>
            <div className="card card-row-padding flex flex-col gap-3">
                {items.length > 0 ? (
                    <>
                        <div className={`grid grid-cols-${cols} gap-3`}>
                            {items
                                .slice(0, slice)
                                .map((item: T) => children(item))}
                        </div>
                        {items.length > cols && (
                            <button
                                className="flex justify-end text-teal-3 hover:text-teal-4 body"
                                onClick={() => setExpanded(!expanded)}
                            >
                                {expanded ? 'See less' : 'See more'}
                            </button>
                        )}
                    </>
                ) : (
                    <div className={`grid grid-cols-${cols} gap-3`}>
                        <div
                            onClick={handleEmptyStateClick}
                            className="card border-2 border-dashed border-teal-3 cursor-pointer hover:bg-teal-1 transition-colors h-[168px] flex items-center justify-center"
                        >
                            <p className="text-teal-4 text-lg text-center px-4">
                                {emptyStateText ?? 'No items to display'}
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}
