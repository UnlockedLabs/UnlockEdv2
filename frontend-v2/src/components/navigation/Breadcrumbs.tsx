import { Link } from 'react-router-dom';
import { ChevronRightIcon } from '@heroicons/react/24/outline';
import { BreadcrumbItem as BreadcrumbItemType } from '@/types';

export default function Breadcrumbs({
    items,
    className
}: {
    items: BreadcrumbItemType[];
    className?: string;
}) {
    if (items.length === 0) return null;

    const baseClassName = className ?? 'mb-6 mt-2';

    return (
        <nav
            className={`flex items-center gap-2 text-[14px] leading-5 ${baseClassName}`.trim()}
        >
            {items.map((item, index) => {
                const isLast = index === items.length - 1;
                return (
                    <div
                        key={`${index}-${item.label}`}
                        className="flex items-center gap-2"
                    >
                        {index > 0 && (
                            <ChevronRightIcon className="size-4 text-gray-400" />
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
