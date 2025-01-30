import React, { createContext, useContext, useState } from 'react';

interface AuthLayoutPageTitleContextType {
    authLayoutPageTitle: string;
    setAuthLayoutPageTitle: (title: string) => void;
}

const AuthLayoutPageTitleContext = createContext<
    AuthLayoutPageTitleContextType | undefined
>(undefined);

export const useAuthLayoutPageTitle = (): AuthLayoutPageTitleContextType => {
    const context = useContext(AuthLayoutPageTitleContext);
    if (!context) {
        throw new Error(
            'useAuthLayoutPageTitle must be used within a AuthLayoutPageTitleProvider'
        );
    }
    return context;
};

interface AuthLayoutPageTitleProviderProps {
    children: React.ReactNode;
}
export const AuthLayoutPageTitleProvider: React.FC<
    AuthLayoutPageTitleProviderProps
> = ({ children }) => {
    const [authLayoutPageTitle, setAuthLayoutPageTitle] = useState<string>('');

    return (
        <AuthLayoutPageTitleContext.Provider
            value={{ authLayoutPageTitle, setAuthLayoutPageTitle }}
        >
            {children}
        </AuthLayoutPageTitleContext.Provider>
    );
};
