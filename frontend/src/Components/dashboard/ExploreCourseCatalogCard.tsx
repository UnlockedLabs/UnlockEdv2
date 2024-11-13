import {
    ArrowRightIcon,
    BuildingStorefrontIcon
} from '@heroicons/react/24/outline';
import { Link } from 'react-router-dom';
const ExploreCourseCatalogCard = () => {
    return (
        <div className="card card-compact bg-inner-background relative">
            <figure className="h-[124px] bg-teal-3">
                <BuildingStorefrontIcon className="h-20 text-background" />
            </figure>
            <div className="card-body gap-0.5">
                <h3 className="card-title text-sm">Explore Course Catalog</h3>
                <p className="body-small line-clamp-4">
                    Looking for more content to engage with? Browse courses
                    offered at your facility.
                </p>
                <Link
                    className="flex flex-row gap-1 body-small text-teal-3 mt-2"
                    to={`/course-catalog`}
                >
                    Explore courses
                    <ArrowRightIcon className="w-4" />
                </Link>
            </div>
        </div>
    );
};

export default ExploreCourseCatalogCard;
