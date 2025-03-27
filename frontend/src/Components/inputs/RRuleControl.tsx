import { useState, forwardRef, useImperativeHandle } from 'react';
import { RRule, Weekday, Options } from 'rrule';
import { DateInput } from '@/Components/inputs';
import {
    UseFormRegister,
    FieldErrors,
    UseFormGetValues
} from 'react-hook-form';

export interface RRuleFormHandle {
    createRule: () => { rule: string; duration: string };
}

const weekdays = [
    { label: 'Mon', value: RRule.MO },
    { label: 'Tue', value: RRule.TU },
    { label: 'Wed', value: RRule.WE },
    { label: 'Thu', value: RRule.TH },
    { label: 'Fri', value: RRule.FR },
    { label: 'Sat', value: RRule.SA },
    { label: 'Sun', value: RRule.SU }
];

interface RRuleControlProp {
    startDateRef: string;
    endDateRef: string;
    errors: FieldErrors<any>; // eslint-disable-line
    register: UseFormRegister<any>; // eslint-disable-line
    getValues: UseFormGetValues<any>; // eslint-disable-line
}
export const RRuleControl = forwardRef<RRuleFormHandle, RRuleControlProp>(
    function RRuleControl(
        { startDateRef, endDateRef, getValues, errors, register },
        ref
    ) {
        const [timeErrors, setTimeErrors] = useState({
            startTime: '',
            endTime: ''
        });
        const [frequency, setFrequency] = useState('WEEKLY');
        const [interval, setInterval] = useState(1);
        const [byWeekDays, setByWeekDays] = useState<Weekday[]>([]);
        const [startTime, setStartTime] = useState('');
        const [endTime, setEndTime] = useState('');
        const [endOption, setEndOption] = useState<'never' | 'until'>('never');
        const toggleWeekday = (day: Weekday) => {
            setByWeekDays((prevDays) =>
                prevDays.includes(day)
                    ? prevDays.filter((d) => d !== day)
                    : [...prevDays, day]
            );
        };

        const FREQ_MAP = {
            DAILY: RRule.DAILY,
            WEEKLY: RRule.WEEKLY,
            MONTHLY: RRule.MONTHLY,
            YEARLY: RRule.YEARLY
        };

        const createRule = () => {
            let returnValue;
            if (isFormValidated() && canCreateRule()) {
                const startDate = getValues(startDateRef); // eslint-disable-line
                const options: Partial<Options> = {
                    freq: FREQ_MAP[frequency as keyof typeof FREQ_MAP],
                    interval,
                    dtstart: new Date(`${startDate}T${startTime}`)
                };

                if (frequency === 'WEEKLY') {
                    options.byweekday = byWeekDays;
                }

                if (endOption === 'until') {
                    options.until = new Date(getValues(endDateRef)); // eslint-disable-line
                }

                const totalStartMin = timeToMinutes(startTime);
                const totalEndMin = timeToMinutes(endTime);
                const totalMin = totalEndMin - totalStartMin;
                const hours = Math.floor(totalMin / 60);
                const minutes = totalMin % 60;

                const rule = new RRule(options);
                returnValue = {
                    rule: rule.toString(),
                    duration: `${hours}h${minutes}m0s`
                };
            } else {
                returnValue = {
                    rule: '',
                    duration: ''
                };
            }

            return returnValue;
        };

        function isFormValidated(): boolean {
            let isValid = true;
            setTimeErrors({ startTime: '', endTime: '' });
            if (!startTime) {
                setTimeErrors((prev) => ({
                    ...prev,
                    startTime: 'Start time is required'
                }));
                isValid = false;
            }
            if (!endTime) {
                setTimeErrors((prev) => ({
                    ...prev,
                    endTime: 'End time is required'
                }));
                isValid = false;
            }

            if (startTime && endTime) {
                const startTotalMin = timeToMinutes(startTime);
                const endTotalMin = timeToMinutes(endTime);
                if (endTotalMin <= startTotalMin) {
                    setTimeErrors((prev) => ({
                        ...prev,
                        endTime: 'End time must be after start time'
                    }));
                    isValid = false;
                }
            }
            return isValid;
        }

        const canCreateRule = () => {
            const startDate = getValues(startDateRef); // eslint-disable-line
            if (!startTime || !startDateRef || startDate == '') return false;
            const start = startTime;
            const end = endTime;
            const startMin = timeToMinutes(start);
            const endMin = timeToMinutes(end);
            return (
                start !== '' && end !== '' && endMin > startMin && interval >= 1
            );
        };

        function timeToMinutes(timeStr: string): number {
            const [hour, minute] = timeStr.split(':').map(Number);
            return hour * 60 + minute;
        }

        useImperativeHandle(ref, () => ({ createRule: createRule }));

        return (
            <div className="space-y-6">
                <DateInput
                    label="Start Date"
                    register={register}
                    interfaceRef={startDateRef}
                    required
                    errors={errors}
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className="label label-text">Start Time</label>
                        <input
                            type="time"
                            value={startTime}
                            onChange={(e) => setStartTime(e.target.value)}
                            className="input input-bordered w-full"
                        />
                        {timeErrors.startTime && (
                            <div className="text-error text-sm">
                                {timeErrors.startTime}
                            </div>
                        )}
                    </div>
                    <div>
                        <label className="label label-text">End Time</label>
                        <input
                            type="time"
                            value={endTime}
                            onChange={(e) => setEndTime(e.target.value)}
                            className="input input-bordered w-full"
                        />
                        {timeErrors.endTime && (
                            <div className="text-error text-sm">
                                {timeErrors.endTime}
                            </div>
                        )}
                    </div>
                </div>
                <div>
                    <label className="label label-text">Repeat</label>
                    <select
                        value={frequency}
                        onChange={(e) => setFrequency(e.target.value)}
                        className="select select-bordered w-full"
                    >
                        <option value="DAILY">Daily</option>
                        <option value="WEEKLY">Weekly</option>
                        <option value="MONTHLY">Monthly</option>
                    </select>
                </div>
                <div>
                    <label className="label label-text">every</label>
                    <input
                        type="number"
                        value={interval}
                        min={1}
                        onChange={(e) => setInterval(parseInt(e.target.value))}
                        className="input input-bordered w-full"
                    />
                    {frequency === 'WEEKLY'
                        ? 'week(s)'
                        : frequency === 'DAILY'
                          ? 'day(s)'
                          : 'month(s)'}
                </div>

                {frequency === 'WEEKLY' && (
                    <div>
                        <label className="label label-text">Repeat On</label>
                        <div className="flex flex-wrap gap-2">
                            {weekdays.map(({ label, value }) => (
                                <button
                                    key={label}
                                    type="button"
                                    onClick={() => toggleWeekday(value)}
                                    className={`catalog-pill border ${byWeekDays.includes(value) ? 'bg-primary text-white' : 'border-grey-3 text-body-text'}`}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                <div>
                    <label className="label label-text">Ends</label>
                    <select
                        value={endOption}
                        onChange={(e) => {
                            setEndOption(e.target.value as 'never' | 'until');
                        }}
                        className="select select-bordered w-full"
                    >
                        <option value="never">Never</option>
                        <option value="until">Until Date</option>
                    </select>
                </div>
                {endOption === 'until' && (
                    <>
                        <DateInput
                            label="End Date"
                            register={register}
                            interfaceRef={endDateRef}
                            getValues={getValues}
                            errors={errors}
                            required={endOption === 'until'}
                        />
                    </>
                )}
            </div>
        );
    }
);
