import {
    ProviderPlatform,
    ProviderPlatformState,
    ProviderPlatformType,
    ServerResponseMany,
    ServerResponseOne,
    Timezones,
    UserRole
} from '@/common';
import { KeyedMutator } from 'swr';
import { UseFormGetValues, Validate } from 'react-hook-form';
import { AdminRoles } from '@/useAuth';

export enum TextModalType {
    Confirm,
    Delete,
    Information
}

export { TextOnlyModal } from './TextOnlyModal';

export enum CRUDActions {
    Add,
    Edit,
    Delete,
    Reset
}

export interface CRUDModalProps<T> {
    mutate:
        | KeyedMutator<ServerResponseMany<T>>
        | KeyedMutator<ServerResponseOne<T>>;
    target?: T;
}

export enum FormInputTypes {
    Text,
    Date,
    Time,
    Dropdown,
    TextArea,
    MultiSelectDropdown,
    Checkbox,
    Unique
}

export interface Input {
    type: FormInputTypes;
    label: string;
    interfaceRef: string;
    required: boolean;
    enumType?: Record<string, string>;
    length?: number;
    pattern?: Pattern;
    validate?:
        | Validate<any, any> // eslint-disable-line
        | Record<string, Validate<any, any>>; // eslint-disable-line
    uniqueComponent?: JSX.Element;
    disabled?: boolean;
    allowPastDate?: boolean;
    monthOnly?: boolean;
    getValues?: UseFormGetValues<any>; // eslint-disable-line
    onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
    onChangeSelection?: (event: React.ChangeEvent<HTMLSelectElement>) => void;
    placeholder?: string;
    defaultValue?: string;
}

export interface InputWithOptions<T> extends Input {
    options?: T[];
}

export interface Pattern {
    value: RegExp;
    message: string;
}

export function closeModal(ref: React.ForwardedRef<HTMLDialogElement>) {
    if (ref && 'current' in ref && ref.current) {
        ref.current.close();
    }
    return null;
}

export function showModal(ref: React.ForwardedRef<HTMLDialogElement>) {
    if (ref && 'current' in ref && ref.current) {
        ref.current.showModal();
    }
    return null;
}

export interface TargetItem<T> {
    action: CRUDActions;
    target: T;
}

export { FormModal } from './FormModal';

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
    }
];

export { AddProviderModal } from './AddProviderModal';
export { EditProviderModal } from './EditProviderModal';

export const registerProviderInputs: Input[] = [
    {
        type: FormInputTypes.Checkbox,
        label: 'Auto register',
        interfaceRef: 'auto_register',
        required: false
    },
    {
        type: FormInputTypes.Text,
        label: 'Redirect URL',
        interfaceRef: 'redirect_url',
        required: false,
        length: 100
    }
];

export { RegisterOIDCClientModal } from './RegisterOIDCClientModal';

