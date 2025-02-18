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
            'useAuthLayoutPageTitle must be used within an AuthLayoutPageTitleProvider'
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
        <PageTitleContext.Provider
            value={{ pageTitle: pageTitle, setPageTitle: setPageTitle }}
        >
            {children}
        </PageTitleContext.Provider>
    );
};
