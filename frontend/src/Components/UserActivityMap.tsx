import { useState } from 'react';
import DropdownControl from './inputs/DropdownControl';
import useSWR from 'swr';
import { useAuth } from '@/useAuth';
import { ServerResponse } from '@/common';
import convertSeconds from './ConvertSeconds';

interface ActivityMapData {
    date: string;
    total_time: string;
    quartile: number;
}
const SECONDS_IN_HOUR = 3600;
const DAYS_IN_WEEK = 7;

interface Activities {
    activities: ActivityMapData[];
}

/* interface for dynamically generated year options */
interface ValidYears {
    [year: string]: string;
}

/* subtract a year from a date */
const subtractYear = (date: Date) => {
    const newDate = new Date(date);
    newDate.setUTCFullYear(date.getUTCFullYear() - 1);
    newDate.setUTCDate(newDate.getUTCDate() + 1);
    return newDate;
};

/* predefining tailwind strings lets us assign them dynamically later */
const quartileColors: string[] = [
    'bg-inner-background',
    'bg-teal-1',
    'bg-teal-2',
    'bg-teal-3',
    'bg-teal-4'
];

/* node sizes for the activity map */
const nodeSizes: string =
    'w-1.5 h-1.5 rounded-sm text-xs md:w-2 md:h-2 lg:w-3 lg:h-3 xl:w-3.5 xl:h-3.5 xl:rounded-md';

/* gaps between cells in activity map */
const gapSizes: string = 'p-0 ml-px mt-px md:m-0 md:p-px';

/* main component for the user activity map */
export default function UserActivityMap() {
    const { user } = useAuth();

    const createdAtYear = parseInt(user.created_at.split('-')[0]);

    const [yearEnd, setYearEnd] = useState(new Date());
    const [dropdownValDesc, setDropdownValDesc] = useState('the past year');

    const { data, error, isLoading } = useSWR<ServerResponse<Activities>>(
        `/api/users/${user.id}/daily-activity${dropdownValDesc !== 'the past year' ? '?year=' + dropdownValDesc.trim() : ''}`
    );
    const activityData = data?.data ? (data.data as Activities).activities : [];

    const generateYearOptions = () => {
        const years: ValidYears = { 'Past year': 'Past year' };
        const currentYear = new Date().getUTCFullYear();
        let i = currentYear - createdAtYear;
        for (i; i >= 0; i--) {
            /* added " " to change listed order without impacting appearance */
            const str = ' ' + String(createdAtYear + i);
            years[str] = str;
        }
        return years;
    };

    const dropdownChange = (val: string) => {
        let date: Date;
        if (val == 'Past year') {
            date = new Date();
            setYearEnd(date);
            val = 'the past year';
        } else {
            date = new Date(Number(val), 0, 1);
            setYearEnd(new Date(Number(val), 11, 31));
        }
        setDropdownValDesc(val);
    };

    /* generate nodes for the legend */
    const legendNodes: JSX.Element[] = [];
    for (let i = 0; i < 5; i++) {
        legendNodes.push(<Node quartile={i} key={i} />);
    }

    const yearOptions = generateYearOptions();

    return (
        // <div className="w-[25.375rem] md:w-[35.25rem] lg:w-[49.875rem] xl:w-[65.063rem]">
        <div className="card bg-base-teal h-full p-4 max-w-[922px]">
            <div className="flex justify-between items-center h-1/4 w-full">
                <form className="">
                    <DropdownControl
                        label=""
                        callback={dropdownChange}
                        enumType={yearOptions}
                    />
                </form>
                <div className={'block font-bold text-center text'}>
                    {/* Could put something here, like "Keep up the good work!" */}
                </div>
                <div className={'text-xs md:text-sm my-auto gap-x-1 flex'}>
                    <div>Less</div>
                    {legendNodes.map((node) => node)}
                    <div>More</div>
                </div>
            </div>
            {/* <div className="w-[372px] h-[99px] md:w-[530px] md:h-[124px] lg:w-[764px] lg:h-[152px] xl:w-[1017px] xl:h-[184px]"> */}
            <div className="w-full h-3/4 max-h-[184px]">
                {error ? (
                    <div className="flex h-full justify-center content-center">
                        <div className="font-bold my-auto">
                            Error loading activity. Please try again later.
                        </div>
                    </div>
                ) : isLoading ? (
                    <div className="flex h-full justify-center content-center">
                        <span className="my-auto loading loading-spinner loading-lg"></span>
                    </div>
                ) : (
                    data && (
                        <div className="mt-2">
                            <ActivityMapTable
                                data={activityData}
                                end={yearEnd}
                                error={error}
                                isLoading={isLoading}
                                range={dropdownValDesc}
                            />
                        </div>
                    )
                )}
            </div>
        </div>
    );
}

/* component for the cells of our activity map */
function Node({
    quartile,
    date,
    activity_time
}: {
    quartile: number;
    date?: Date;
    activity_time?: string;
}) {
    let tooltipString = '';
    if (!date) {
        /* if node is from legend */
        return (
            <div
                className={`m-auto border border-neutral/20 ${nodeSizes} ${quartileColors[quartile]}`}
            />
        );
    }
    if (!activity_time) {
        tooltipString = 'No activity on ' + date.toISOString().split('T')[0];
    } else {
        tooltipString = `${activity_time} on ${date?.toISOString().split('T')[0]}`;
    }
    return (
        <div
            className={`m-auto border border-neutral/20 p-0 ${nodeSizes} ${quartileColors[quartile]}`}
        >
            <div className="tooltip h-full w-full" data-tip={tooltipString} />
        </div>
    );
}

