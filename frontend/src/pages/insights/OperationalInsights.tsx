import { useState } from 'react';
import useSWR from 'swr';
import { ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth, canSwitchFacility } from '@/auth/useAuth';
import { Facility, InsightsRangeKey, ServerResponseMany } from '@/types';
import OverviewTab from './OverviewTab';
import KnowledgeCenterTab from './KnowledgeCenterTab';
import { RANGE_OPTIONS, RANGE_LABELS, rangeToParams } from './insightsRange';

const TAB_TRIGGER_CLASS =
    'flex-none h-auto px-4 py-2.5 rounded-lg transition-all duration-200 data-[state=active]:bg-brand data-[state=active]:text-white data-[state=active]:shadow-sm data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:text-brand-dark data-[state=inactive]:hover:bg-muted';

export default function OperationalInsightsPage() {
    const { user } = useAuth();
    const canSwitch = user ? canSwitchFacility(user) : false;

    const [activeRange, setActiveRange] = useState<InsightsRangeKey>('30D');
    const [customFrom, setCustomFrom] = useState('');
    const [customTo, setCustomTo] = useState('');
    const [selectedFacility, setSelectedFacility] = useState(
        canSwitch ? 'all' : ''
    );

    const { data: facilitiesResp } = useSWR<ServerResponseMany<Facility>>(
        canSwitch ? '/api/facilities' : null
    );

    const dateParams = rangeToParams(activeRange, customFrom, customTo);

    const facilityLabel =
        selectedFacility === 'all'
            ? 'All Facilities'
            : (facilitiesResp?.data?.find(
                  (f) => String(f.id) === selectedFacility
              )?.name ?? 'Selected facility');

    const rangeLabel = `${RANGE_LABELS[activeRange]} · ${canSwitch ? facilityLabel : 'Your facility'}`;

    return (
        <div className="max-w-7xl mx-auto px-6 py-8">
            <div>
                <div className="mb-8">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-brand-dark dark:text-white">
                                Insights
                            </h1>
                            <p className="text-gray-600 dark:text-gray-400 mt-1">
                                Cross-facility activity, engagement & outcomes
                            </p>
                        </div>
                        <Button
                            disabled
                            className="gap-2 bg-brand hover:bg-brand-dark"
                            title="Export is coming in a future release"
                        >
                            <ArrowDownTrayIcon className="size-4" />
                            Export Report
                        </Button>
                    </div>
                </div>

                <div className="bg-card rounded-lg border border-gray-200 dark:border-border p-4 mb-6">
                    <div className="flex items-center gap-3 flex-wrap">
                        <div className="flex items-center gap-1 bg-gray-100 dark:bg-muted rounded-lg p-1">
                            {RANGE_OPTIONS.map((range) => (
                                <button
                                    key={range}
                                    onClick={() => setActiveRange(range)}
                                    className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                                        activeRange === range
                                            ? 'bg-white dark:bg-card shadow-sm text-brand-dark dark:text-white'
                                            : 'text-gray-500 dark:text-gray-400 hover:text-brand-dark dark:hover:text-white'
                                    }`}
                                >
                                    {range}
                                </button>
                            ))}
                        </div>

                        {activeRange === 'Custom' && (
                            <>
                                <input
                                    type="date"
                                    value={customFrom}
                                    onChange={(e) =>
                                        setCustomFrom(e.target.value)
                                    }
                                    className="h-9 text-sm border border-border rounded-md px-3 bg-card text-foreground outline-none focus:ring-2 focus:ring-brand"
                                />
                                <span className="text-muted-foreground text-sm">
                                    to
                                </span>
                                <input
                                    type="date"
                                    value={customTo}
                                    onChange={(e) =>
                                        setCustomTo(e.target.value)
                                    }
                                    className="h-9 text-sm border border-border rounded-md px-3 bg-card text-foreground outline-none focus:ring-2 focus:ring-brand"
                                />
                            </>
                        )}

                        {canSwitch && (
                            <Select
                                value={selectedFacility}
                                onValueChange={setSelectedFacility}
                            >
                                <SelectTrigger className="w-48 h-9 text-sm">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">
                                        All Facilities
                                    </SelectItem>
                                    {facilitiesResp?.data?.map((facility) => (
                                        <SelectItem
                                            key={facility.id}
                                            value={String(facility.id)}
                                        >
                                            {facility.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                    </div>
                </div>

                <Tabs defaultValue="overview" className="space-y-6">
                    <TabsList className="bg-card border border-gray-200 dark:border-border p-1 h-auto gap-1">
                        <TabsTrigger
                            value="overview"
                            className={TAB_TRIGGER_CLASS}
                        >
                            Overview
                        </TabsTrigger>
                        <TabsTrigger
                            value="knowledge-center"
                            className={TAB_TRIGGER_CLASS}
                        >
                            Knowledge Center
                        </TabsTrigger>
                    </TabsList>
                    <TabsContent value="overview" className="mt-0">
                        <OverviewTab
                            dateParams={dateParams}
                            selectedFacility={selectedFacility}
                            canSwitch={canSwitch}
                            rangeLabel={rangeLabel}
                        />
                    </TabsContent>
                    <TabsContent value="knowledge-center" className="mt-0">
                        <KnowledgeCenterTab
                            dateParams={dateParams}
                            selectedFacility={selectedFacility}
                            rangeLabel={rangeLabel}
                        />
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}
