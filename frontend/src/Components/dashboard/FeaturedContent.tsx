import { Library, UserRole } from '@/common';
import LibraryCard from '../LibraryCard';
import { useAuth } from '@/useAuth';

export default function FeaturedContent({
    featured,
    mutate
}: {
    featured: Library[];
    mutate?: () => void;
}) {
    const { user } = useAuth();
    const cols = user?.role == UserRole.Student ? 3 : 4;
    return (
        <>
            <h2>Featured Content</h2>
            <div
                className={`card card-row-padding grid grid-cols-${cols} gap-3`}
            >
                {featured.map((item: Library) => {
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
        </>
    );
}
