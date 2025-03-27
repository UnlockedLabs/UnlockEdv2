import { useEffect, useState } from 'react';
import { ViewType } from '@/common';

export function useSessionViewType(storageKey: string) {
    const [activeView, setActiveView] = useState<ViewType>(() => {
        if (typeof window === 'undefined') {
            return ViewType.Grid;
        }

        const savedValue = sessionStorage.getItem(storageKey);
        if (!savedValue) {
            return ViewType.Grid;
        }
        return savedValue === 'list' ? ViewType.List : ViewType.Grid;
    });
    useEffect(() => {
        if (typeof window !== 'undefined') {
            sessionStorage.setItem(
                storageKey,
                activeView === ViewType.List ? 'list' : 'grid'
            );
        }
    }, [activeView, storageKey]);

    return [activeView, setActiveView] as const;
}
