import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';
import type { TranscriptEntry } from '@/types/digital-transcript';
import { learningRecordQuestionHeaderClassName } from './learningRecordButtons';
import { FUNNEL_FIELD_DESCRIPTIONS } from './transcriptReflectionConfig';
import { useLearningRecordFacilities } from './useLearningRecordFacilities';

/** Sentinel for the "Other" item — no facility id can collide with it. */
const OTHER_VALUE = 'other';

export const ACHIEVEMENT_LOCATION_LABEL =
    'Where did this achievement take place?';

interface AchievementLocationFieldProps {
    entry: TranscriptEntry;
    onChange: (patch: Partial<TranscriptEntry>) => void;
}

/**
 * Achievement location — the facility where the program was completed, which is
 * often not the resident's current facility. Mount with `key={entry.id}` so the
 * "Other" toggle resets when a different achievement is opened.
 */
export function AchievementLocationField({
    entry,
    onChange
}: AchievementLocationFieldProps) {
    const { facilities, loaded } = useLearningRecordFacilities();
    const [otherSelected, setOtherSelected] = useState(
        entry.facilityOther.trim() !== ''
    );
    // Free text always implies Other, so a value arriving after mount still wins.
    const showOther = otherSelected || entry.facilityOther.trim() !== '';

    const selectValue = showOther
        ? OTHER_VALUE
        : entry.facilityId !== null
          ? String(entry.facilityId)
          : '';

    function handleSelect(value: string) {
        if (value === OTHER_VALUE) {
            setOtherSelected(true);
            onChange({ facilityId: null, facilityName: '' });
            return;
        }
        const id = Number(value);
        const facility = facilities.find((f) => f.id === id);
        setOtherSelected(false);
        onChange({
            facilityId: id,
            facilityName: facility?.name ?? '',
            facilityOther: ''
        });
    }

    const selectId = `ach-location-${entry.id}`;
    const otherId = `ach-location-other-${entry.id}`;

    return (
        <div data-slot="achievement-location">
            <div className={learningRecordQuestionHeaderClassName}>
                <Label
                    htmlFor={selectId}
                    className="text-base font-medium leading-snug text-foreground"
                >
                    {ACHIEVEMENT_LOCATION_LABEL}
                </Label>
                <p className="text-xs leading-relaxed text-muted-foreground">
                    {FUNNEL_FIELD_DESCRIPTIONS.location}
                </p>
            </div>
            <Select value={selectValue} onValueChange={handleSelect}>
                <SelectTrigger
                    id={selectId}
                    data-slot="transcript-location"
                    className="h-10 w-full border-border/80 bg-muted/40"
                >
                    <SelectValue
                        placeholder={
                            loaded ? 'Select a location' : 'Loading locations…'
                        }
                    />
                </SelectTrigger>
                <SelectContent>
                    {facilities.map((facility) => (
                        <SelectItem
                            key={facility.id}
                            value={String(facility.id)}
                        >
                            {facility.name}
                        </SelectItem>
                    ))}
                    <SelectItem value={OTHER_VALUE}>
                        Other (not listed)
                    </SelectItem>
                </SelectContent>
            </Select>
            {showOther ? (
                <div className="mt-3">
                    <Label
                        htmlFor={otherId}
                        className="text-sm font-normal leading-snug text-foreground"
                    >
                        Where was it? Add the city or state if that helps.
                    </Label>
                    <Input
                        id={otherId}
                        data-slot="transcript-location-other"
                        value={entry.facilityOther}
                        onChange={(e) =>
                            onChange({
                                facilityOther: e.target.value,
                                facilityId: null,
                                facilityName: ''
                            })
                        }
                        placeholder="Facility, program, or place"
                        className="mt-1.5 h-10 border-border/80 bg-muted/40"
                    />
                </div>
            ) : null}
        </div>
    );
}
