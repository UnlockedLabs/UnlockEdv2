import { Link } from 'react-router-dom';
import { BreadcrumbItem as BreadcrumbItemType } from '@/types';
import { ChevronRight } from 'lucide-react';

export default function Breadcrumbs({
    items
}: {
    items: BreadcrumbItemType[];
}) {
    if (items.length === 0) return null;

    return (
        <nav className="flex items-center gap-2 text-[14px] leading-5 mb-6 mt-2">
            {items.map((item, index) => {
                const isLast = index === items.length - 1;
                return (
                    <div
                        key={`${index}-${item.label}`}
                        className="flex items-center gap-2"
                    >
                        {index > 0 && (
                            <ChevronRight className="size-4 text-gray-400" />
                        )}
                        {item.href && !isLast ? (
                            <Link
                                to={item.href}
                                className="text-[14px] text-[#556830] hover:text-[#203622] hover:underline transition-colors"
                            >
                                {item.label}
                            </Link>
                        ) : (
                            <span
                                className={`text-[14px] ${
                                    isLast
                                        ? 'text-gray-900 font-medium'
                                        : 'text-gray-600'
                                }`}
                            >
                                {item.label}
                            </span>
                        )}
                    </div>
                );
            })}
        </nav>
    );
}
