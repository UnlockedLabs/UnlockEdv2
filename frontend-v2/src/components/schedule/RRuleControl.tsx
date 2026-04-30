import { useState, useImperativeHandle, forwardRef } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';

export interface RRuleFormHandle {
    createRule(): { rule: string; duration: string } | null;
    validate(): boolean;
}

interface RRuleControlProps {
    defaultStartDate?: string;
    defaultStartTime?: string;
    defaultEndTime?: string;
    defaultDays?: string[];
    defaultEndDate?: string;
    startDateLabel?: string;
    startDateHelper?: string;
}

const WEEKDAY_OPTIONS = [
    { label: 'Mon', value: 'MO' },
    { label: 'Tue', value: 'TU' },
    { label: 'Wed', value: 'WE' },
    { label: 'Thu', value: 'TH' },
    { label: 'Fri', value: 'FR' },
    { label: 'Sat', value: 'SA' },
    { label: 'Sun', value: 'SU' }
];

type Frequency = 'DAILY' | 'WEEKLY' | 'MONTHLY';

const FREQUENCY_HELPER: Record<Frequency, string> = {
    DAILY: 'Class repeats every day',
    WEEKLY: 'Class repeats every week on the selected days',
    MONTHLY: 'Class repeats monthly on the same day'
};

function formatDuration(startTime: string, endTime: string): string {
    if (!startTime || !endTime) return '0h0m0s';
    const [sh, sm] = startTime.split(':').map(Number);
    const [eh, em] = endTime.split(':').map(Number);
    const totalMin = (eh ?? 0) * 60 + (em ?? 0) - ((sh ?? 0) * 60 + (sm ?? 0));
    if (totalMin <= 0) return '0h0m0s';
    const hours = Math.floor(totalMin / 60);
    const minutes = totalMin % 60;
    return `${hours}h${minutes}m0s`;
}

export const RRuleControl = forwardRef<RRuleFormHandle, RRuleControlProps>(
    function RRuleControl(
        { defaultStartDate, defaultStartTime, defaultEndTime, defaultDays, defaultEndDate, startDateLabel, startDateHelper },
        ref
    ) {
        const [startDate, setStartDate] = useState(defaultStartDate ?? '');
        const [startTime, setStartTime] = useState(defaultStartTime ?? '');
        const [endTime, setEndTime] = useState(defaultEndTime ?? '');
        const [frequency, setFrequency] = useState<Frequency>('WEEKLY');
        const [days, setDays] = useState<string[]>(defaultDays ?? []);
        const [untilDate] = useState(defaultEndDate ?? '');

        function toggleDay(day: string) {
            setDays((prev) =>
                prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
            );
        }

        useImperativeHandle(ref, () => ({
            validate() {
                if (!startDate || !startTime || !endTime) return false;
                const dur = formatDuration(startTime, endTime);
                if (dur === '0h0m0s') return false;
                if (frequency === 'WEEKLY' && days.length === 0) return false;
                return true;
            },
            createRule() {
                if (!this.validate()) return null;
                const dtStart = `${startDate.replace(/-/g, '')}T${startTime.replace(/:/g, '')}00`;
                let rule = `DTSTART;TZID=Local:${dtStart}\nRRULE:FREQ=${frequency}`;
                if (frequency === 'WEEKLY' && days.length > 0) {
                    rule += `;BYDAY=${days.join(',')}`;
                }
                if (untilDate) {
                    rule += `;UNTIL=${untilDate.replace(/-/g, '')}T235959Z`;
                }
                return {
                    rule,
                    duration: formatDuration(startTime, endTime)
                };
            }
        }));

        return (
            <div className="space-y-4">
                <div className="space-y-2">
                    <Label>{startDateLabel ?? 'Start Date'}</Label>
                    <Input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                    />
                    {startDateHelper && <p className="text-sm text-gray-500">{startDateHelper}</p>}
                </div>

                <div className="space-y-2 pt-1">
                    <Label>Repeats *</Label>
                    <Select
                        value={frequency}
                        onValueChange={(v) => setFrequency(v as Frequency)}
                    >
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="DAILY">Daily</SelectItem>
                            <SelectItem value="WEEKLY">Weekly</SelectItem>
                            <SelectItem value="MONTHLY">Monthly</SelectItem>
                        </SelectContent>
                    </Select>
                    <p className="text-xs text-gray-500">{FREQUENCY_HELPER[frequency]}</p>
                </div>

                {frequency === 'WEEKLY' && (
                    <div className="space-y-2 pt-1">
                        <Label>Days of Week *</Label>
                        <div className="grid grid-cols-4 gap-2">
                            {WEEKDAY_OPTIONS.map((day) => (
                                <button
                                    key={day.value}
                                    type="button"
                                    onClick={() => toggleDay(day.value)}
                                    className={`px-3 py-2 rounded-lg border text-sm transition-colors ${
                                        days.includes(day.value)
                                            ? 'bg-[#556830] text-white border-[#556830]'
                                            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                                    }`}
                                >
                                    {day.label}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-2 gap-4 pt-1">
                    <div className="space-y-2">
                        <Label>New Start Time *</Label>
                        <Input
                            type="time"
                            value={startTime}
                            onChange={(e) => setStartTime(e.target.value)}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>New End Time *</Label>
                        <Input
                            type="time"
                            value={endTime}
                            onChange={(e) => setEndTime(e.target.value)}
                        />
                    </div>
                </div>
            </div>
        );
    }
);
