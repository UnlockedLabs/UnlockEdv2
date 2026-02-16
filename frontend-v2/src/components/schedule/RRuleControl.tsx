import { useState, useImperativeHandle, forwardRef } from 'react';
import { Button } from '@/components/ui/button';
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
        { defaultStartDate, defaultStartTime, defaultEndTime, defaultDays, defaultEndDate },
        ref
    ) {
        const [startDate, setStartDate] = useState(defaultStartDate ?? '');
        const [startTime, setStartTime] = useState(defaultStartTime ?? '');
        const [endTime, setEndTime] = useState(defaultEndTime ?? '');
        const [frequency, setFrequency] = useState<Frequency>('WEEKLY');
        const [days, setDays] = useState<string[]>(defaultDays ?? []);
        const [endType, setEndType] = useState<'never' | 'until'>(
            defaultEndDate ? 'until' : 'never'
        );
        const [untilDate, setUntilDate] = useState(defaultEndDate ?? '');

        function toggleDay(day: string) {
            setDays((prev) =>
                prev.includes(day)
                    ? prev.filter((d) => d !== day)
                    : [...prev, day]
            );
        }

        useImperativeHandle(ref, () => ({
            validate() {
                if (!startDate || !startTime || !endTime) return false;
                const dur = formatDuration(startTime, endTime);
                if (dur === '0h0m0s') return false;
                if (frequency === 'WEEKLY' && days.length === 0) return false;
                if (endType === 'until' && !untilDate) return false;
                return true;
            },
            createRule() {
                if (!this.validate()) return null;
                const dtStart = `${startDate.replace(/-/g, '')}T${startTime.replace(/:/g, '')}00`;
                let rule = `DTSTART;TZID=Local:${dtStart}\nRRULE:FREQ=${frequency}`;
                if (frequency === 'WEEKLY' && days.length > 0) {
                    rule += `;BYDAY=${days.join(',')}`;
                }
                if (endType === 'until' && untilDate) {
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
                <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-2">
                        <Label>Start Date</Label>
                        <Input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Start Time</Label>
                        <Input
                            type="time"
                            value={startTime}
                            onChange={(e) => setStartTime(e.target.value)}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>End Time</Label>
                        <Input
                            type="time"
                            value={endTime}
                            onChange={(e) => setEndTime(e.target.value)}
                        />
                    </div>
                </div>

                <div className="space-y-2">
                    <Label>Frequency</Label>
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
                </div>

                {frequency === 'WEEKLY' && (
                    <div className="space-y-2">
                        <Label>Days of Week</Label>
                        <div className="flex flex-wrap gap-2">
                            {WEEKDAY_OPTIONS.map((day) => (
                                <Button
                                    key={day.value}
                                    type="button"
                                    variant={
                                        days.includes(day.value)
                                            ? 'default'
                                            : 'outline'
                                    }
                                    size="sm"
                                    className={
                                        days.includes(day.value)
                                            ? 'bg-[#556830] hover:bg-[#203622] text-white'
                                            : 'border-gray-300'
                                    }
                                    onClick={() => toggleDay(day.value)}
                                >
                                    {day.label}
                                </Button>
                            ))}
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                        <Label>Ends</Label>
                        <Select
                            value={endType}
                            onValueChange={(v) =>
                                setEndType(v as 'never' | 'until')
                            }
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="never">Never</SelectItem>
                                <SelectItem value="until">
                                    Until Date
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    {endType === 'until' && (
                        <div className="space-y-2">
                            <Label>Until</Label>
                            <Input
                                type="date"
                                value={untilDate}
                                onChange={(e) => setUntilDate(e.target.value)}
                            />
                        </div>
                    )}
                </div>
            </div>
        );
    }
);
