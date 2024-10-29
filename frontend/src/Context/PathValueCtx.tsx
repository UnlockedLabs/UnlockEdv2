import { createContext, useContext, useState } from 'react';

const PathValueContext = createContext<{
    pathVal: PathValue[] | null;
    setPathVal: (val: PathValue[]) => void;
}>({
    pathVal: null,
    setPathVal: () => {
        return;
    }
});

export interface PathValue {
    path_id: string;
    value: string;
    [key: string]: string;
}
export const PathValueProvider: React.FC<{ children: React.ReactNode }> = ({
    children
}) => {
    const [pathVal, setPathVal] = useState<PathValue[] | null>(null);
    return (
        <PathValueContext.Provider value={{ pathVal, setPathVal }}>
            {children}
        </PathValueContext.Provider>
    );
};

export const usePathValue = () => useContext(PathValueContext);