// Helpful Links Exports
export const linkInputs: Input[] = [
    {
        type: FormInputTypes.Text,
        label: 'Title',
        interfaceRef: 'title',
        required: true,
        length: 255
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
export { AddHelpfulLinkModal } from './AddHelpfulLinkModal';
export { EditHelpfulLinkModal } from './EditHelpfulLinkModal';

// User Exports
export const checkOnlyLettersAndSpaces: Validate<string, string | boolean> = (
    input: string
) => {
    if (!/^[A-Za-z\s-]+$/.test(input)) {
        return 'Input should only contain letters, spaces, and hyphens';
    }
    return true;
};
export const checkOnlyLettersAndNumbers: Validate<string, string | boolean> = (
    input: string
) => {
    if (!/^[A-Za-z0-9]+$/.test(input)) {
        return 'Input should only contain letters and numbers';
    }
    return true;
};
export const getUserInputs = (
    userRole: UserRole,
    action: CRUDActions,
    providerPlatforms?: ProviderPlatform[]
): InputWithOptions<ProviderPlatform>[] => {
    const inputs: InputWithOptions<ProviderPlatform>[] = [
        {
            type: FormInputTypes.Text,
            label: 'First Name',
            interfaceRef: 'name_first',
            required: true,
            length: 25,
            validate: checkOnlyLettersAndSpaces
        },
        {
            type: FormInputTypes.Text,
            label: 'Last Name',
            interfaceRef: 'name_last',
            required: true,
            length: 25,
            validate: checkOnlyLettersAndSpaces
        },
        {
            type: FormInputTypes.Text,
            label: 'Username',
            interfaceRef: 'username',
            required: true,
            length: 50,
            pattern: {
                value: /^[A-Za-z0-9]+$/,
                message:
                    'Username can only contain letters and numbers without spaces'
            },
            disabled: action === CRUDActions.Edit
        }
    ];
    if (!AdminRoles.includes(userRole)) {
        inputs.push({
            type: FormInputTypes.Text,
            label: 'Resident ID',
            interfaceRef: 'doc_id',
            required: true,
            length: 25
        });
    }
    if (AdminRoles.includes(userRole)) {
        inputs.push({
            type: FormInputTypes.Text,
            label: 'Email (optional)',
            interfaceRef: 'email',
            required: false,
            length: 50,
            disabled: false
        });
    }
    if (
        userRole === UserRole.Student &&
        providerPlatforms &&
        providerPlatforms.length > 0
    ) {
        inputs.push({
            type: FormInputTypes.MultiSelectDropdown,
            label: 'Also create new account for user in:',
            interfaceRef: 'platforms',
            required: false,
            options: providerPlatforms
        });
    }
    return inputs;
};
export { AddUserModal } from './AddUserModal';
export { EditUserModal } from './EditUserModal';

// Video Exports

const getInvalidValidURLs = (urls: string[]): string[] | undefined => {
    const badLinks: string[] = [];
    urls.forEach((url) => {
        if (
            url.includes('youtube') &&
            !url.includes('watch?v=') &&
            !url.includes('youtu.be')
        ) {
            badLinks.push(url);
        }
    });
    return badLinks.length > 0 ? badLinks : undefined;
};

export const checkValidVideoURLs: Validate<string, string> = (
    input: string
) => {
    const urls = input
        .split(',')
        .map((url) => url.trim())
        .filter((url) => url !== '');
    if (urls.length === 0) {
        return 'Please enter at least one valid URL.';
    }
    const badLinks = getInvalidValidURLs(urls);
    if (badLinks != undefined) {
        const badLinksString = `The following links entered are not valid Youtube links: ${badLinks.join(', ')}`;
        return badLinksString;
    }
    return true;
};

export const videoInputs: Input[] = [
    {
        type: FormInputTypes.TextArea,
        label: `Enter video URLs from YouTube and similar sites to download. 
        If a download fails, it will be retried up to 5 times before the video needs to be added again.`,
        interfaceRef: 'videoURLs',
        required: false,
        validate: checkValidVideoURLs
    }
];

export { AddVideoModal } from './AddVideoModal';

export const requestContentInputs: Input[] = [
    {
        type: FormInputTypes.TextArea,
        label: 'What content would you like to see added to UnlockEd?',
        interfaceRef: 'content',
        required: true,
        placeholder: 'e.g., "GED math resources, Mental health videos,..."'
    }
];

export { RequestContentModal } from './RequestContentModal';

export { ResidentAttendanceModal } from './ResidentAttendanceModal';

export { RestoreClassEventModal } from './RestoreClassEventModal';

export { CancelClassEventModal } from './CancelClassEventModal';

export { RescheduleClassEventModal } from './RescheduleClassEventModal';

export { RescheduleClassEventSeriesModal } from './RescheduleClassEventSeriesModal';

export { BulkUploadModal } from './BulkUploadModal';
export { ValidationResultsModal } from './ValidationResultsModal';
export { UploadCompleteModal } from './UploadCompleteModal';
