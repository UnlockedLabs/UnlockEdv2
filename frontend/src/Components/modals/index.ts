import { ProviderPlatformState, ProviderPlatformType, ServerResponseMany, ServerResponseOne, Timezones } from '@/common';
import { FormInputTypes, Input } from '../Modaltest';
import { KeyedMutator } from 'swr';

export enum CRUDActions {
    Add,
    Edit,
    Delete
}
export interface CRUDModalProps<T> {
    mutate: KeyedMutator<ServerResponseMany<T>> | KeyedMutator<ServerResponseOne<T>>;
    target?: T;
}

// Facility Exports
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
export { AddFacilityModal } from './AddFacilityModal';
export { EditFacilityModal } from './EditFacilityModal';

// Provider Platform Exports
export const providerInputs: Input[] = [
    {
        type: FormInputTypes.Text,
        label: 'Name',
        interfaceRef: 'name',
        required: true,
        length: 25
    },
    {
        type: FormInputTypes.Dropdown,
        label: 'Type',
        interfaceRef: 'type',
        enumType: ProviderPlatformType,
        required: true
    },
    {
        type: FormInputTypes.Dropdown,
        label: 'State',
        interfaceRef: 'state',
        enumType: ProviderPlatformState,
        required: true
    },
    {
        type: FormInputTypes.Text,
        label: 'Base URL',
        interfaceRef: 'base_url',
        required: true
    },
    {
        type: FormInputTypes.Text,
        label: 'Account Id',
        interfaceRef: 'account_id',
        required: true
    },
    {
        type: FormInputTypes.Text,
        label: 'Access Key',
        interfaceRef: 'access_key',
        required: true
    }
];
export {AddProviderModal} from "./AddProviderModal"

// Helpful Links Exports
export const linkInputs: Input[] = [
    {
        type: FormInputTypes.Text,
        label: 'Title',
        interfaceRef: 'title',
        required: true,
        length: 25
    },
    {
        type: FormInputTypes.Text,
        label: 'URL',
        interfaceRef: 'url',
        required: true
    },
    {
        type: FormInputTypes.TextArea,
        label: 'Description',
        interfaceRef: 'description',
        required: false,
        length: 255
    }
];
export {AddHelpfulLinkModal} from "./AddHelpfulLinkModal"
export {EditHelpfulLinkModal} from "./EditHelpfulLinkModal"