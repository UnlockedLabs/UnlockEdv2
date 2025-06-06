import { useState, forwardRef, useImperativeHandle, useEffect } from 'react';
import { RRule, Weekday, Options } from 'rrule';
import { DateInput } from '@/Components/inputs';
import { fromZonedTime, toZonedTime } from 'date-fns-tz';
import {
    UseFormRegister,
    FieldErrors,
    UseFormGetValues
} from 'react-hook-form';
import { useLoaderData } from 'react-router';
import { ClassLoaderData } from '@/common';
import { useAuth } from '@/useAuth';
import { formatDuration, timeToMinutes } from '../helperFunctions';
export interface RRuleFormHandle {
    createRule: () => { rule: string; duration: string };
    validate: () => boolean;
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
    disabled?: boolean; //TODO using flag for edits only can remove later
    onChange?: (isValid: boolean) => void;
    startDateRef: string;
    endDateRef: string;
    errors: FieldErrors<any>; // eslint-disable-line
    register: UseFormRegister<any>; // eslint-disable-line
    getValues: UseFormGetValues<any>; // eslint-disable-line
}
export const RRuleControl = forwardRef<RRuleFormHandle, RRuleControlProp>(
    function RRuleControl(
        {
            disabled,
            onChange,
            startDateRef,
            endDateRef,
            getValues,
            errors,
            register
        },
        ref
    ) {
        const { user } = useAuth();
        if (!user) {
            return null;
        }
        const clsLoader = useLoaderData() as ClassLoaderData;
        const [timeErrors, setTimeErrors] = useState({
            startTime: '',
            endTime: '',
            weekDays: ''
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
        const FREQ_LABELS = {
            [RRule.DAILY]: 'DAILY',
            [RRule.WEEKLY]: 'WEEKLY',
            [RRule.MONTHLY]: 'MONTHLY',
            [RRule.YEARLY]: 'YEARLY'
        };
        const createRule = () => {
            let returnValue;
            if (isFormValidated() && canCreateRule()) {
                const startDate = getValues(startDateRef); // eslint-disable-line
                const zonedDateTime: Date = fromZonedTime(
                    `${startDate}T${startTime}`,
                    user.timezone
                );
                const options: Partial<Options> = {
                    freq: FREQ_MAP[frequency as keyof typeof FREQ_MAP],
                    interval,
                    dtstart: zonedDateTime
                };
                if (frequency === 'WEEKLY') {
                    options.byweekday = byWeekDays;
                }
                if (endOption === 'until') {
                    options.until = new Date(getValues(endDateRef)); // eslint-disable-line
                }

                const duration = formatDuration(startTime, endTime);
                const rule = new RRule(options);
                returnValue = {
                    rule: rule.toString(),
                    duration: duration
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
            const errors = { startTime: '', endTime: '', weekDays: '' };
            setTimeErrors(errors);
            if (!startTime) {
                errors.startTime = 'Start time is required';
                isValid = false;
            }
            if (!endTime) {
                errors.endTime = 'End time is required';
                isValid = false;
            }

            if (startTime && endTime) {
                const startTotalMin = timeToMinutes(startTime);
                const endTotalMin = timeToMinutes(endTime);
                if (endTotalMin <= startTotalMin) {
                    errors.endTime = 'End time must be after start time';
                    isValid = false;
                }
            }
            if (frequency === 'WEEKLY' && byWeekDays.length == 0) {
                errors.weekDays = 'Must select a day to repeat on';
                isValid = false;
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
                start !== '' &&
                end !== '' &&
                endMin > startMin &&
                interval >= 1 &&
                !(frequency === 'WEEKLY' && byWeekDays.length == 0)
            );
        };

        useImperativeHandle(ref, () => ({
            createRule: createRule,
            validate: isFormValidated
        }));

        useEffect(() => {
            onChange?.(canCreateRule());
        }, [startTime, endTime, interval, frequency, byWeekDays, endOption]);

        useEffect(() => {
            let recurrenceRule;
            let duration;
            if (clsLoader.class) {
                recurrenceRule = clsLoader.class.events?.[0]?.recurrence_rule;
                duration = clsLoader.class.events?.[0]?.duration;
            }
            if (!recurrenceRule || !duration) return;
            try {
                const cleanRule = recurrenceRule.replace(
                    /DTSTART;TZID=Local:/,
                    'DTSTART:'
                );
                const rule = RRule.fromString(cleanRule);
                const dtStart = rule.options.dtstart;
                const dtStartZonedDateTime: Date = toZonedTime(
                    dtStart,
                    user.timezone
                );
                const startTime = dtStartZonedDateTime
                    ? dtStartZonedDateTime.toTimeString().slice(0, 5)
                    : '';
                let endTime = '';
                const matches = /(\d+)h(\d+)m/.exec(duration);
                if (matches && dtStart) {
                    const hours = parseInt(matches[1]);
                    const minutes = parseInt(matches[2]);
                    const endDt = new Date(
                        dtStartZonedDateTime.getTime() +
                            (hours * 60 + minutes) * 60000
                    );
                    endTime = endDt.toTimeString().slice(0, 5);
                }

                const frequency =
                    FREQ_LABELS[
                        rule.options.freq as keyof typeof FREQ_LABELS
                    ] || 'WEEKLY';
                const weekDays =
                    (rule.options.byweekday as number[] | undefined)?.map(
                        (n) => weekdays[n].value
                    ) ?? [];
                setFrequency(frequency);
                setByWeekDays(weekDays);
                setStartTime(startTime);
                setEndTime(endTime);
                setInterval(rule.options.interval ?? 1);
                setEndOption(rule.options.until ? 'until' : 'never');
            } catch (err) {
                console.error('Failed to parse recurrenceRule', err);
            }
        }, []);

        function resetErrors() {
            const errors = {
                startTime: '',
                endTime: '',
                weekDays: ''
            };
            setTimeErrors(errors);
        }

        return (
            <div className="space-y-6">
                <DateInput
                    label="Start Date"
                    register={register}
                    interfaceRef={startDateRef}
                    required
                    errors={errors}
                    disabled={disabled}
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className="label label-text">Start Time</label>
                        <input
                            type="time"
                            value={startTime}
                            onChange={(e) => {
                                setStartTime(e.target.value);
                                resetErrors();
                            }}
                            className="input input-bordered w-full"
                            disabled={disabled}
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
                            onChange={(e) => {
                                setEndTime(e.target.value);
                                resetErrors();
                            }}
                            className="input input-bordered w-full"
                            disabled={disabled}
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
                        disabled={disabled}
                    >
                        <option value="DAILY">Daily</option>
                        <option value="WEEKLY">Weekly</option>
                        <option value="MONTHLY">Monthly</option>
                    </select>
                </div>
                <div>
                    <label className="label label-text">Every</label>
                    <input
                        type="number"
                        value={interval}
                        min={1}
                        onChange={(e) => setInterval(parseInt(e.target.value))}
                        className="input input-bordered w-full"
                        disabled={disabled}
                    />
                    <label className="label label-text">
                        {frequency === 'WEEKLY'
                            ? 'week(s)'
                            : frequency === 'DAILY'
                              ? 'day(s)'
                              : 'month(s)'}
                    </label>
                </div>

                {frequency === 'WEEKLY' && (
                    <div>
                        <label className="label label-text">Repeat On</label>
                        <div className="flex flex-wrap gap-2">
                            {weekdays.map(({ label, value }) => (
                                <button
                                    key={label}
                                    type="button"
                                    onClick={() => {
                                        toggleWeekday(value);
                                        resetErrors();
                                    }}
                                    className={`catalog-pill border ${byWeekDays.includes(value) ? 'bg-primary text-white' : 'border-grey-3 text-body-text'}`}
                                    disabled={disabled}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                        {timeErrors.weekDays && (
                            <div className="text-error text-sm">
                                {timeErrors.weekDays}
                            </div>
                        )}
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
                        disabled={disabled}
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
                            disabled={disabled}
                        />
                    </>
                )}
            </div>
        );
    }
);
