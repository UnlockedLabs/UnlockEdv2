import { createContext, useContext, useState } from 'react';

const PathValueContext = createContext<{
    pathVal: string | null;
    setPathVal: (val: string) => void;
}>({
    pathVal: null,
    setPathVal: () => {
        return;
    }
});

export const PathValueProvider: React.FC<{ children: React.ReactNode }> = ({
    children
}) => {
    const [pathVal, setPathVal] = useState<string | null>(null);
    return (
        <PathValueContext.Provider value={{ pathVal, setPathVal }}>
            {children}
        </PathValueContext.Provider>
    );
};

export const usePathValue = () => useContext(PathValueContext);
