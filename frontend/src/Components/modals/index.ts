import { Timezones } from '@/common';
import { FormInputTypes, Input } from '../Modaltest';

export { AddFacilityModal } from './AddFacilityModal';
export { EditFacilityModal } from './EditFacilityModal';

export enum CRUDActions {
    Add,
    Edit,
    Delete
}

export const facilityInputs: Input[] = [
    {
        type: FormInputTypes.Text,
        label: 'Name',
        interfaceRef: 'name',
        required: true
    },
    {
        type: FormInputTypes.Dropdown,
        label: 'Timezone',
        interfaceRef: 'timezone',
        required: true,
        enumType: Timezones
    }
];
