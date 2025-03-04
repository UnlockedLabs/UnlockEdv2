import { Tab } from '@/common';

export default function TabView({
    tabs,
    activeTab,
    setActiveTab
}: {
    tabs: Tab[];
    activeTab: Tab;
    setActiveTab: (tab: Tab) => void;
}) {
    return (
        <div className="flex flex-row w-100 border-b-2 border-grey-2">
            {tabs.map((tab, index) => {
                const tabName =
                    tab.name.charAt(0).toUpperCase() + tab.name.slice(1);
                const isActive = activeTab.value === tab.value;
                return (
                    <button
                        key={index}
                        onClick={() => setActiveTab(tab)}
                        className={`focus:outline-none py-3 px-8 ${
                            isActive
                                ? 'font-bold text-teal-4 border-b-2 border-teal-4'
                                : 'hover:scale-105 hover:text-teal-3 hover:drop-shadow hover:border-b-2 hover:border-teal-3'
                        }`}
                    >
                        {tabName}
                    </button>
                );
            })}
        </div>
    );
}
