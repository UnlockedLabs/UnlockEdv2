import React, { createContext, useContext, useState, ReactNode } from 'react';

interface PageTitleContextType {
    pageTitle: string;
    setPageTitle: (title: string) => void;
}

const PageTitleContext = createContext<PageTitleContextType | undefined>(
    undefined
);

export const usePageTitle = (): PageTitleContextType => {
    const context = useContext(PageTitleContext);
    if (!context) {
        throw new Error(
            'usePageTitle must be used within a PageTitleProvider'
        );
    }
    return context;
};

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
