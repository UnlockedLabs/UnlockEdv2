import { Library, UserRole } from '@/common';
import LibraryCard from '../LibraryCard';
import { useAuth } from '@/useAuth';
import { useState } from 'react';

export default function FeaturedContent({
    featured,
    mutate
}: {
    featured: Library[];
    mutate?: () => void;
}) {
    const { user } = useAuth();
    const [expanded, setExpanded] = useState<boolean>(false);
    const cols = user?.role == UserRole.Student ? 3 : 4;
    const slice = expanded ? featured.length : cols;
    return (
        <>
            <h2>Featured Content</h2>
            <div className="card card-row-padding flex flex-col gap-3">
                <div className={`grid grid-cols-${cols} gap-3`}>
                    {featured.slice(0, slice).map((item: Library) => {
                        return (
                            <LibraryCard
                                key={item.id}
                                library={item}
                                role={UserRole.Student}
                                mutate={mutate}
                            />
                        );
                    })}
                </div>
                <button
                    className="flex justify-end text-teal-3 hover:text-teal-4 body"
                    onClick={() => setExpanded(!expanded)}
                >
                    {expanded ? 'See less' : 'See more featured content'}
                </button>
            </div>
        </>
    );
}
