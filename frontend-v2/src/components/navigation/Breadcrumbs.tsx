import { Fragment } from 'react';
import { Link } from 'react-router-dom';
import { BreadcrumbItem as BreadcrumbItemType } from '@/types';
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator
} from '@/components/ui/breadcrumb';

export default function Breadcrumbs({
    items
}: {
    items: BreadcrumbItemType[];
}) {
    if (items.length === 0) return null;

    return (
        <Breadcrumb className="mb-6">
            <BreadcrumbList>
                {items.map((item, index) => {
                    const isLast = index === items.length - 1;
                    return (
                        <Fragment key={`${index}-${item.label}`}>
                            <BreadcrumbItem>
                                {isLast || !item.href ? (
                                    <BreadcrumbPage className="text-gray-900 dark:text-gray-100 font-medium">
                                        {item.label}
                                    </BreadcrumbPage>
                                ) : (
                                    <BreadcrumbLink
                                        asChild
                                        className="text-[#556830] hover:text-[#203622] dark:text-[#8fb55e] dark:hover:text-[#a8d070] hover:underline transition-colors"
                                    >
                                        <Link to={item.href}>
                                            {item.label}
                                        </Link>
                                    </BreadcrumbLink>
                                )}
                            </BreadcrumbItem>
                            {!isLast && (
                                <BreadcrumbSeparator className="text-gray-400 [&>svg]:size-4" />
                            )}
                        </Fragment>
                    );
                })}
            </BreadcrumbList>
        </Breadcrumb>
    );
}