/* component that builds the activity map table */
function ActivityMapTable({
    data,
    end,
    error,
    isLoading,
    range
}: {
    data: ActivityMapData[];
    end: Date;
    error: any; // eslint-disable-line
    isLoading: boolean;
    range: string;
}) {
    /* array that holds cells for the table */
    const tableData: JSX.Element[] = [];
    const tableMonths: string[] = [];
    let i: number;
    const len = data?.length;
    //  const now = new Date();
    let aggregateActivityTime = 0;
    let oldMonth: number, newMonth: number;

    const getAggregateActivityTime = (time: number) => {
        if (error) {
            return 'Error fetching activity data';
        }
        if (isLoading) {
            return 'Loading...';
        } else if (time == 0) {
            return 'No activity ';
        } else if (time == 1) {
            return 'You have completed one hour of activity';
        } else {
            return 'You have completed ' + String(time) + ' hours of activity';
        }
    };

    const insertMonthHeader = (date: Date) => {
        const months = [
            'Jan',
            'Feb',
            'Mar',
            'Apr',
            'May',
            'Jun',
            'Jul',
            'Aug',
            'Sep',
            'Oct',
            'Nov',
            'Dec'
        ];
        tableMonths.push(months[date.getUTCMonth()]);
    };

    const dateCount = subtractYear(end);

    /* add spacers for days of week before activity range */
    for (i = 0; i < dateCount.getUTCDay(); i++) {
        tableData.push(
            <td className={'block ' + gapSizes} key={i}>
                <div className={`${nodeSizes}`}></div>
            </td>
        );
    }

    i = new Date().getDay() + 1;

    /* fill first months array element if range starts midweek */
    if (dateCount.getUTCDay() != 0) {
        if (dateCount.getUTCDate() < 8) {
            insertMonthHeader(dateCount);
        } else {
            tableMonths.push('');
        }
    }

    /* fill cells with Nodes for days in range */
    while (dateCount <= end) {
        /* at start of new week, if new, push month, else push empty string */
        if (dateCount.getUTCDay() == 0) {
            newMonth = dateCount.getUTCMonth();
            if (
                newMonth != oldMonth &&
                dateCount.getUTCDate() <= DAYS_IN_WEEK &&
                tableMonths[tableMonths.length - 1] == ''
            ) {
                insertMonthHeader(dateCount);
            } else {
                tableMonths.push('');
            }
            oldMonth = newMonth;
        }

        /* in range and activity on date */
        if (
            i < len &&
            dateCount.toISOString().split('T')[0] == data[i].date.split('T')[0]
        ) {
            const activityTime = convertSeconds(Number(data[i].total_time));
            tableData.push(
                <td className="block" key={dateCount.getTime()}>
                    <Node
                        date={new Date(dateCount)}
                        activity_time={
                            activityTime.number + ' ' + activityTime.label
                        }
                        quartile={data[i].quartile}
                    />
                </td>
            );
            aggregateActivityTime += Number(data[i].total_time);
            i += 1;
        } else {
            tableData.push(
                <td className={'block ' + gapSizes} key={dateCount.getTime()}>
                    <Node date={new Date(dateCount)} quartile={0} />
                </td>
            );
        }
        dateCount.setUTCDate(dateCount.getUTCDate() + 1);
    }

    /* add empty cells for days of week after activity range */
    for (i = dateCount.getUTCDay(); i < DAYS_IN_WEEK; i++) {
        tableData.push(
            <td className={'block ' + gapSizes} key={i + DAYS_IN_WEEK}>
                <div className={`${nodeSizes}`}></div>
            </td>
        );
    }
    return (
        <>
            <table className="table-auto ml-5 lg:ml-6">
                <tbody>
                    <tr>
                        {tableMonths.map((node, index) => {
                            return (
                                <td
                                    className={nodeSizes + ' m-auto'}
                                    key={index}
                                >
                                    {node}
                                </td>
                            );
                        })}
                    </tr>
                </tbody>
            </table>
            <table className="table-auto">
                <tbody className="block whitespace-nowrap">
                    <tr className="text-center leading-3 mr-2 hidden lg:inline-block">
                        <td className="block">
                            <div className={nodeSizes}></div>
                        </td>
                        <td className="block -mt-1">
                            <div className={nodeSizes}>M</div>
                        </td>
                        <td className="block">
                            <div className={nodeSizes}></div>
                        </td>
                        <td className="block">
                            <div className={nodeSizes}>W</div>
                        </td>
                        <td className="block">
                            <div className={nodeSizes}></div>
                        </td>
                        <td className="block">
                            <div className={nodeSizes}>F</div>
                        </td>
                        <td className="block">
                            <div className={nodeSizes}></div>
                        </td>
                    </tr>
                    {tableData.map((_, index) => {
                        if (index % DAYS_IN_WEEK == 0) {
                            return (
                                <tr className="inline-block" key={index}>
                                    {tableData
                                        .slice(index, index + DAYS_IN_WEEK)
                                        .map((node) => {
                                            return node;
                                        })}
                                </tr>
                            );
                        }
                    })}
                </tbody>
            </table>
            <div className="block text-xs md:text-sm font-bold text-center mt-4">
                {isLoading || error
                    ? undefined
                    : getAggregateActivityTime(
                          Math.floor(aggregateActivityTime / SECONDS_IN_HOUR)
                      ) +
                      ' in ' +
                      range +
                      '.'}
            </div>
        </>
    );
}
