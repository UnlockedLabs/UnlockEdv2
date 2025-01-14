import { Library, UserRole } from '@/common';
import LibraryCard from '../LibraryCard';
import { useAuth } from '@/useAuth';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
    const isAdmin =
        user?.role === UserRole.Admin || user?.role === UserRole.SystemAdmin;

    const navigate = useNavigate();

    const handleEmptyStateClick = () => {
        if (isAdmin) {
            navigate('/knowledge-center-management/libraries', {
                replace: true
            });
        }
    };
    if (!featured.length && !isAdmin) {
        return null;
    }

    return (
        <>
            <h2>Featured Content</h2>
            <div className="card card-row-padding flex flex-col gap-3">
                {featured.length > 0 ? (
                    <>
                        <div className={`grid grid-cols-${cols} gap-3`}>
                            {featured.slice(0, slice).map((item: Library) => (
                                <LibraryCard
                                    key={item.id}
                                    library={item}
                                    role={UserRole.Student}
                                    mutate={mutate}
                                />
                            ))}
                        </div>
                        {featured.length > cols && (
                            <button
                                className="flex justify-end text-teal-3 hover:text-teal-4 body"
                                onClick={() => setExpanded(!expanded)}
                            >
                                {expanded
                                    ? 'See less'
                                    : 'See more featured content'}
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
                                Feature content to showcase
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}
