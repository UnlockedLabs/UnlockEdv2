import { createContext, useContext } from 'react';
import { BreadcrumbItem } from '@/types';

export interface BreadcrumbContextType {
    breadcrumbItems: BreadcrumbItem[];
    setBreadcrumbItems: (items: BreadcrumbItem[]) => void;
}

export const BreadcrumbContext = createContext<
    BreadcrumbContextType | undefined
>(undefined);

export const useBreadcrumb = (): BreadcrumbContextType => {
    const context = useContext(BreadcrumbContext);
    if (!context) {
        throw new Error(
            'useBreadcrumb must be used within a BreadcrumbProvider'
        );
    }
    return context;
};
