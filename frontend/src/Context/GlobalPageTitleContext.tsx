import React, { createContext, useContext, useState } from 'react';

interface GlobalPageTitleContextType {
    globalPageTitle: string;
    setGlobalPageTitle: (title: string) => void;
}

// context should be created here, but what should inital value be? Libray View or Page title of Authenticated Layout
const GlobalPageTitleContext = createContext<
    GlobalPageTitleContextType | undefined
>(undefined);

// this should make the context usable to Library Viewer
export const useGlobalPageTitle = (): GlobalPageTitleContextType => {
    const context = useContext(GlobalPageTitleContext);
    if (!context) {
        throw new Error(
            'useGlobalPageTitle must be used within a GlobalPageTitleProvider'
        );
    }
    return context;
};

interface GlobalPageTitleProviderProps {
    children: React.ReactNode;
}
export const GlobalPageTitleProvider: React.FC<
    GlobalPageTitleProviderProps
> = ({ children }) => {
    const [globalPageTitle, setGlobalPageTitle] =
        useState<string>('Library Viewer');

    return (
        <GlobalPageTitleContext.Provider
            value={{ globalPageTitle, setGlobalPageTitle }}
        >
            {children}
        </GlobalPageTitleContext.Provider>
    );
};
