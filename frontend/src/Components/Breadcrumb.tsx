import { Link } from 'react-router-dom';

export interface BreadcrumbItem {
    label: string;
    href?: string;
}

interface BreadcrumbProps {
    items: BreadcrumbItem[];
}

export default function Breadcrumb({ items }: BreadcrumbProps) {
    return (
        <div className="breadcrumbs text-sm">
            <ul>
                {items.map((item, index) => {
                    const isLast = index === items.length - 1;
                    return (
                        <li key={index}>
                            {item.href && !isLast ? (
                                <Link
                                    to={item.href}
                                    className="text-teal-4 hover:underline"
                                >
                                    {item.label}
                                </Link>
                            ) : (
                                <span className="text-grey-4">
                                    {item.label}
                                </span>
                            )}
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}
