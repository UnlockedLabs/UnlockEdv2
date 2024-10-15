import { Tab } from '@/common';
import { SetStateAction } from 'react';

export default function TabView({
    tabs,
    activeTab,
    setActiveTab
}: {
    tabs: Tab[];
    activeTab: Tab;
    setActiveTab: (state: SetStateAction<Tab>) => void;
}) {
    return (
        <div className="flex flex-row gap-16 w-100 border-b-2 border-grey-2 py-3">
            {tabs.map((tab: Tab, index: number) => {
                const tabName =
                    tab.name.charAt(0).toUpperCase() + tab.name.slice(1);
                return (
                    <button
                        className={
                            activeTab.value == tab.value
                                ? 'text-teal-4 font-bold drop-shadow'
                                : ''
                        }
                        onClick={() => setActiveTab(tab)}
                        key={index}
                    >
                        {tabName}
                    </button>
                );
            })}
        </div>
    );
}
