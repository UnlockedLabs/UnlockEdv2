import React, { useState, ReactNode } from 'react';
import { PageTitleContext } from '@/contexts/usePageTitle';

interface PageTitleProviderProps {
    children: ReactNode;
}

export const PageTitleProvider: React.FC<PageTitleProviderProps> = ({
    children
}) => {
    const [pageTitle, setPageTitle] = useState<string>('UnlockEd');

    return (
        <PageTitleContext.Provider value={{ pageTitle, setPageTitle }}>
            {children}
        </PageTitleContext.Provider>
    );
};
