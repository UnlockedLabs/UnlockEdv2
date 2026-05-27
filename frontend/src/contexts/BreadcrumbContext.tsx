import React, { useState, ReactNode } from 'react';
import { BreadcrumbItem } from '@/types';
import { BreadcrumbContext } from '@/contexts/useBreadcrumb';

interface BreadcrumbProviderProps {
    children: ReactNode;
}

export const BreadcrumbProvider: React.FC<BreadcrumbProviderProps> = ({
    children
}) => {
    const [breadcrumbItems, setBreadcrumbItems] = useState<BreadcrumbItem[]>(
        []
    );

    return (
        <BreadcrumbContext.Provider
            value={{ breadcrumbItems, setBreadcrumbItems }}
        >
            {children}
        </BreadcrumbContext.Provider>
    );
};
