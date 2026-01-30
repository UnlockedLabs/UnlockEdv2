import React, { createContext, useContext, useState, ReactNode } from 'react';
import { BreadcrumbItem } from '@/Components/Breadcrumb';

interface BreadcrumbContextType {
    breadcrumbItems: BreadcrumbItem[];
    setBreadcrumbItems: (items: BreadcrumbItem[]) => void;
}

const BreadcrumbContext = createContext<BreadcrumbContextType | undefined>(
    undefined
);

export const useBreadcrumb = (): BreadcrumbContextType => {
    const context = useContext(BreadcrumbContext);
    if (!context) {
        throw new Error(
            'useBreadcrumb must be used within a BreadcrumbProvider'
        );
    }
    return context;
};

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
