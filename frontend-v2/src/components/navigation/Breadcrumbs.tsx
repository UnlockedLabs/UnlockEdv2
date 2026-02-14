import { Link } from 'react-router-dom';
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator
} from '@/components/ui/breadcrumb';
import { BreadcrumbItem as BreadcrumbItemType } from '@/types';
import { Fragment } from 'react';

export default function Breadcrumbs({
    items
}: {
    items: BreadcrumbItemType[];
}) {
    if (items.length === 0) return null;

    return (
        <Breadcrumb>
            <BreadcrumbList>
                {items.map((item, index) => {
                    const isLast = index === items.length - 1;
                    return (
                        <Fragment key={item.label}>
                            <BreadcrumbItem>
                                {isLast || !item.href ? (
                                    <BreadcrumbPage>
                                        {item.label}
                                    </BreadcrumbPage>
                                ) : (
                                    <BreadcrumbLink asChild>
                                        <Link to={item.href}>
                                            {item.label}
                                        </Link>
                                    </BreadcrumbLink>
                                )}
                            </BreadcrumbItem>
                            {!isLast && <BreadcrumbSeparator />}
                        </Fragment>
                    );
                })}
            </BreadcrumbList>
        </Breadcrumb>
    );
}
