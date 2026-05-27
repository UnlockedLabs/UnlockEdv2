import { createContext, useContext } from 'react';

export interface PageTitleContextType {
    pageTitle: string;
    setPageTitle: (title: string) => void;
}

export const PageTitleContext = createContext<PageTitleContextType | undefined>(
    undefined
);

export const usePageTitle = (): PageTitleContextType => {
    const context = useContext(PageTitleContext);
    if (!context) {
        throw new Error('usePageTitle must be used within a PageTitleProvider');
    }
    return context;
};
